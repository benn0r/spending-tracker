import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  countActionableReceipts,
  createConfirmedTransaction,
  enqueueQueuedTransaction,
  formatLocalDate,
  isReceiptActionable,
  isLocalDate,
  mergeTransactionPages,
  parseLocalDate,
  parseReferenceCache,
  sortCategoryReferences,
  parseTransactionQueue,
  prepareReceiptDraft,
  prependConfirmedTransaction,
  queuedTransactionBaseId,
  removeQueuedTransaction,
  replaceQueuedTransaction,
  type QueuedTransaction,
} from '../../src/app-model.ts';
import type {
  ApiReceipt,
  ApiTransaction,
  References,
  TransactionPayload,
} from '../../src/types.ts';

const references: References = {
  accounts: [
    { id: 'account-1', name: 'Everyday' },
    { id: 'account-2', name: 'Savings' },
  ],
  categories: [
    { id: 'food-id', name: 'Groceries', icon: 'basket', color: '#B87545' },
    { id: 'home-id', name: 'Home' },
  ],
  tags: [
    { id: 'weekly-id', name: 'Weekly' },
    { id: 'shared-id', name: 'Shared' },
  ],
};

const transactionPayload: TransactionPayload = {
  account: 'account-1',
  category: 'food-id',
  date: '2026-08-11',
  amount: -18.5,
  notes: 'Market',
  tags: ['weekly-id'],
};

const queuedTransaction: QueuedTransaction = {
  id: 'queued-2026-08-11-account-1-18.5-1',
  payload: transactionPayload,
  mode: 'transaction',
  account: 'Everyday',
  category: 'Groceries',
  error: 'Network unavailable',
};

const apiTransaction = (id: string, payee = id): ApiTransaction => ({
  id,
  date: '2026-08-11',
  amount: -10,
  account: 'Everyday',
  category: 'Groceries',
  payee,
  isSplit: false,
});

function receipt(overrides: Partial<ApiReceipt> = {}): ApiReceipt {
  return {
    id: 7,
    filename: 'receipt.jpg',
    account: 'account-1',
    mimeType: 'image/jpeg',
    status: 'processed',
    suggestion: {
      merchant: 'Corner Market',
      date: '2026-08-10',
      amount: 20,
      currency: 'CHF',
      category: 'food-id',
      notes: 'Weekly groceries',
      tags: ['weekly-id', 'disabled-tag'],
      items: [],
      splits: [],
      confidence: 0.95,
    },
    error: null,
    submitted: false,
    actualId: null,
    createdAt: '2026-08-11',
    processedAt: '2026-08-11',
    submittedAt: null,
    ...overrides,
  };
}

describe('reference cache', () => {
  it('sorts configured categories first and alphabetizes the remainder', () => {
    assert.deepEqual(
      sortCategoryReferences([
        { id: 'travel', name: 'Travel' },
        { id: 'food', name: 'Food', sortOrder: 2 },
        { id: 'home', name: 'Home', sortOrder: 1 },
        { id: 'bills', name: 'Bills' },
      ]).map(({ id }) => id),
      ['home', 'food', 'bills', 'travel'],
    );
  });

  it('restores a deeply valid reference cache and drops unknown properties', () => {
    const cached = JSON.stringify({
      ...references,
      accounts: [{ ...references.accounts[0], ignored: true }],
    });
    assert.deepEqual(parseReferenceCache(cached), {
      ...references,
      accounts: [{ id: 'account-1', name: 'Everyday' }],
    });
  });

  it('rejects missing collections, malformed JSON, invalid nested values, and duplicate IDs', () => {
    assert.equal(parseReferenceCache(null), null);
    assert.equal(parseReferenceCache('{broken'), null);
    assert.equal(parseReferenceCache(JSON.stringify({ accounts: [], categories: [] })), null);
    assert.equal(
      parseReferenceCache(
        JSON.stringify({ ...references, accounts: [{ id: '', name: 'No identifier' }] }),
      ),
      null,
    );
    assert.equal(
      parseReferenceCache(
        JSON.stringify({ ...references, categories: [{ id: 'food', name: 'Food', icon: 42 }] }),
      ),
      null,
    );
    assert.equal(
      parseReferenceCache(
        JSON.stringify({
          ...references,
          categories: [{ id: 'food', name: 'Food', sortOrder: 0 }],
        }),
      ),
      null,
    );
    assert.equal(
      parseReferenceCache(
        JSON.stringify({
          ...references,
          tags: [
            { id: 'same', name: 'One' },
            { id: 'same', name: 'Two' },
          ],
        }),
      ),
      null,
    );
  });
});

