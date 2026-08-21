import { fireEvent, render, screen, waitFor, within } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Animated } from 'react-native';

import { EntrySheet } from '../../src/features/transactions/EntrySheet';
import type { References } from '../../src/types';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');
jest.mock('@react-native-picker/picker', () => {
  const { View } = jest.requireActual('react-native');
  function PickerMock({ children, ...props }: { children: ReactNode }) {
    return <View {...props}>{children}</View>;
  }
  function PickerItemMock() {
    return null;
  }
  const Picker = Object.assign(PickerMock, { Item: PickerItemMock });
  return { Picker };
});

const references: References = {
  accounts: [
    { id: 'everyday', name: 'Everyday' },
    { id: 'savings', name: 'Savings' },
  ],
  categories: [
    { id: 'groceries', name: 'Groceries' },
    { id: 'home', name: 'Home' },
  ],
  tags: [
    { id: 'weekly', name: 'Weekly' },
    { id: 'shared', name: 'Shared' },
  ],
};

describe('EntrySheet', () => {
  it('restarts the bottom-up drawer animation every time the form opens', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const props = {
      references,
      defaultAccount: 'everyday',
      onClose: jest.fn(),
      onSave: jest.fn().mockResolvedValue(undefined),
    };
    const { rerender } = render(<EntrySheet {...props} visible={false} />);
    const callsWhileClosed = timing.mock.calls.length;

    rerender(<EntrySheet {...props} visible />);

    expect(timing.mock.calls.length).toBeGreaterThan(callsWhileClosed);
    expect(
      timing.mock.calls
        .slice(callsWhileClosed)
        .some(([, configuration]) => configuration.toValue === 0),
    ).toBe(true);
    timing.mockRestore();
  });

  it('prefills every editable field and keeps shared-expense membership when editing', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <EntrySheet
        visible
        references={references}
        expenseSplits={[{ id: 7, title: 'Dragon expedition', splitCount: 2, transactionCount: 1 }]}
        defaultAccount="everyday"
        initialDraft={{
          account: 'savings',
          category: 'groceries',
          date: '2026-08-15',
          amount: '42.50',
          tags: ['weekly'],
          comment: 'Market visit',
          splits: [
            { category: 'groceries', amount: '20', tags: [] },
            { category: 'home', amount: '22.50', tags: ['weekly'] },
          ],
        }}
        initialExpenseSplitId={7}
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByText('Edit transaction')).toBeVisible();
    expect(screen.getByLabelText('Amount')).toHaveDisplayValue('42.50');
    expect(screen.getByLabelText('Comment')).toHaveDisplayValue('Market visit');
    expect(screen.getByRole('checkbox', { name: 'Add to shared expenses' })).toBeChecked();
    fireEvent.press(screen.getByRole('button', { name: 'Save changes' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]?.[2]).toEqual({ mode: 'existing', splitId: 7 });
  });
  it('assigns an expense to an existing or newly created sharing split', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    const { rerender } = render(
      <EntrySheet
        visible
        references={references}
        expenseSplits={[{ id: 7, title: 'Household', splitCount: 2, transactionCount: 3 }]}
        defaultAccount="everyday"
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.press(screen.getByRole('radio', { name: 'Groceries' }));
    fireEvent.changeText(screen.getByLabelText('Amount'), '24');
    fireEvent.press(screen.getByRole('checkbox', { name: 'Add to shared expenses' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Household · 2 people' }));
    fireEvent.press(screen.getByRole('button', { name: 'Save transaction' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave.mock.calls[0]?.[2]).toEqual({ mode: 'existing', splitId: 7 });

    rerender(
      <EntrySheet
        visible={false}
        references={references}
        expenseSplits={[]}
        defaultAccount="everyday"
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );
    rerender(
      <EntrySheet
        visible
        references={references}
        expenseSplits={[]}
        defaultAccount="everyday"
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.press(screen.getByRole('radio', { name: 'Groceries' }));
    fireEvent.changeText(screen.getByLabelText('Amount'), '15');
    fireEvent.press(screen.getByRole('checkbox', { name: 'Add to shared expenses' }));
    fireEvent.press(screen.getByRole('radio', { name: 'Create shared expense' }));
    expect(screen.getByLabelText('Split name')).toBeVisible();
    fireEvent.changeText(screen.getByLabelText('Number of people'), '3');
    fireEvent.press(screen.getByRole('button', { name: 'Save transaction' }));
    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(2));
    expect(onSave.mock.calls[1]?.[2]).toEqual({
      mode: 'new',
      splitCount: 3,
    });
  });

  it('prefills the default account and submits a complete normal expense', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <EntrySheet
        visible
        references={references}
        defaultAccount="savings"
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'Groceries' }));
    fireEvent.changeText(screen.getByLabelText('Amount'), '12,50');
    fireEvent.press(screen.getByRole('checkbox', { name: 'Weekly' }));
    fireEvent.changeText(screen.getByLabelText('Comment'), '  Market visit  ');
    fireEvent.press(screen.getByRole('button', { name: 'Save transaction' }));

    await waitFor(() => expect(onSave).toHaveBeenCalledTimes(1));
    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        account: 'savings',
        category: 'groceries',
        amount: '12,50',
        tags: ['weekly'],
        comment: '  Market visit  ',
      }),
      'transaction',
      undefined,
      'expense',
    );
  });

  it('creates income and hides shared-expense controls for it', async () => {
    const onSave = jest.fn().mockResolvedValue(undefined);
    render(
      <EntrySheet
        visible
        references={references}
        defaultAccount="everyday"
        onClose={jest.fn()}
        onSave={onSave}
      />,
    );
    fireEvent.press(screen.getByRole('radio', { name: 'Groceries' }));
    fireEvent.changeText(screen.getByLabelText('Amount'), '250');
    fireEvent.press(screen.getByRole('tab', { name: 'Income' }));
    expect(screen.queryByRole('checkbox', { name: 'Add to shared expenses' })).toBeNull();
    fireEvent.press(screen.getByRole('button', { name: 'Save transaction' }));
    await waitFor(() => expect(onSave).toHaveBeenCalled());
    expect(onSave.mock.calls[0]?.[3]).toBe('income');
  });

  it('keeps save disabled for unbalanced splits', () => {
    render(
      <EntrySheet
        visible
        references={references}
        defaultAccount="everyday"
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole('radio', { name: 'Groceries' }));
    fireEvent.changeText(screen.getByLabelText('Amount'), '20');
    fireEvent.press(screen.getByRole('tab', { name: 'Split transaction' }));
    const categoryButtons = screen.getAllByRole('button', { name: /Select category for Split/ });
    fireEvent.press(categoryButtons[0]!);
    fireEvent.press(screen.getByRole('radio', { name: 'Groceries' }));
    fireEvent.press(categoryButtons[1]!);
    fireEvent.press(screen.getByRole('radio', { name: 'Home' }));
    const splitAmounts = screen.getAllByLabelText('Split amount');
    fireEvent.changeText(splitAmounts[0]!, '12');
    fireEvent.changeText(splitAmounts[1]!, '7');
    expect(screen.getByRole('button', { name: 'Save transaction' })).toBeDisabled();
    fireEvent.changeText(splitAmounts[1]!, '8');
    expect(screen.getByRole('button', { name: 'Save transaction' })).toBeEnabled();
  });

  it('commits searched tags only when Done is pressed', () => {
    render(
      <EntrySheet
        visible
        references={references}
        defaultAccount="everyday"
        onClose={jest.fn()}
        onSave={jest.fn()}
      />,
    );

    fireEvent.press(screen.getByRole('button', { name: 'Search tags' }));
    const tagSearch = screen.getByTestId('tag-search-sheet');
    fireEvent.changeText(within(tagSearch).getByLabelText('Search tags'), 'sha');
    expect(within(tagSearch).getByRole('checkbox', { name: 'Shared' })).toBeVisible();
    expect(within(tagSearch).queryByRole('checkbox', { name: 'Weekly' })).toBeNull();
    fireEvent.press(within(tagSearch).getByRole('checkbox', { name: 'Shared' }));
    fireEvent.press(within(tagSearch).getByRole('button', { name: 'Done selecting tags' }));
    expect(screen.getByRole('checkbox', { name: 'Shared' })).toBeChecked();
  });

  it.each([
    ['Close', 'button'],
    ['Close transaction form', 'none'],
  ] as const)('resets a draft after dismissal through %s', async (label, role) => {
    const onClose = jest.fn();
    const { rerender } = render(
      <EntrySheet
        visible
        references={references}
        defaultAccount="everyday"
        onClose={onClose}
        onSave={jest.fn()}
      />,
    );
    fireEvent.changeText(screen.getByLabelText('Amount'), '33');
    const close =
      role === 'button'
        ? screen.getByRole('button', { name: label })
        : screen.getByLabelText(label);
    fireEvent.press(close);
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <EntrySheet
        visible={false}
        references={references}
        defaultAccount="everyday"
        onClose={onClose}
        onSave={jest.fn()}
      />,
    );
    rerender(
      <EntrySheet
        visible
        references={references}
        defaultAccount="everyday"
        onClose={onClose}
        onSave={jest.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByLabelText('Amount')).toHaveDisplayValue(''));
  });

  it('keeps the form open and displays submission diagnostics', async () => {
    render(
      <EntrySheet
        visible
        references={references}
        defaultAccount="everyday"
        onClose={jest.fn()}
        onSave={jest.fn().mockRejectedValue(new Error('Server rejected the expense'))}
      />,
    );
    fireEvent.press(screen.getByRole('radio', { name: 'Groceries' }));
    fireEvent.changeText(screen.getByLabelText('Amount'), '10');
    fireEvent.press(screen.getByRole('button', { name: 'Save transaction' }));
    expect(await screen.findByText('Server rejected the expense')).toBeVisible();
    expect(screen.getByTestId('entry-sheet')).toBeVisible();
  });
});
