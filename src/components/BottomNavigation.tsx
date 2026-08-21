import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { styles } from '../styles';
import { colors } from '../theme';

export type AppTab = 'transactions' | 'wallets' | 'shared' | 'receipts' | 'settings';

export function BottomNavigation({
  active,
  receiptCount,
  onChange,
}: {
  active: AppTab;
  receiptCount: number;
  onChange: (tab: AppTab) => void;
}) {
  const insets = useSafeAreaInsets();
  const tabs: { id: AppTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
    { id: 'transactions', label: 'Transactions', icon: 'swap-horizontal-outline' },
    { id: 'wallets', label: 'Accounts', icon: 'wallet-outline' },
    { id: 'shared', label: 'Shared', icon: 'people-outline' },
    { id: 'receipts', label: 'Receipts', icon: 'receipt-outline' },
    { id: 'settings', label: 'Settings', icon: 'settings-outline' },
  ];
  return (
    <View
      style={[
        styles.bottomNavigation,
        { minHeight: 76 + insets.bottom, paddingBottom: insets.bottom },
      ]}
    >
      {tabs.map((tab) => {
        const selected = active === tab.id;
        return (
          <Pressable
            key={tab.id}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(tab.id)}
            style={styles.bottomTab}
          >
            <View style={[styles.bottomTabIcon, selected && styles.activeBottomTabIcon]}>
              <Ionicons name={tab.icon} size={22} color={selected ? colors.accent : colors.muted} />
              {tab.id === 'receipts' && receiptCount > 0 ? (
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
            <Text style={[styles.bottomTabText, selected && styles.activeBottomTabText]}>
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}