describe('strict local dates', () => {
  it('formats and parses a local calendar date without UTC conversion', () => {
    const value = new Date(2026, 0, 5, 23, 30);
    assert.equal(formatLocalDate(value), '2026-01-05');
    const parsed = parseLocalDate('2026-01-05');
    assert.ok(parsed);
    assert.equal(parsed.getFullYear(), 2026);
    assert.equal(parsed.getMonth(), 0);
    assert.equal(parsed.getDate(), 5);
    assert.equal(parsed.getHours(), 12);
  });

  it('accepts leap days and rejects normalized or malformed dates', () => {
    assert.equal(isLocalDate('2024-02-29'), true);
    for (const value of ['2026-02-29', '2026-02-31', '2026-00-10', '2026-13-01', '26-1-1']) {
      assert.equal(parseLocalDate(value), null);
      assert.equal(isLocalDate(value), false);
    }
  });

  it('validates civil dates independently of timezone transitions', () => {
    const originalTimezone = process.env.TZ;
    try {
      process.env.TZ = 'Pacific/Apia';
      assert.equal(isLocalDate('2011-12-30'), true);
      assert.ok(parseLocalDate('2011-12-30'));
    } finally {
      if (originalTimezone === undefined) delete process.env.TZ;
      else process.env.TZ = originalTimezone;
    }
  });

  it('rejects an invalid Date when formatting', () => {
    assert.throws(() => formatLocalDate(new Date(Number.NaN)), RangeError);
    const beforeSupportedRange = new Date(0);
    beforeSupportedRange.setFullYear(-1);
    const afterSupportedRange = new Date(0);
    afterSupportedRange.setFullYear(10_000);
    assert.throws(() => formatLocalDate(beforeSupportedRange), /between 0000 and 9999/);
    assert.throws(() => formatLocalDate(afterSupportedRange), /between 0000 and 9999/);
  });
});

