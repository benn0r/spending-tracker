import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';

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
