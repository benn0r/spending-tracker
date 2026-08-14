import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createPayload,
  deviceLocale,
  emptyDraft,
  formatDateHeader,
  formatCurrency,
  formatTransactionDate,
  isDraftValid,
  limitTransactionCache,
  parseTransactionCache,
  summarize,
  transactionDayTotals,
} from '../../src/transactions.ts';

describe('transaction helpers', () => {
  it('formats expenses and income', () => {
    assert.equal(formatCurrency(-12.5), '− CHF 12.50');
    assert.equal(formatCurrency(4250), "+ CHF 4'250.00");
  });

  it('formats transaction dates with the device locale and relative day headers', () => {
    const now = new Date(2026, 7, 10, 12);
    assert.equal(formatDateHeader('2026-08-10', now), 'Today');
    assert.equal(formatDateHeader('2026-08-09', now), 'Yesterday');
    assert.equal(formatDateHeader('2026-08-08', now, 'en-US'), 'August 8');
    assert.equal(
      formatDateHeader('1992-10-13', now),
      new Intl.DateTimeFormat(deviceLocale(), {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      }).format(new Date('1992-10-13T12:00:00')),
    );
    assert.equal(formatTransactionDate('invalid'), 'invalid');
    assert.equal(
      formatTransactionDate('1992-10-13', 'de-CH'),
      new Intl.DateTimeFormat('de-CH', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date('1992-10-13T12:00:00')),
    );
  });

  it('recognizes yesterday across a year boundary', () => {
    const now = new Date(2026, 0, 1, 12);
    assert.equal(formatDateHeader('2026-01-01', now), 'Today');
    assert.equal(formatDateHeader('2025-12-31', now), 'Yesterday');
  });

  it('summarizes API transactions', () => {
    const base = {
      id: '1',
      date: '2026-08-09',
      account: 'Main',
      category: 'Food',
      payee: 'Market',
      isSplit: false,
    };
    assert.deepEqual(
      summarize([
        { ...base, amount: 100 },
        { ...base, id: '2', amount: -35 },
      ]),
      { income: 100, spent: 35, balance: 65 },
    );
    assert.deepEqual(summarize([]), { income: 0, spent: 0, balance: 0 });
  });

  it('totals transactions by day for section headers', () => {
    const transaction = {
      id: '1',
      date: '2026-08-09',
      account: 'Main',
      category: 'Food',
      payee: 'Market',
      isSplit: false,
    };
    assert.deepEqual(
      transactionDayTotals([
        { ...transaction, amount: -35 },
        { ...transaction, id: '2', amount: 100 },
        { ...transaction, id: '3', date: '2026-08-08', amount: -12 },
      ]),
      { '2026-08-09': 65, '2026-08-08': -12 },
    );
  });

  it('keeps and restores only the latest 20 valid cached transactions', () => {
    const transactions = Array.from({ length: 24 }, (_, index) => ({
      id: String(index),
      date: '2026-08-11',
      amount: -(index + 1),
      account: 'Everyday',
      category: 'Groceries',
      payee: 'Market',
      isSplit: false,
    }));
    assert.equal(limitTransactionCache(transactions).length, 20);
    assert.deepEqual(
      parseTransactionCache(JSON.stringify(transactions)),
      transactions.slice(0, 20),
    );
    assert.deepEqual(parseTransactionCache('{broken'), []);
  });

  it('rejects non-array caches and filters every invalid transaction shape', () => {
    const valid = {
      id: 'valid',
      date: '2026-08-11',
      amount: -10,
      account: 'Everyday',
      category: 'Groceries',
      payee: 'Market',
      isSplit: false,
    };
    const invalid = [
      42,
      null,
      { ...valid, id: 1 },
      { ...valid, date: 1 },
      { ...valid, amount: '10' },
      { ...valid, account: 1 },
      { ...valid, category: 1 },
      { ...valid, payee: 1 },
      { ...valid, isSplit: 'false' },
    ];
    assert.deepEqual(parseTransactionCache(JSON.stringify({ transactions: [valid] })), []);
    assert.deepEqual(parseTransactionCache(JSON.stringify([...invalid, valid])), [valid]);
  });

  it('validates normal and split drafts', () => {
    const normal = { ...emptyDraft, account: 'account-1', category: 'food', amount: '12,50' };
    assert.equal(isDraftValid(normal, 'transaction'), true);
    assert.equal(isDraftValid({ ...normal, category: '' }, 'transaction'), false);
    assert.equal(isDraftValid({ ...normal, account: '' }, 'transaction'), false);
    for (const amount of ['0', '-1', 'NaN', 'Infinity']) {
      assert.equal(isDraftValid({ ...normal, amount }, 'transaction'), false);
    }
    const split = {
      ...normal,
      splits: [
        { category: 'food', amount: '7.50', tags: [] },
        { category: 'home', amount: '5', tags: [] },
      ],
    };
    assert.equal(isDraftValid(split, 'split'), true);
    assert.equal(isDraftValid({ ...split, amount: '13' }, 'split'), false);
    assert.equal(isDraftValid({ ...split, splits: split.splits.slice(0, 1) }, 'split'), false);
    assert.equal(
      isDraftValid(
        { ...split, splits: [{ ...split.splits[0]!, category: '' }, split.splits[1]!] },
        'split',
      ),
      false,
    );
    assert.equal(
      isDraftValid(
        { ...split, splits: [{ ...split.splits[0]!, amount: '0' }, split.splits[1]!] },
        'split',
      ),
      false,
    );
    assert.equal(
      isDraftValid(
        {
          ...split,
          amount: '0.30',
          splits: [
            { ...split.splits[0]!, amount: '0.10' },
            { ...split.splits[1]!, amount: '0.20' },
          ],
        },
        'split',
      ),
      true,
    );
  });

  it('accepts blank or strict local dates and rejects malformed or impossible dates', () => {
    const normal = { ...emptyDraft, account: 'account-1', category: 'food', amount: '12.50' };
    for (const date of ['', '0000-01-01', '2024-02-29', '9999-12-31']) {
      assert.equal(isDraftValid({ ...normal, date }, 'transaction'), true, date || 'blank date');
    }
    for (const date of [
      '2023-02-29',
      '2026-02-30',
      '2026-04-31',
      '2026-00-10',
      '2026-13-01',
      '2026-01-00',
      '2026-01-32',
      '26-01-01',
      '2026-1-01',
      '2026-01-1',
      '2026/01/01',
      ' 2026-01-01',
      '2026-01-01 ',
      '   ',
    ]) {
      assert.equal(isDraftValid({ ...normal, date }, 'transaction'), false, date);
    }

    const split = {
      ...normal,
      date: '2026-02-29',
      splits: [
        { category: 'food', amount: '7.50', tags: [] },
        { category: 'home', amount: '5', tags: [] },
      ],
    };
    assert.equal(isDraftValid(split, 'split'), false);
  });

  it('creates server payloads with IDs and negative expense amounts', () => {
    const draft = {
      ...emptyDraft,
      account: 'account-1',
      category: 'food-id',
      amount: '12,50',
      tags: ['weekly-id'],
      comment: 'Market',
    };
    assert.deepEqual(createPayload(draft, 'transaction', new Date('2026-08-09T12:00:00Z')), {
      account: 'account-1',
      category: 'food-id',
      date: '2026-08-09',
      amount: -12.5,
      notes: 'Market',
      tags: ['weekly-id'],
    });
  });

  it('creates balanced split payloads and omits empty split tags', () => {
    const draft = {
      ...emptyDraft,
      account: 'account-1',
      amount: '12.50',
      comment: '  Shared purchase  ',
      splits: [
        { category: 'food-id', amount: '7.50', tags: ['weekly-id'] },
        { category: 'home-id', amount: '5', tags: [] },
      ],
    };
    const payload = createPayload(draft, 'split', new Date('2026-08-12T12:00:00Z'));
    assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
      account: 'account-1',
      date: '2026-08-12',
      amount: -12.5,
      notes: 'Shared purchase',
      splits: [
        { category: 'food-id', amount: -7.5, tags: ['weekly-id'] },
        { category: 'home-id', amount: -5 },
      ],
    });
  });

  it('uses the supplied local default date and omits blank notes and tags', () => {
    const draft = {
      ...emptyDraft,
      account: 'account-1',
      category: 'food-id',
      amount: '8',
      comment: '   ',
    };
    const defaultDate = new Date(2026, 0, 2, 0, 1);
    defaultDate.toISOString = () => '2026-01-01T23:01:00.000Z';
    const payload = createPayload(draft, 'transaction', defaultDate);
    assert.deepEqual(JSON.parse(JSON.stringify(payload)), {
      account: 'account-1',
      category: 'food-id',
      date: '2026-01-02',
      amount: -8,
    });
  });

  it('preserves a strict supplied draft date without consulting the fallback date', () => {
    const draft = {
      ...emptyDraft,
      account: 'account-1',
      category: 'food-id',
      date: '2024-02-29',
      amount: '8',
    };
    assert.equal(createPayload(draft, 'transaction', new Date(Number.NaN)).date, '2024-02-29');
  });

  it('rejects an invalid nonempty date before creating a payload', () => {
    const draft = {
      ...emptyDraft,
      account: 'account-1',
      category: 'food-id',
      date: '2026-02-29',
      amount: '8',
    };
    assert.throws(
      () => createPayload(draft, 'transaction'),
      /Complete all required transaction fields/,
    );
  });

  it('throws instead of creating a payload from an invalid draft', () => {
    assert.throws(
      () => createPayload(emptyDraft, 'transaction'),
      /Complete all required transaction fields/,
    );
  });
});