describe('queued transaction cache and reducers', () => {
  it('restores valid transaction and balanced split entries', () => {
    const split: QueuedTransaction = {
      ...queuedTransaction,
      id: 'split-1',
      mode: 'split',
      category: 'Split transaction',
      payload: {
        account: 'account-1',
        date: '2026-08-11',
        amount: -18.5,
        splits: [
          { category: 'food-id', amount: -10, tags: ['weekly-id'] },
          { category: 'home-id', amount: -8.5 },
        ],
      },
    };
    assert.deepEqual(parseTransactionQueue(JSON.stringify([queuedTransaction, split])), [
      queuedTransaction,
      split,
    ]);
  });

  it('returns an empty queue for missing, malformed, or non-array storage', () => {
    assert.deepEqual(parseTransactionQueue(null), []);
    assert.deepEqual(parseTransactionQueue('{broken'), []);
    assert.deepEqual(parseTransactionQueue(JSON.stringify({ queue: [] })), []);
  });

  it('drops malformed entries, duplicate IDs, and invalid totals while retaining stale IDs', () => {
    const malformed = { ...queuedTransaction, id: '', payload: { ...transactionPayload } };
    const invalidTotal = {
      ...queuedTransaction,
      id: 'bad-split',
      mode: 'split',
      payload: {
        account: 'account-1',
        date: '2026-08-11',
        amount: -20,
        splits: [
          { category: 'food-id', amount: -10 },
          { category: 'home-id', amount: -5 },
        ],
      },
    };
    const stale = {
      ...queuedTransaction,
      id: 'stale',
      payload: { ...transactionPayload, category: 'removed-category' },
    };
    assert.deepEqual(
      parseTransactionQueue(
        JSON.stringify([queuedTransaction, malformed, queuedTransaction, invalidTotal, stale]),
      ),
      [queuedTransaction, stale],
    );
  });

  it('rejects every malformed queued payload boundary', () => {
    const validSplitPayload = {
      account: 'account-1',
      date: '2026-08-11',
      amount: -18.5,
      splits: [
        { category: 'food-id', amount: -10 },
        { category: 'home-id', amount: -8.5 },
      ],
    };
    const cases: [string, unknown][] = [
      ['non-object item', null],
      ['blank outer account', { ...queuedTransaction, account: ' ' }],
      ['blank outer category', { ...queuedTransaction, category: '' }],
      ['non-string error', { ...queuedTransaction, error: 500 }],
      ['unsupported mode', { ...queuedTransaction, mode: 'transfer' }],
      ['non-object payload', { ...queuedTransaction, payload: null }],
      [
        'blank payload account',
        { ...queuedTransaction, payload: { ...transactionPayload, account: ' ' } },
      ],
      [
        'invalid payload date',
        { ...queuedTransaction, payload: { ...transactionPayload, date: '2026-02-31' } },
      ],
      [
        'zero payload amount',
        { ...queuedTransaction, payload: { ...transactionPayload, amount: 0 } },
      ],
      [
        'non-number payload amount',
        { ...queuedTransaction, payload: { ...transactionPayload, amount: '-1' } },
      ],
      ['non-string notes', { ...queuedTransaction, payload: { ...transactionPayload, notes: 1 } }],
      [
        'non-array tags',
        { ...queuedTransaction, payload: { ...transactionPayload, tags: 'weekly-id' } },
      ],
      ['blank tag', { ...queuedTransaction, payload: { ...transactionPayload, tags: [''] } }],
      [
        'missing transaction category',
        { ...queuedTransaction, payload: { ...transactionPayload, category: undefined } },
      ],
      [
        'transaction with splits',
        { ...queuedTransaction, payload: { ...transactionPayload, splits: [] } },
      ],
      [
        'split with top-level category',
        {
          ...queuedTransaction,
          mode: 'split',
          payload: { ...validSplitPayload, category: 'food-id' },
        },
      ],
      [
        'split with fewer than two parts',
        { ...queuedTransaction, mode: 'split', payload: { ...validSplitPayload, splits: [] } },
      ],
      [
        'non-object split',
        {
          ...queuedTransaction,
          mode: 'split',
          payload: { ...validSplitPayload, splits: [null, validSplitPayload.splits[1]] },
        },
      ],
      [
        'blank split category',
        {
          ...queuedTransaction,
          mode: 'split',
          payload: {
            ...validSplitPayload,
            splits: [{ ...validSplitPayload.splits[0], category: '' }, validSplitPayload.splits[1]],
          },
        },
      ],
      [
        'zero split amount',
        {
          ...queuedTransaction,
          mode: 'split',
          payload: {
            ...validSplitPayload,
            splits: [{ ...validSplitPayload.splits[0], amount: 0 }, validSplitPayload.splits[1]],
          },
        },
      ],
      [
        'invalid split tags',
        {
          ...queuedTransaction,
          mode: 'split',
          payload: {
            ...validSplitPayload,
            splits: [{ ...validSplitPayload.splits[0], tags: [''] }, validSplitPayload.splits[1]],
          },
        },
      ],
    ];

    for (const [label, candidate] of cases) {
      assert.deepEqual(parseTransactionQueue(JSON.stringify([candidate])), [], label);
    }
  });

  it('enqueues deterministic collision-safe IDs without mutating the current queue', () => {
    const input = {
      payload: transactionPayload,
      mode: 'transaction' as const,
      account: 'Everyday',
      category: 'Groceries',
      error: 'Offline',
    };
    assert.equal(queuedTransactionBaseId(input), 'queued-2026-08-11-account-1-18.5');
    const current = [
      queuedTransaction,
      { ...queuedTransaction, id: 'queued-2026-08-11-account-1-18.5-2' },
    ];
    const next = enqueueQueuedTransaction(current, input);
    assert.equal(next[0]?.id, 'queued-2026-08-11-account-1-18.5-3');
    assert.equal(next.length, 3);
    assert.equal(current.length, 2);
  });

  it('replaces and removes only the requested queue entry', () => {
    const second = { ...queuedTransaction, id: 'second' };
    const replacement = { ...second, error: 'Still offline' };
    assert.deepEqual(replaceQueuedTransaction([queuedTransaction, second], replacement), [
      queuedTransaction,
      replacement,
    ]);
    const current = [queuedTransaction];
    assert.equal(replaceQueuedTransaction(current, second), current);
    assert.deepEqual(removeQueuedTransaction([queuedTransaction, second], queuedTransaction.id), [
      second,
    ]);
  });
});

