import Ionicons from '@expo/vector-icons/Ionicons';
import { TabList, TabSlot, Tabs, TabTrigger } from 'expo-router/ui';
import { Text, View } from 'react-native';

import { styles } from '../styles';
import { colors } from '../theme';

const tabs = [
  { name: 'index', href: '/' as const, label: 'Transactions', icon: 'swap-horizontal-outline' },
  { name: 'accounts', href: '/accounts' as const, label: 'Accounts', icon: 'wallet-outline' },
  {
    name: 'more',
    href: '/more' as const,
    label: 'More',
    icon: 'ellipsis-horizontal-circle-outline',
  },
  { name: 'settings', href: '/settings' as const, label: 'Settings', icon: 'settings-outline' },
] as const;

export function AppTabs({
  receiptCount,
  onTransactionsActivated,
}: {
  receiptCount: number;
  onTransactionsActivated: () => void;
}) {
  return (
    <Tabs style={styles.routerTabs}>
      <TabSlot style={styles.routerTabSlot} />
      <TabList style={styles.bottomNavigation}>
        {tabs.map((tab) => (
          <TabTrigger
            key={tab.name}
            accessibilityLabel={tab.label}
            href={tab.href}
            name={tab.name}
            onPress={tab.name === 'index' ? onTransactionsActivated : undefined}
            style={styles.bottomTab}
          >
            <View style={styles.bottomTabIcon}>
              <Ionicons name={tab.icon} size={22} color={colors.muted} />
              {tab.name === 'more' && receiptCount > 0 ? (
                <View
                  accessibilityLabel={`${receiptCount} receipts need attention`}
                  testID="receipt-tab-badge"
                  style={styles.receiptBadge}
                >
                  <Text style={styles.receiptBadgeText}>
                    {receiptCount > 99 ? '99+' : receiptCount}
                  </Text>
                </View>
              ) : null}
            </View>
            <Text style={styles.bottomTabText}>{tab.label}</Text>
          </TabTrigger>
        ))}
      </TabList>
    </Tabs>
  );
}
