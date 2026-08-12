import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import type { QueuedTransaction } from '../../src/app-model';
import { useTransactionQueue } from '../../src/hooks/useTransactionQueue';

const mockSubmitTransaction = jest.fn();
const mockDescribeSubmissionError = jest.fn((cause: unknown) =>
  cause instanceof Error ? cause.message : String(cause),
);

jest.mock('../../src/api', () => ({
  submitTransaction: (...args: unknown[]) => mockSubmitTransaction(...args),
  describeSubmissionError: (cause: unknown) => mockDescribeSubmissionError(cause),
}));

const queued: QueuedTransaction = {
  id: 'queued-2026-08-12-moonlight-wallet-12-1',
  payload: {
    account: 'moonlight-wallet',
    category: 'enchanted-groceries',
    date: '2026-08-12',
    amount: -12,
  },
  mode: 'transaction',
  account: 'Moonlight Wallet',
  category: 'Enchanted Groceries',
  error: 'Moon gate offline',
};

describe('useTransactionQueue', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('hydrates stored entries, enqueues collision-safe items, and persists the result', async () => {
    await AsyncStorage.setItem('spending-tracker.transaction-queue', JSON.stringify([queued]));
    const { result } = renderHook(() =>
      useTransactionQueue({ onConfirmed: jest.fn(), onRefresh: jest.fn() }),
    );
    await waitFor(() => expect(result.current.items).toEqual([queued]));

    act(() =>
      result.current.enqueue({
        payload: queued.payload,
        mode: queued.mode,
        account: queued.account,
        category: queued.category,
        error: 'Still offline',
      }),
    );
    expect(result.current.items.map(({ id }) => id)).toEqual([
      'queued-2026-08-12-moonlight-wallet-12-2',
      queued.id,
    ]);
    await waitFor(async () => {
      const stored = await AsyncStorage.getItem('spending-tracker.transaction-queue');
      expect(JSON.parse(stored ?? '[]')).toHaveLength(2);
    });
  });

  it('retries the exact payload, confirms it, refreshes, and removes persisted state', async () => {
    await AsyncStorage.setItem('spending-tracker.transaction-queue', JSON.stringify([queued]));
    mockSubmitTransaction.mockResolvedValue({ id: 'confirmed-expense', status: 'created' });
    const onConfirmed = jest.fn();
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const { result } = renderHook(() => useTransactionQueue({ onConfirmed, onRefresh }));
    await waitFor(() => expect(result.current.items).toEqual([queued]));

    await act(async () => result.current.retry(queued));
    expect(mockSubmitTransaction).toHaveBeenCalledWith(queued.payload);
    expect(onConfirmed).toHaveBeenCalledWith({
      id: 'confirmed-expense',
      payload: queued.payload,
      mode: 'transaction',
      account: 'Moonlight Wallet',
      category: 'Enchanted Groceries',
    });
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(result.current.items).toEqual([]);
    expect(result.current.retryingId).toBeNull();
    await waitFor(() =>
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('spending-tracker.transaction-queue'),
    );
  });

  it('replaces retry diagnostics on failure and lets the user discard the item', async () => {
    await AsyncStorage.setItem('spending-tracker.transaction-queue', JSON.stringify([queued]));
    mockSubmitTransaction.mockRejectedValue(new Error('Server still unavailable'));
    const { result } = renderHook(() =>
      useTransactionQueue({ onConfirmed: jest.fn(), onRefresh: jest.fn() }),
    );
    await waitFor(() => expect(result.current.items).toEqual([queued]));

    await act(async () => result.current.retry(queued));
    expect(result.current.items[0]?.error).toBe('Server still unavailable');
    expect(result.current.retryingId).toBeNull();
    act(() => result.current.discard(result.current.items[0]!));
    expect(result.current.items).toEqual([]);
  });
});