describe('receipt preparation', () => {
  it('prepares a normal draft and filters tags that are no longer enabled', () => {
    assert.deepEqual(prepareReceiptDraft(receipt(), references), {
      mode: 'transaction',
      draft: {
        account: 'account-1',
        category: 'food-id',
        date: '2026-08-10',
        amount: '20',
        tags: ['weekly-id'],
        comment: 'Corner Market · Weekly groceries',
        splits: [
          { category: '', amount: '', tags: [] },
          { category: '', amount: '', tags: [] },
        ],
      },
    });
  });

  it('prepares a balanced split draft with absolute amounts and enabled tags', () => {
    const suggestion = receipt().suggestion!;
    const prepared = prepareReceiptDraft(
      receipt({
        suggestion: {
          ...suggestion,
          amount: -20,
          splits: [
            {
              category: 'food-id',
              amount: -12,
              notes: '',
              tags: ['weekly-id', 'removed-tag'],
            },
            { category: 'home-id', amount: 8, notes: '', tags: ['shared-id'] },
          ],
        },
      }),
      references,
    );
    assert.equal(prepared?.mode, 'split');
    assert.deepEqual(prepared?.draft.splits, [
      { category: 'food-id', amount: '12', tags: ['weekly-id'] },
      { category: 'home-id', amount: '8', tags: ['shared-id'] },
    ]);
  });

  it('returns no draft only when the receipt has no suggestion', () => {
    assert.equal(prepareReceiptDraft(receipt({ suggestion: null }), references), null);
  });

  it('clears missing or stale account and category IDs so the draft remains editable', () => {
    const missingAccount = prepareReceiptDraft(receipt({ account: null }), references);
    assert.equal(missingAccount?.draft.account, '');
    assert.equal(missingAccount?.draft.category, 'food-id');
    assert.deepEqual(missingAccount?.draft.tags, ['weekly-id']);

    const staleAccount = prepareReceiptDraft(receipt({ account: 'removed-account' }), references);
    assert.equal(staleAccount?.draft.account, '');

    const suggestion = receipt().suggestion!;
    const staleCategory = prepareReceiptDraft(
      receipt({ suggestion: { ...suggestion, category: 'removed' } }),
      references,
    );
    assert.equal(staleCategory?.draft.account, 'account-1');
    assert.equal(staleCategory?.draft.category, '');
    assert.deepEqual(staleCategory?.draft.tags, ['weekly-id']);
  });

  it('keeps zero totals and unbalanced split suggestions available for correction', () => {
    const suggestion = receipt().suggestion!;
    const zeroTotal = prepareReceiptDraft(
      receipt({ suggestion: { ...suggestion, amount: 0 } }),
      references,
    );
    assert.equal(zeroTotal?.mode, 'transaction');
    assert.equal(zeroTotal?.draft.amount, '0');

    const unbalanced = prepareReceiptDraft(
      receipt({
        suggestion: {
          ...suggestion,
          splits: [
            { category: 'food-id', amount: 10, notes: '', tags: ['weekly-id'] },
            { category: 'home-id', amount: 5, notes: '', tags: ['removed-tag'] },
          ],
        },
      }),
      references,
    );
    assert.equal(unbalanced?.mode, 'split');
    assert.equal(unbalanced?.draft.amount, '20');
    assert.deepEqual(unbalanced?.draft.splits, [
      { category: 'food-id', amount: '10', tags: ['weekly-id'] },
      { category: 'home-id', amount: '5', tags: [] },
    ]);
  });

  it('falls back to a normal draft when fewer than two enabled splits remain', () => {
    const suggestion = receipt().suggestion!;
    assert.equal(
      prepareReceiptDraft(
        receipt({
          suggestion: {
            ...suggestion,
            splits: [
              { category: 'food-id', amount: 10, notes: '', tags: [] },
              { category: 'removed', amount: 10, notes: '', tags: [] },
            ],
          },
        }),
        references,
      )?.mode,
      'transaction',
    );
  });
});

