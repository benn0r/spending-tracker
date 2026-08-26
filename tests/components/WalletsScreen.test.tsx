import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';

import * as api from '../../src/api';
import { WalletsScreen } from '../../src/features/wallets/WalletsScreen';
import type { ApiTransaction } from '../../src/types';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../src/api', () => ({
  deleteTransaction: jest.fn(),
  loadCashFlow: jest.fn(),
  loadTransactionPage: jest.fn(),
}));
jest.mock('../../src/features/transactions/TransactionRow', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text, View } =
    jest.requireActual<typeof import('react-native')>('react-native');
  return {
    TransactionRow: ({
      item,
      onDelete,
    }: {
      item: ApiTransaction;
      onDelete: (item: ApiTransaction) => void;
    }) =>
      React.createElement(
        View,
        null,
        React.createElement(Text, null, item.payee),
        React.createElement(Pressable, {
          accessibilityRole: 'button',
          accessibilityLabel: `Delete row ${item.id}`,
          onPress: () => onDelete(item),
        }),
      ),
  };
});

const accounts = [
  { id: 'moonlight', name: 'Moonlight Wallet' },
  { id: 'dragon', name: 'Dragon Hoard' },
];
const baseTransaction: ApiTransaction = {
  id: 'tx-1',
  date: '2026-08-25',
  amount: -12,
  account: 'Moonlight Wallet',
  category: 'Groceries',
  payee: 'Moonbeam Market',
  isSplit: false,
};

describe('WalletsScreen', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
    jest.mocked(api.loadCashFlow).mockResolvedValue({
      currency: 'CHF',
      balance: 125,
      currentMonth: '2026-08',
      months: [{ month: '2026-08', income: 200, expenses: 75, net: 125 }],
    });
    jest.mocked(api.loadTransactionPage).mockResolvedValue({
      transactions: [baseTransaction],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    jest.mocked(api.deleteTransaction).mockResolvedValue(undefined);
  });

  it('loads the default account, metrics, refreshes, and switches accounts', async () => {
    render(<WalletsScreen accounts={accounts} categories={[]} defaultAccount="dragon" />);
    expect(await screen.findByText('Moonbeam Market')).toBeVisible();
    expect(api.loadTransactionPage).toHaveBeenCalledWith(1, 20, 'dragon', 'Dragon Hoard');
    expect(screen.getAllByText('CHF 125.00')).toHaveLength(2);

    act(() => screen.UNSAFE_getByType(RefreshControl).props.onRefresh());
    await waitFor(() => expect(api.loadTransactionPage).toHaveBeenCalledTimes(2));

    fireEvent.press(screen.getByRole('button', { name: 'Select account' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Moonlight Wallet' }));
    await waitFor(() =>
      expect(api.loadTransactionPage).toHaveBeenCalledWith(1, 20, 'moonlight', 'Moonlight Wallet'),
    );
  });

  it('restores cached rows immediately, loads more once, and persists merged data', async () => {
    await AsyncStorage.setItem(
      'spending-tracker-account-cache:moonlight',
      JSON.stringify({ transactions: [baseTransaction], total: 2 }),
    );
    jest
      .mocked(api.loadTransactionPage)
      .mockResolvedValueOnce({ transactions: [baseTransaction], page: 1, pageSize: 20, total: 2 })
      .mockResolvedValueOnce({
        transactions: [{ ...baseTransaction, id: 'tx-2', payee: 'Starlight Shop' }],
        page: 2,
        pageSize: 20,
        total: 2,
      });
    render(<WalletsScreen accounts={accounts} categories={[]} defaultAccount="moonlight" />);
    expect(await screen.findByText('Moonbeam Market')).toBeVisible();
    await waitFor(() => expect(api.loadTransactionPage).toHaveBeenCalledTimes(1));
    fireEvent(screen.getByTestId('wallets-list'), 'endReached');
    expect(await screen.findByText('Starlight Shop')).toBeVisible();
    expect(api.loadTransactionPage).toHaveBeenLastCalledWith(
      2,
      20,
      'moonlight',
      'Moonlight Wallet',
    );
  });

  it('shows empty and error states and restores a failed optimistic delete', async () => {
    const { rerender } = render(<WalletsScreen accounts={[]} categories={[]} defaultAccount="" />);
    expect(await screen.findByText('No accounts are enabled.')).toBeVisible();

    jest.mocked(api.loadTransactionPage).mockRejectedValueOnce(new Error('Account unavailable'));
    rerender(<WalletsScreen accounts={accounts} categories={[]} defaultAccount="moonlight" />);
    expect(await screen.findByText('Account unavailable')).toBeVisible();

    jest.mocked(api.loadTransactionPage).mockResolvedValue({
      transactions: [baseTransaction],
      page: 1,
      pageSize: 20,
      total: 1,
    });
    fireEvent(screen.UNSAFE_getByType(RefreshControl), 'refresh');
    expect(await screen.findByText('Moonbeam Market')).toBeVisible();
    jest.mocked(api.deleteTransaction).mockRejectedValueOnce(new Error('Delete failed'));
    fireEvent.press(screen.getByRole('button', { name: 'Delete row tx-1' }));
    await waitFor(() => expect(api.deleteTransaction).toHaveBeenCalledWith('tx-1'));
    await waitFor(() => expect(screen.getByText('Moonbeam Market')).toBeVisible());
  });
});
