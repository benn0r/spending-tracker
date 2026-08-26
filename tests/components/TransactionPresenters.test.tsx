import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { QueuedTransaction } from '../../src/app-model';
import { SummaryCard } from '../../src/features/transactions/SummaryCard';
import { DateSectionHeader } from '../../src/features/transactions/DateSectionHeader';
import { TransactionQueue } from '../../src/features/transactions/TransactionQueue';
import { TransactionRow } from '../../src/features/transactions/TransactionRow';
import { TransactionsScreen } from '../../src/features/transactions/TransactionsScreen';
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

// SwiftUI hosts are opaque to the React Native test renderer, so exercise the
// screen callbacks through an accessible test double here.
jest.mock('../../src/components/LiquidGlassActionButton', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    LiquidGlassActionButton: ({
      label,
      disabled,
      onPress,
    }: {
      label: string;
      disabled?: boolean;
      onPress: () => void;
    }) =>
      React.createElement(Pressable, {
        accessibilityRole: 'button',
        accessibilityLabel: label,
        disabled,
        onPress,
      }),
  };
});
jest.mock('../../src/components/LiquidGlassButton', () => {
  const React = jest.requireActual<typeof import('react')>('react');
  const { Pressable, Text } = jest.requireActual<typeof import('react-native')>('react-native');
  return {
    LiquidGlassButton: ({
      label,
      accessibilityLabel,
      onPress,
    }: {
      label: string;
      accessibilityLabel?: string;
      onPress: () => void;
    }) =>
      React.createElement(
        Pressable,
        { accessibilityRole: 'button', accessibilityLabel: accessibilityLabel ?? label, onPress },
        React.createElement(Text, null, label),
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
  it('closes transaction details before handing off to the edit form', () => {
    jest.useFakeTimers();
    const onEdit = jest.fn();
    render(
      <TransactionRow item={transaction()} categories={[]} onDelete={jest.fn()} onEdit={onEdit} />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'View details for Comet Rail' }));
    fireEvent.press(screen.getByRole('button', { name: 'Edit transaction' }));
    expect(onEdit).not.toHaveBeenCalled();

    act(() => jest.advanceTimersByTime(320));
    expect(onEdit).toHaveBeenCalledWith(expect.objectContaining({ id: 'skyship-ticket' }));
    jest.useRealTimers();
  });

  it('only deletes from transaction details after confirmation', () => {
    const onDelete = jest.fn();
    render(
      <TransactionRow
        item={transaction()}
        categories={[]}
        onDelete={onDelete}
        onEdit={jest.fn()}
      />,
    );

    expect(screen.queryByTestId('mock-swipe-transaction-skyship-ticket')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete transaction' })).toBeNull();

    fireEvent.press(screen.getByRole('button', { name: 'View details for Comet Rail' }));
    fireEvent.press(screen.getByRole('button', { name: 'Delete transaction' }));
    expect(onDelete).not.toHaveBeenCalled();
    expect(screen.getByText('Delete Comet Rail?')).toBeVisible();

    fireEvent.press(screen.getByRole('button', { name: 'Cancel delete' }));
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.press(screen.getByRole('button', { name: 'Delete transaction' }));
    fireEvent.press(screen.getByRole('button', { name: 'Confirm delete Comet Rail' }));
    expect(onDelete).toHaveBeenCalledWith(expect.objectContaining({ id: 'skyship-ticket' }));
  });

  it('removes the visible close control and can reopen after pull-down dismissal', () => {
    jest.useFakeTimers();
    render(
      <TransactionRow
        item={transaction()}
        categories={[]}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
      />,
    );

    const detailsButton = screen.getByRole('button', { name: 'View details for Comet Rail' });
    fireEvent.press(detailsButton);
    expect(screen.getByTestId('transaction-details-sheet')).toBeVisible();
    expect(screen.getAllByRole('button', { name: 'Close transaction details' })).toHaveLength(1);
    act(() => {
      fireGestureHandler(getByGestureTestId('transaction-details-sheet-pull-down'), [
        { translationY: 0, velocityY: 0 },
        { translationY: 90, velocityY: 1000 },
      ]);
    });
    act(() => jest.advanceTimersByTime(320));
    expect(screen.queryByTestId('transaction-details-sheet')).toBeNull();

    fireEvent.press(detailsButton);
    expect(screen.getByTestId('transaction-details-sheet')).toBeVisible();
    jest.useRealTimers();
  });

  it('offers receipt capture beside the new transaction action', async () => {
    const onScanReceipt = jest.fn().mockResolvedValue(undefined);
    render(
      <TransactionsScreen
        transactions={[transaction()]}
        cashFlow={null}
        categories={[]}
        queuedTransactions={[]}
        retryingTransaction={null}
        loading={false}
        loadingMore={false}
        error=""
        activationRequest={0}
        onRefresh={jest.fn().mockResolvedValue(undefined)}
        onActivationRefresh={jest.fn().mockResolvedValue(undefined)}
        onLoadMore={jest.fn().mockResolvedValue(undefined)}
        onDelete={jest.fn()}
        onEdit={jest.fn()}
        onRetryQueued={jest.fn()}
        onDiscardQueued={jest.fn()}
        onScanReceipt={onScanReceipt}
        onAdd={jest.fn()}
      />,
    );

    expect(screen.getByRole('button', { name: 'Add transaction' })).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Scan receipt' }));
    await waitFor(() => expect(onScanReceipt).toHaveBeenCalledTimes(1));
  });

  it('renders loading, empty, and fatal error states with their actions', async () => {
    const onAdd = jest.fn();
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const props = {
      cashFlow: null,
      categories: [],
      queuedTransactions: [],
      retryingTransaction: null,
      loadingMore: false,
      activationRequest: 0,
      onRefresh,
      onActivationRefresh: jest.fn().mockResolvedValue(undefined),
      onLoadMore: jest.fn().mockResolvedValue(undefined),
      onDelete: jest.fn(),
      onEdit: jest.fn(),
      onRetryQueued: jest.fn(),
      onDiscardQueued: jest.fn(),
      onScanReceipt: jest.fn().mockResolvedValue(undefined),
      onAdd,
    };
    const { rerender } = render(
      <TransactionsScreen {...props} transactions={[]} loading error="" />,
    );
    expect(screen.getByText('Loading your budget…')).toBeVisible();

    rerender(
      <TransactionsScreen
        {...props}
        transactions={[]}
        loading={false}
        error="Budget server unavailable"
      />,
    );
    expect(screen.getByText('Couldn’t load your budget')).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Retry loading transactions' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    rerender(<TransactionsScreen {...props} transactions={[]} loading={false} error="" />);
    expect(screen.getByText('No transactions yet.')).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Add transaction' }));
    expect(onAdd).toHaveBeenCalledTimes(1);
  });

  it('refreshes on activation, retries a nonfatal error, and loads the next page', async () => {
    const onRefresh = jest.fn().mockResolvedValue(undefined);
    const onActivationRefresh = jest.fn().mockResolvedValue(undefined);
    const onLoadMore = jest.fn().mockResolvedValue(undefined);
    const props = {
      transactions: [transaction()],
      cashFlow: null,
      categories: [],
      queuedTransactions: [],
      retryingTransaction: null,
      loading: false,
      loadingMore: false,
      error: 'Last refresh failed',
      onRefresh,
      onActivationRefresh,
      onLoadMore,
      onDelete: jest.fn(),
      onEdit: jest.fn(),
      onRetryQueued: jest.fn(),
      onDiscardQueued: jest.fn(),
      onScanReceipt: jest.fn().mockResolvedValue(undefined),
      onAdd: jest.fn(),
    };
    const { rerender } = render(<TransactionsScreen {...props} activationRequest={0} />);
    expect(screen.getByText(/Last refresh failed/)).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Retry loading transactions' }));
    expect(onRefresh).toHaveBeenCalledTimes(1);

    fireEvent(screen.getByTestId('transactions-list'), 'endReached');
    await waitFor(() => expect(onLoadMore).toHaveBeenCalledTimes(1));
    rerender(<TransactionsScreen {...props} activationRequest={1} />);
    await waitFor(() => expect(onActivationRefresh).toHaveBeenCalledTimes(1));
  });

  it('shows a signed daily total and renders the sticky glass effect', () => {
    render(<DateSectionHeader date="2026-08-12" total={-37.5} elevated />);

    expect(screen.getByText('− CHF 37.50')).toBeVisible();
    expect(screen.getByTestId('sticky-date-effect')).toBeOnTheScreen();
    expect(screen.getByTestId('glass-background')).toBeVisible();
  });

  it('rounds the outside edges of a daily transaction glass group', () => {
    const item = transaction();
    const { rerender } = render(
      <TransactionRow item={item} categories={[]} groupPosition="first" onDelete={jest.fn()} />,
    );

    expect(screen.getByTestId(`transaction-group-${item.id}`)).toHaveStyle({
      borderTopLeftRadius: 18,
      borderTopRightRadius: 18,
    });

    rerender(
      <TransactionRow item={item} categories={[]} groupPosition="last" onDelete={jest.fn()} />,
    );
    expect(screen.getByTestId(`transaction-group-${item.id}`)).toHaveStyle({
      borderBottomLeftRadius: 18,
      borderBottomRightRadius: 18,
    });
  });

  it('summarizes income, spending, and available balance', () => {
    render(
      <SummaryCard
        cashFlow={{
          currency: 'CHF',
          currentMonth: '2026-08',
          months: [{ month: '2026-08', income: 100, expenses: 25.5, net: 74.5 }],
        }}
      />,
    );

    expect(screen.getByText(/74\.50/)).toBeVisible();
    expect(screen.getByText(/100\.00/)).toBeVisible();
    expect(screen.getByText(/25\.50/)).toBeVisible();
    expect(screen.getAllByTestId('glass-background')).toHaveLength(5);
  });

  it('renders server category visuals, fallbacks, and signed amounts', () => {
    const expense = transaction({ cleared: true });
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
    expect(screen.getByLabelText('Account Moonlight Wallet')).toBeVisible();
    expect(screen.getByLabelText('Verified in Actual Budget')).toBeVisible();
    expect(screen.getByText('− CHF 25.50')).toBeVisible();
    expect(screen.getByTestId('icon-airplane-outline')).toBeVisible();
    rerender(
      <TransactionRow
        item={transaction({ notes: 'Night train', tags: ['holiday', 'shared'] })}
        categories={[]}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Night train')).toBeVisible();
    expect(screen.getByText('#holiday')).toBeVisible();
    expect(screen.getByText('#shared')).toBeVisible();
    expect(screen.getByLabelText('Account Moonlight Wallet')).toBeVisible();
    expect(screen.queryByLabelText('Verified in Actual Budget')).toBeNull();

    rerender(
      <TransactionRow
        item={transaction({ id: 'income', amount: 40, category: 'Income', payee: '—' })}
        categories={[]}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByText('Income')).toBeVisible();
    expect(screen.getByText('+ CHF 40.00')).toBeVisible();
    expect(screen.getAllByTestId('icon-wallet-outline')).toHaveLength(2);

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

  it('presents Actual Budget transfers with their destination account', () => {
    render(
      <TransactionRow
        item={transaction({
          id: 'transfer',
          type: 'Transfer',
          category: 'Uncategorized',
          payee: 'Transfer: Cloud Vault',
          transferAccount: 'Cloud Vault',
        })}
        categories={[]}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText('Transfer')).toBeVisible();
    expect(screen.getByText('To Cloud Vault')).toBeVisible();
    expect(screen.getByTestId('icon-swap-horizontal-outline')).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'View details for Transfer' }));
    expect(screen.getByText('To account')).toBeVisible();
    expect(screen.getByText('Cloud Vault')).toBeVisible();
  });

  it('nests Actual Budget split children beneath their parent transaction', () => {
    render(
      <TransactionRow
        item={transaction({
          id: 'expedition-split',
          amount: -30,
          isSplit: true,
          children: [
            {
              id: 'split-food',
              category: 'Food & Drink',
              amount: -12,
              notes: 'Trail snacks',
              tags: ['shared'],
            },
            {
              id: 'split-travel',
              category: 'Skyship Travel',
              amount: -18,
              tags: [],
            },
          ],
        })}
        categories={[]}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByLabelText('Split transaction')).toBeVisible();
    expect(screen.getByLabelText(/Split entry 1 of 2: Food & Drink/)).toHaveStyle({
      minHeight: 44,
      borderWidth: 0,
      backgroundColor: 'rgba(255, 255, 255, 0.2)',
      paddingLeft: 21,
      paddingRight: 12,
    });
    expect(screen.getByLabelText(/Split entry 2 of 2: Skyship Travel/)).toBeVisible();
    expect(screen.getByText('− CHF 12.00')).toBeVisible();
    expect(screen.getByText('− CHF 18.00')).toBeVisible();
    expect(screen.getByText('#shared')).toBeVisible();

    fireEvent.press(screen.getByRole('button', { name: 'View details for Comet Rail' }));
    expect(screen.getByText('Split entries')).toBeVisible();
  });

  it('labels split parents instead of showing Uncategorized', () => {
    const { rerender } = render(
      <TransactionRow
        item={transaction({
          id: 'plain-split',
          category: 'Uncategorized',
          payee: '—',
          isSplit: true,
        })}
        categories={[]}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText('Split transaction')).toBeVisible();
    expect(screen.queryByText('Uncategorized')).toBeNull();

    rerender(
      <TransactionRow
        item={transaction({
          id: 'shared-split',
          category: 'Uncategorized',
          payee: '—',
          isSplit: true,
          expenseSplitId: 7,
        })}
        categories={[]}
        onDelete={jest.fn()}
      />,
    );

    expect(screen.getByText('Shared expense')).toBeVisible();
    expect(screen.queryByText('Uncategorized')).toBeNull();
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
