import { NativeTabs } from 'expo-router/unstable-native-tabs';

export function AppTabs({
  receiptCount,
}: {
  receiptCount: number;
  onTransactionsActivated: () => void;
}) {
  return (
    <NativeTabs minimizeBehavior="never" tintColor="#77409A">
      <NativeTabs.Trigger name="index" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'arrow.left.arrow.right', selected: 'arrow.left.arrow.right' }}
          md="swap_horiz"
        />
        <NativeTabs.Trigger.Label>Transactions</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="accounts" disableAutomaticContentInsets>
        <NativeTabs.Trigger.Icon
          sf={{ default: 'wallet.bifold', selected: 'wallet.bifold.fill' }}
          md="account_balance_wallet"
        />
        <NativeTabs.Trigger.Label>Accounts</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="more">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'ellipsis.circle', selected: 'ellipsis.circle.fill' }}
          md="more_horiz"
        />
        <NativeTabs.Trigger.Label>More</NativeTabs.Trigger.Label>
        {receiptCount > 0 ? (
          <NativeTabs.Trigger.Badge>
            {receiptCount > 99 ? '99+' : String(receiptCount)}
          </NativeTabs.Trigger.Badge>
        ) : null}
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="settings">
        <NativeTabs.Trigger.Icon
          sf={{ default: 'gearshape', selected: 'gearshape.fill' }}
          md="settings"
        />
        <NativeTabs.Trigger.Label>Settings</NativeTabs.Trigger.Label>
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
