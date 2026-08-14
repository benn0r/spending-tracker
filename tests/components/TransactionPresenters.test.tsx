import { fireEvent, render, screen } from '@testing-library/react-native';

import type { QueuedTransaction } from '../../src/app-model';
import { SummaryCard } from '../../src/features/transactions/SummaryCard';
import { TransactionQueue } from '../../src/features/transactions/TransactionQueue';
import { TransactionRow } from '../../src/features/transactions/TransactionRow';
import type { ApiTransaction } from '../../src/types';

jest.mock('@expo/vector-icons/Ionicons', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Text } = jest.requireActual<typeof import('react-native')>('react-native');
  const MockIonicons = ({ name }: { name: string }) =>
    React.createElement(Text, { testID: `icon-${name}` }, name);
  return Object.assign(MockIonicons, {
    glyphMap: {
      'airplane-outline': 1,
      'basket-outline': 2,
      'cloud-offline-outline': 3,
      'git-branch-outline': 4,
      'home-outline': 5,
      pricetag: 6,
      'receipt-outline': 7,
      refresh: 8,
      'train-outline': 9,
      'wallet-outline': 10,
    },
  });
});

jest.mock('../../src/components/SwipeToDelete', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, View } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    SwipeToDelete: ({
      children,
      id,
      label,
      onDelete,
    }: {
      children: React.ReactNode;
      id: string;
      label: string;
      onDelete: () => void;
    }) =>
      React.createElement(
        View,
        { testID: `mock-swipe-${id}` },
        React.createElement(Pressable, {
          accessibilityRole: 'button',
          accessibilityLabel: `Delete ${label}`,
          onPress: onDelete,
        }),
        children,
      ),
  };
});

function transaction(overrides: Partial<ApiTransaction> = {}): ApiTransaction {
  return {
    id: 'skyship-ticket',
    date: '2026-08-12',
    amount: -25.5,
    account: 'Moonlight Wallet',
    category: 'Skyship Travel',
    payee: 'Comet Rail',
    isSplit: false,
    ...overrides,
  };
}

const queuedExpense: QueuedTransaction = {
  id: 'queued-groceries',
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

const queuedTravel: QueuedTransaction = {
  ...queuedExpense,
  id: 'queued-travel',
  payload: { ...queuedExpense.payload, category: 'skyship-travel', amount: -8 },
  category: 'Skyship Travel',
  error: 'Sky route unavailable',
};

describe('transaction presentation', () => {
  it('summarizes income, spending, and available balance', () => {
    render(<SummaryCard transactions={[transaction({ amount: 100 }), transaction()]} />);

    expect(screen.getByText('CHF 74.50')).toBeVisible();
    expect(screen.getByText('CHF 100')).toBeVisible();
    expect(screen.getByText('CHF 25.5')).toBeVisible();
  });

  it('renders server category visuals, fallbacks, signed amounts, and deletion', () => {
    const expense = transaction();
    const onDelete = jest.fn();
    const { rerender } = render(
      <TransactionRow
        item={expense}
        categories={[
          {
            id: 'skyship-travel',
            name: 'skyship travel',
            icon: 'airplane-outline',
            color: '#3C91C9',
          },
        ]}
        onDelete={onDelete}
      />,
    );

    expect(screen.getByText('Comet Rail')).toBeVisible();
    expect(screen.getByText('Skyship Travel · Moonlight Wallet')).toBeVisible();
    expect(screen.getByText('− CHF 25.50')).toBeVisible();
    expect(screen.getByTestId('icon-airplane-outline')).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Delete Comet Rail' }));
    expect(onDelete).toHaveBeenCalledWith(expense);

    rerender(
      <TransactionRow
        item={transaction({ id: 'income', amount: 40, category: 'Income', payee: '—' })}
        categories={[]}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Income')).toBeVisible();
    expect(screen.getByText('+ CHF 40.00')).toBeVisible();
    expect(screen.getByTestId('icon-wallet-outline')).toBeVisible();

    rerender(
      <TransactionRow
        item={transaction({ id: 'salary', amount: 40, category: 'Salary', payee: '—' })}
        categories={[
          {
            id: 'salary',
            name: 'Salary',
            iconId: 34,
            color: '#28AAC4',
          },
        ]}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByTestId('icon-cash-outline')).toBeVisible();

    rerender(
      <TransactionRow
        item={transaction({ id: 'home', category: 'Home', payee: '—' })}
        categories={[]}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Home')).toBeVisible();
    expect(screen.getByTestId('icon-home-outline')).toBeVisible();
  });

  it('hides an empty queue and wires enabled retry and discard actions', () => {
    const onRetry = jest.fn();
    const onDiscard = jest.fn();
    const { rerender } = render(
      <TransactionQueue items={[]} retrying={null} onRetry={onRetry} onDiscard={onDiscard} />,
    );
    expect(screen.queryByTestId('transaction-queue')).toBeNull();

    rerender(
      <TransactionQueue
        items={[queuedExpense, queuedTravel]}
        retrying="queued-groceries"
        onRetry={onRetry}
        onDiscard={onDiscard}
      />,
    );
    expect(screen.getByText('Waiting to sync')).toBeVisible();
    expect(screen.getByText('2')).toBeVisible();
    expect(screen.getByText('Moon gate offline')).toBeVisible();
    expect(screen.getByText('− CHF 12.00')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Retry Enchanted Groceries' })).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Remove Enchanted Groceries from queue' }),
    ).toBeDisabled();

    fireEvent.press(screen.getByRole('button', { name: 'Retry Skyship Travel' }));
    fireEvent.press(screen.getByRole('button', { name: 'Remove Skyship Travel from queue' }));
    expect(onRetry).toHaveBeenCalledWith(queuedTravel);
    expect(onDiscard).toHaveBeenCalledWith(queuedTravel);
  });
});
