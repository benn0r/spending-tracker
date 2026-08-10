import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createPayload,
  emptyDraft,
  formatDateHeader,
  formatCurrency,
  formatTransactionDate,
  isDraftValid,
  summarize,
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
    assert.equal(
      formatDateHeader('1992-10-13', now),
      new Intl.DateTimeFormat(undefined, {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
      }).format(new Date('1992-10-13T12:00:00')),
    );
    assert.equal(formatTransactionDate('invalid'), 'invalid');
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
  });
  it('validates normal and split drafts', () => {
    const normal = { ...emptyDraft, account: 'account-1', category: 'food', amount: '12,50' };
    assert.equal(isDraftValid(normal, 'transaction'), true);
    assert.equal(isDraftValid({ ...normal, category: '' }, 'transaction'), false);
    const split = {
      ...normal,
      splits: [
        { category: 'food', amount: '7.50', tags: [] },
        { category: 'home', amount: '5', tags: [] },
      ],
    };
    assert.equal(isDraftValid(split, 'split'), true);
    assert.equal(isDraftValid({ ...split, amount: '13' }, 'split'), false);
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
});
