import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Animated, Modal, Text } from 'react-native';

import { AccountDropdown } from '../../src/components/AccountDropdown';
import { BottomNavigation } from '../../src/components/BottomNavigation';
import { SettingsScreen } from '../../src/features/settings/SettingsScreen';
import { MoreNavigator } from '../../src/features/more/MoreNavigator';

jest.mock('@expo/vector-icons/Ionicons', () => 'Ionicons');
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 12, left: 0 }),
}));

const accounts = [
  { id: 'moonlight-wallet', name: 'Moonlight Wallet' },
  { id: 'dragon-hoard', name: 'Dragon Hoard' },
];

describe('navigation and settings presentation', () => {
  it('renders settings and delegates a selected default account', async () => {
    const onChangeDefaultAccount = jest.fn();
    render(
      <SettingsScreen
        defaultAccount="dragon-hoard"
        accounts={accounts}
        onChangeDefaultAccount={onChangeDefaultAccount}
        serverUrl="https://spending.example.test"
        onEditConnection={jest.fn()}
      />,
    );

    expect(screen.getByText('PREFERENCES')).toBeVisible();
    expect(
      screen.getByText('Personalize how new transactions are prepared on this device.'),
    ).toBeVisible();
    const selector = screen.getByRole('button', { name: 'Select default account' });
    expect(screen.getByText('Dragon Hoard')).toBeVisible();
    expect(screen.getByText('https://spending.example.test')).toBeVisible();
    fireEvent.press(selector);

    expect(screen.getByRole('radio', { name: 'Dragon Hoard' })).toBeChecked();
    fireEvent.press(screen.getByRole('radio', { name: 'Moonlight Wallet' }));
    expect(onChangeDefaultAccount).toHaveBeenCalledWith('moonlight-wallet');
  });

  it('renders the configurable empty account state and responds to native dismissal', async () => {
    render(
      <AccountDropdown
        value=""
        options={[]}
        onChange={jest.fn()}
        label="Wallet"
        hint="Choose where expenses begin"
        accessibilityLabel="Choose wallet"
      />,
    );

    expect(screen.getByText('Wallet')).toBeVisible();
    expect(screen.getByText('Choose an account')).toBeVisible();
    expect(screen.getByText('Choose where expenses begin')).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Choose wallet' }));
    expect(screen.getByText('No accounts are enabled on the server.')).toBeVisible();

    fireEvent.press(screen.getByRole('button', { name: 'Close account selector' }));
    await waitFor(() => expect(screen.queryByTestId('account-sheet')).toBeNull());

    fireEvent.press(screen.getByRole('button', { name: 'Choose wallet' }));
    fireEvent(screen.UNSAFE_getByType(Modal), 'requestClose');
    await waitFor(() => expect(screen.queryByTestId('account-sheet')).toBeNull());
  });

  it('marks the active tab, caps the receipt badge, and delegates navigation', () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <BottomNavigation active="more" receiptCount={120} onChange={onChange} />,
    );

    expect(screen.getByRole('tab', { name: 'More' })).toBeSelected();
    expect(screen.getByRole('tab', { name: 'Transactions' })).not.toBeSelected();
    expect(screen.getByTestId('receipt-tab-badge')).toHaveTextContent('99+');
    expect(screen.getByLabelText('120 receipts need attention')).toBeVisible();

    fireEvent.press(screen.getByRole('tab', { name: 'Settings' }));
    expect(onChange).toHaveBeenCalledWith('settings');
    fireEvent.press(screen.getByRole('tab', { name: 'More' }));
    expect(onChange).toHaveBeenCalledWith('more');

    rerender(<BottomNavigation active="settings" receiptCount={3} onChange={onChange} />);
    expect(screen.getByTestId('receipt-tab-badge')).toHaveTextContent('3');

    rerender(<BottomNavigation active="settings" receiptCount={0} onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Settings' })).toBeSelected();
    expect(screen.queryByTestId('receipt-tab-badge')).toBeNull();
  });

  it('opens More destinations as a page sliding in from the right', () => {
    const onSelect = jest.fn();
    const { rerender } = render(
      <MoreNavigator selected={null} receiptCount={3} onSelect={onSelect}>
        <></>
      </MoreNavigator>,
    );

    expect(screen.getByText('More')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Shared expenses' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Receipts' })).toBeVisible();
    fireEvent.press(screen.getByRole('button', { name: 'Receipts' }));
    expect(onSelect).toHaveBeenCalledWith('receipts');

    rerender(
      <MoreNavigator selected="receipts" receiptCount={3} onSelect={onSelect}>
        <Text>Receipt page</Text>
      </MoreNavigator>,
    );
    expect(screen.getByTestId('more-detail-page')).toBeVisible();
    expect(screen.getByText('Receipt page')).toBeVisible();
  });

  it('animates a More detail page back to the right before completing navigation', () => {
    const timing = jest.spyOn(Animated, 'timing');
    const onExitComplete = jest.fn();
    const { rerender } = render(
      <MoreNavigator selected="shared" receiptCount={0} onSelect={jest.fn()}>
        <Text>Shared page</Text>
      </MoreNavigator>,
    );
    const callsBeforeLeaving = timing.mock.calls.length;

    rerender(
      <MoreNavigator
        selected="shared"
        receiptCount={0}
        leaving
        onExitComplete={onExitComplete}
        onSelect={jest.fn()}
      >
        <Text>Shared page</Text>
      </MoreNavigator>,
    );

    expect(
      timing.mock.calls
        .slice(callsBeforeLeaving)
        .some(([, configuration]) => configuration.toValue === 1),
    ).toBe(true);
    timing.mockRestore();
  });
});