describe('receipt badge policy', () => {
  it('classifies each receipt status and submission state independently', () => {
    const cases: [ApiReceipt['status'], boolean, boolean][] = [
      ['queued', false, true],
      ['queued', true, true],
      ['processing', false, true],
      ['processing', true, true],
      ['processed', false, true],
      ['processed', true, false],
      ['failed', false, false],
      ['failed', true, false],
    ];
    for (const [status, submitted, expected] of cases) {
      assert.equal(isReceiptActionable(receipt({ status, submitted })), expected);
    }
  });

  it('counts queued, processing, and unsubmitted processed receipts only', () => {
    const receipts = [
      receipt({ id: 1, status: 'queued', submitted: false }),
      receipt({ id: 2, status: 'processing', submitted: true }),
      receipt({ id: 3, status: 'processed', submitted: false }),
      receipt({ id: 4, status: 'processed', submitted: true }),
      receipt({ id: 5, status: 'failed', submitted: false }),
    ];
    assert.equal(countActionableReceipts(receipts), 3);
  });
});

describe('transaction page and optimistic models', () => {
  it('merges pages stably while removing duplicate IDs from both inputs', () => {
    const firstA = apiTransaction('a', 'First A');
    const duplicateA = apiTransaction('a', 'Duplicate A');
    const firstB = apiTransaction('b', 'First B');
    const duplicateB = apiTransaction('b', 'Duplicate B');
    const c = apiTransaction('c');
    assert.deepEqual(mergeTransactionPages([firstA, duplicateA, firstB], [duplicateB, c, c]), [
      firstA,
      firstB,
      c,
    ]);
  });

  it('creates normal and split optimistic transactions with display fallbacks', () => {
    assert.deepEqual(
      createConfirmedTransaction({
        id: 'created',
        payload: transactionPayload,
        mode: 'transaction',
        account: 'Everyday',
        category: 'Groceries',
      }),
      {
        id: 'created',
        date: '2026-08-11',
        amount: -18.5,
        account: 'Everyday',
        category: 'Groceries',
        payee: '—',
        notes: 'Market',
        isSplit: false,
      },
    );
    const splitPayload: TransactionPayload = {
      account: 'account-1',
      date: '2026-08-11',
      amount: -20,
      splits: [
        { category: 'food-id', amount: -12 },
        { category: 'home-id', amount: -8 },
      ],
    };
    const split = createConfirmedTransaction({ id: 'split', payload: splitPayload, mode: 'split' });
    assert.equal(split.account, 'Unknown account');
    assert.equal(split.category, 'Split transaction');
    assert.equal(split.isSplit, true);
    assert.deepEqual(split.children, [
      { id: 'split-split-1', category: 'food-id', amount: -12, tags: [] },
      { id: 'split-split-2', category: 'home-id', amount: -8, tags: [] },
    ]);
  });

  it('prepends a confirmed transaction and replaces every stale copy of its ID', () => {
    const old = apiTransaction('created', 'Old');
    const kept = apiTransaction('kept');
    const next = prependConfirmedTransaction([old, kept, old], {
      id: 'created',
      payload: transactionPayload,
      mode: 'transaction',
      account: 'Everyday',
      category: 'Groceries',
    });
    assert.deepEqual(
      next.map(({ id }) => id),
      ['created', 'kept'],
    );
    assert.equal(next[0]?.payee, '—');
  });
});
