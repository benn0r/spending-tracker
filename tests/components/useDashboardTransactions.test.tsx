import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useDashboardTransactions } from '../../src/hooks/useDashboardTransactions';
import type { ApiTransaction, References, TransactionPage } from '../../src/types';

const mockLoadDashboard = jest.fn();
const mockLoadTransactionPage = jest.fn();
const mockDeleteTransaction = jest.fn();

jest.mock('../../src/api', () => ({
  loadDashboard: () => mockLoadDashboard(),
  loadTransactionPage: (...args: unknown[]) => mockLoadTransactionPage(...args),
  deleteTransaction: (id: string) => mockDeleteTransaction(id),
}));

const references: References = {
  accounts: [{ id: 'moonlight-wallet', name: 'Moonlight Wallet' }],
  categories: [{ id: 'enchanted-groceries', name: 'Enchanted Groceries' }],
  tags: [],
};

function transaction(id: string, payee = id): ApiTransaction {
  return {
    id,
    date: '2026-08-12',
    amount: -10,
    account: 'Moonlight Wallet',
    category: 'Enchanted Groceries',
    payee,
    isSplit: false,
  };
}

function page(items: ApiTransaction[], total = items.length, currentPage = 1): TransactionPage {
  return { transactions: items, total, page: currentPage, pageSize: 20 };
}

describe('useDashboardTransactions', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('shows a valid cache immediately and replaces it with the live dashboard', async () => {
    const cached = transaction('cached', 'Cached Moon Market');
    const live = transaction('live', 'Live Star Market');
    await AsyncStorage.setItem('spending-tracker.transactions-v1', JSON.stringify([cached]));
    await AsyncStorage.setItem('spending-tracker.references-v1', JSON.stringify(references));
    let resolveDashboard: (value: { references: References; page: TransactionPage }) => void = () =>
      undefined;
    mockLoadDashboard.mockReturnValue(
      new Promise((resolve) => {
        resolveDashboard = resolve;
      }),
    );
    const onReferencesLoaded = jest.fn();
    const { result } = renderHook(() => useDashboardTransactions(onReferencesLoaded));

    await waitFor(() => expect(result.current.transactions).toEqual([cached]));
    expect(result.current.references).toEqual(references);
    expect(result.current.loading).toBe(true);

    await act(async () => resolveDashboard({ references, page: page([live]) }));
    await waitFor(() => expect(result.current.transactions).toEqual([live]));
    expect(result.current.loading).toBe(false);
    expect(onReferencesLoaded).toHaveBeenCalledWith(references);
    await waitFor(async () => {
      const stored = await AsyncStorage.getItem('spending-tracker.transactions-v1');
      expect(JSON.parse(stored ?? '[]')).toEqual([live]);
    });
  });

  it('loads one next page at a time and merges duplicate transaction IDs stably', async () => {
    const first = transaction('first');
    const second = transaction('second');
    const third = transaction('third');
    mockLoadDashboard.mockResolvedValue({ references, page: page([first, second], 3) });
    const onReferencesLoaded = jest.fn();
    let resolveNextPage: (value: TransactionPage) => void = () => undefined;
    mockLoadTransactionPage.mockReturnValue(
      new Promise((resolve) => {
        resolveNextPage = resolve;
      }),
    );
    const { result } = renderHook(() => useDashboardTransactions(onReferencesLoaded));
    await waitFor(() => expect(result.current.loading).toBe(false));

    let firstRequest!: Promise<void>;
    act(() => {
      firstRequest = result.current.loadMoreTransactions();
      void result.current.loadMoreTransactions();
    });
    expect(mockLoadTransactionPage).toHaveBeenCalledTimes(1);
    expect(mockLoadTransactionPage).toHaveBeenCalledWith(2);
    await act(async () => {
      resolveNextPage(page([second, third], 3, 2));
      await firstRequest;
    });
    await waitFor(() =>
      expect(result.current.transactions.map(({ id }) => id)).toEqual(['first', 'second', 'third']),
    );

    await act(async () => result.current.loadMoreTransactions());
    expect(mockLoadTransactionPage).toHaveBeenCalledTimes(1);
  });

  it('prepends confirmations and restores an optimistic deletion after API failure', async () => {
    const existing = transaction('existing', 'Existing Moon Market');
    mockLoadDashboard.mockResolvedValue({ references, page: page([existing]) });
    mockDeleteTransaction.mockRejectedValue(new Error('Delete failed'));
    const onReferencesLoaded = jest.fn();
    const { result } = renderHook(() => useDashboardTransactions(onReferencesLoaded));
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() =>
      result.current.addConfirmedTransaction(
        'confirmed',
        {
          account: 'moonlight-wallet',
          category: 'enchanted-groceries',
          date: '2026-08-12',
          amount: -7,
        },
        'transaction',
        'Moonlight Wallet',
        'Enchanted Groceries',
      ),
    );
    expect(result.current.transactions.map(({ id }) => id)).toEqual(['confirmed', 'existing']);

    act(() => result.current.removeTransaction(existing));
    expect(result.current.transactions.map(({ id }) => id)).toEqual(['confirmed']);
    expect(mockDeleteTransaction).toHaveBeenCalledWith('existing');
    await waitFor(() => expect(mockLoadDashboard).toHaveBeenCalledTimes(2));
    await waitFor(() => expect(result.current.transactions).toEqual([existing]));
    expect(result.current.error).toBe('');
  });
});
