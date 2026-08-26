import { prepareTransactionEdit } from '../../src/features/transactions/prepareTransactionEdit';
import type { ApiTransaction, References } from '../../src/types';

const references: References = {
  accounts: [
    { id: 'account-a', name: 'Moonlight Wallet' },
    { id: 'account-b', name: 'Dragon Hoard' },
  ],
  categories: [
    { id: 'food', name: 'Enchanted Groceries' },
    { id: 'travel', name: 'Skyship Travel' },
    { id: 'advance', name: 'Guild Advance' },
  ],
  tags: [
    { id: 'weekly', name: 'Weekly Quest' },
    { id: 'guild', name: 'Guild Shared' },
  ],
};

function transaction(overrides: Partial<ApiTransaction> = {}): ApiTransaction {
  return {
    id: 'transaction-1',
    date: '2026-08-20',
    amount: -24.5,
    account: 'Moonlight Wallet',
    category: 'Enchanted Groceries',
    payee: 'Moonbeam Market',
    notes: 'Lantern oil',
    tags: ['Weekly Quest'],
    isSplit: false,
    ...overrides,
  };
}

describe('prepareTransactionEdit', () => {
  it('prepares a regular transaction and drops stale references', () => {
    expect(
      prepareTransactionEdit(
        transaction({ account: 'Removed wallet', category: 'Removed category', tags: ['Removed'] }),
        references,
      ),
    ).toEqual({
      mode: 'transaction',
      draft: {
        account: '',
        category: '',
        date: '2026-08-20',
        amount: '24.5',
        tags: [],
        comment: 'Lantern oil',
        splits: [
          { category: '', amount: '', tags: [] },
          { category: '', amount: '', tags: [] },
        ],
      },
    });
  });

  it('restores categories, tags, and amounts for a regular Actual Budget split', () => {
    const prepared = prepareTransactionEdit(
      transaction({
        amount: -30,
        isSplit: true,
        children: [
          {
            id: 'child-a',
            category: 'Enchanted Groceries',
            amount: -18,
            tags: ['Weekly Quest'],
          },
          {
            id: 'child-b',
            category: 'Skyship Travel',
            amount: -12,
            tags: ['Guild Shared', 'Removed'],
          },
        ],
      }),
      references,
    );

    expect(prepared.mode).toBe('split');
    expect(prepared.draft).toMatchObject({
      account: 'account-a',
      category: 'food',
      amount: '30',
      tags: ['weekly'],
      splits: [
        { category: 'food', amount: '18', tags: ['weekly'] },
        { category: 'travel', amount: '12', tags: ['guild'] },
      ],
    });
  });

  it('hides the shared-expense advance posting and reconstructs the user shares exactly', () => {
    const prepared = prepareTransactionEdit(
      transaction({
        amount: -10,
        isSplit: true,
        expenseSplitId: 7,
        expenseSplitCount: 3,
        sharedExpenseCategory: 'Guild Advance',
        children: [
          {
            id: 'advance',
            category: 'Guild Advance',
            amount: -6.67,
            tags: [],
          },
          {
            id: 'food',
            category: 'Enchanted Groceries',
            amount: -2.22,
            tags: ['Weekly Quest'],
          },
          {
            id: 'travel',
            category: 'Skyship Travel',
            amount: -1.11,
            tags: ['Guild Shared'],
          },
        ],
      }),
      references,
    );

    expect(prepared.mode).toBe('split');
    expect(prepared.draft.category).toBe('food');
    expect(prepared.draft.splits).toEqual([
      { category: 'food', amount: '6.66', tags: ['weekly'] },
      { category: 'travel', amount: '3.34', tags: ['guild'] },
    ]);
  });

  it('uses a single visible child as a regular shared expense and tolerates missing notes', () => {
    const prepared = prepareTransactionEdit(
      transaction({
        notes: undefined,
        tags: undefined,
        expenseSplitId: 8,
        expenseSplitCount: undefined,
        sharedExpenseCategory: 'Guild Advance',
        children: [
          { id: 'advance', category: 'Guild Advance', amount: -12, tags: [] },
          { id: 'food', category: 'Enchanted Groceries', amount: -12, tags: [] },
        ],
      }),
      references,
    );

    expect(prepared.mode).toBe('transaction');
    expect(prepared.draft.comment).toBe('');
    expect(prepared.draft.category).toBe('food');
    expect(prepared.draft.tags).toEqual([]);
  });
});
