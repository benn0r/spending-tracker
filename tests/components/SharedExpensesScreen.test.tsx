import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { RefreshControl } from 'react-native';

import { loadExpenseSplit } from '../../src/api';
import { SharedExpensesScreen } from '../../src/features/splits/SharedExpensesScreen';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('../../src/api', () => ({ loadExpenseSplit: jest.fn() }));

const mockedLoadExpenseSplit = jest.mocked(loadExpenseSplit);

it('lists shared expenses with balances and opens their transactions', async () => {
  mockedLoadExpenseSplit.mockResolvedValue({
    id: 4,
    title: 'Dragon expedition',
    splitCount: 2,
    transactionCount: 1,
    totalAmount: -80,
    balance: 40,
    currency: 'CHF',
    entries: [
      {
        id: 9,
        kind: 'transaction',
        transactionId: 'actual-9',
        description: 'Moonlit inn',
        amount: -80,
        date: '2026-08-15',
        wallet: 'Travel',
        categoryName: 'Hotels',
      },
    ],
    settlements: [],
  });
  render(
    <SharedExpensesScreen
      splits={[
        {
          id: 4,
          title: 'Dragon expedition',
          splitCount: 2,
          transactionCount: 1,
          totalAmount: -80,
          balance: 40,
          currency: 'CHF',
        },
      ]}
      loading={false}
      onRefresh={jest.fn().mockResolvedValue(undefined)}
    />,
  );

  expect(screen.getByText('Shared expenses')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'View shared expense Dragon expedition' }));
  await waitFor(() => expect(screen.getByText('Moonlit inn')).toBeVisible());
  expect(mockedLoadExpenseSplit).toHaveBeenCalledWith(4);
});

it('refreshes, reports detail errors, and closes the detail drawer', async () => {
  jest.useFakeTimers();
  const onRefresh = jest.fn().mockResolvedValue(undefined);
  mockedLoadExpenseSplit.mockRejectedValueOnce(new Error('Split unavailable'));
  render(
    <SharedExpensesScreen
      splits={[
        {
          id: 4,
          title: 'Dragon expedition',
          splitCount: 2,
          transactionCount: 1,
          totalAmount: -80,
          balance: 40,
          currency: 'CHF',
        },
      ]}
      loading={false}
      onRefresh={onRefresh}
    />,
  );
  act(() => screen.UNSAFE_getByType(RefreshControl).props.onRefresh());
  expect(onRefresh).toHaveBeenCalledTimes(1);
  fireEvent.press(screen.getByRole('button', { name: 'View shared expense Dragon expedition' }));
  expect(await screen.findByText('Split unavailable')).toBeVisible();
  fireEvent.press(screen.getByRole('button', { name: 'Close shared expense details' }));
  act(() => jest.advanceTimersByTime(320));
  expect(screen.queryByText('Split unavailable')).toBeNull();
  jest.useRealTimers();
});

it('shows empty and loading states and delegates back navigation', () => {
  const onBack = jest.fn();
  const { rerender } = render(
    <SharedExpensesScreen splits={[]} loading onRefresh={jest.fn()} onBack={onBack} />,
  );
  expect(screen.queryByText('No shared expenses yet.')).toBeNull();
  fireEvent.press(screen.getByRole('button', { name: 'Back to More' }));
  expect(onBack).toHaveBeenCalledTimes(1);
  rerender(<SharedExpensesScreen splits={[]} loading={false} onRefresh={jest.fn()} />);
  expect(screen.getByText('No shared expenses yet.')).toBeVisible();
});
