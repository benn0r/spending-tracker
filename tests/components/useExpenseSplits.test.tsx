import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useExpenseSplits } from '../../src/hooks/useExpenseSplits';
import type { ExpenseSplitSummary } from '../../src/types';

const mockLoadExpenseSplits = jest.fn();

jest.mock('../../src/api', () => ({
  loadExpenseSplits: () => mockLoadExpenseSplits(),
}));

const cached: ExpenseSplitSummary = {
  id: 7,
  title: 'Moon expedition',
  splitCount: 3,
  transactionCount: 2,
};
const live: ExpenseSplitSummary = {
  id: 8,
  title: 'Dragon household',
  splitCount: 2,
  transactionCount: 4,
};

describe('useExpenseSplits', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('shows cached splits immediately, replaces them from the API, and persists the result', async () => {
    await AsyncStorage.setItem('spending-tracker.expense-splits-v1', JSON.stringify([cached]));
    let resolveLive: (value: ExpenseSplitSummary[]) => void = () => undefined;
    mockLoadExpenseSplits.mockReturnValue(
      new Promise<ExpenseSplitSummary[]>((resolve) => {
        resolveLive = resolve;
      }),
    );
    const { result } = renderHook(() => useExpenseSplits());

    await waitFor(() => expect(result.current.expenseSplits).toEqual([cached]));
    await act(async () => resolveLive([live]));
    await waitFor(() => expect(result.current.expenseSplits).toEqual([live]));
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith(
        'spending-tracker.expense-splits-v1',
        JSON.stringify([live]),
      ),
    );
  });

  it('ignores corrupt cache data and allows a later manual refresh after startup failure', async () => {
    await AsyncStorage.setItem('spending-tracker.expense-splits-v1', '{broken');
    mockLoadExpenseSplits.mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce([live]);
    const { result } = renderHook(() => useExpenseSplits());

    await waitFor(() => expect(mockLoadExpenseSplits).toHaveBeenCalledTimes(1));
    expect(result.current.expenseSplits).toEqual([]);
    await act(async () => result.current.refreshExpenseSplits());
    expect(result.current.expenseSplits).toEqual([live]);
  });
});
