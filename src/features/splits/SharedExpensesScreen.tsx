import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Modal, Pressable, Text, View } from 'react-native';

import { loadExpenseSplit } from '../../api';
import { DrawerSheet } from '../../components/DrawerSheet';
import { styles } from '../../styles';
import { colors } from '../../theme';
import { formatCurrency, formatTransactionDate } from '../../transactions';
import { nativeDeviceLocale } from '../../device-locale';
import type { ExpenseSplitDetail, ExpenseSplitSummary } from '../../types';

export function SharedExpensesScreen({
  splits,
  loading,
  onRefresh,
}: {
  splits: ExpenseSplitSummary[];
  loading: boolean;
  onRefresh: () => Promise<void>;
}) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<ExpenseSplitDetail | null>(null);
  const [error, setError] = useState('');
  useEffect(() => {
    if (!selectedId) return;
    void loadExpenseSplit(selectedId)
      .then(setDetail)
      .catch((cause) =>
        setError(cause instanceof Error ? cause.message : 'Could not load details.'),
      );
  }, [selectedId]);
  return (
    <View style={styles.sharedExpensesScreen}>
      <View style={styles.secondaryHeader}>
        <View>
          <Text style={styles.secondaryEyebrow}>SHARED</Text>
          <Text style={styles.secondaryTitle}>Shared expenses</Text>
        </View>
      </View>
      <FlatList
        data={splits}
        keyExtractor={({ id }) => String(id)}
        refreshing={loading}
        onRefresh={() => void onRefresh()}
        contentContainerStyle={styles.sharedExpensesList}
        ListEmptyComponent={
          loading ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Text style={styles.emptyText}>No shared expenses yet.</Text>
          )
        }
        renderItem={({ item }) => (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`View shared expense ${item.title}`}
            onPress={() => {
              setDetail(null);
              setError('');
              setSelectedId(item.id);
            }}
            style={styles.sharedExpenseRow}
          >
            <View style={styles.sharedExpenseIcon}>
              <Ionicons name="people-outline" size={20} color={colors.accent} />
            </View>
            <View style={styles.transactionCopy}>
              <Text style={styles.merchant}>{item.title}</Text>
              <Text style={styles.transactionMeta}>
                {item.transactionCount} transaction{item.transactionCount === 1 ? '' : 's'} ·{' '}
                {item.splitCount} people
              </Text>
            </View>
            <View style={styles.sharedExpenseAmounts}>
              <Text style={styles.amount}>{formatCurrency(item.totalAmount ?? 0)}</Text>
              <Text style={styles.sharedExpenseBalance}>
                Balance {formatCurrency(item.balance ?? 0)}
              </Text>
            </View>
          </Pressable>
        )}
      />
      <Modal
        visible={selectedId !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedId(null)}
      >
        <View style={styles.receiptDetailsModalRoot}>
          <Pressable
            style={styles.receiptDetailsScrim}
            onPress={() => setSelectedId(null)}
            accessibilityLabel="Close shared expense details"
          />
          <DrawerSheet style={styles.receiptDetailsSheet}>
            <View style={styles.handle} />
            <View style={styles.receiptDetailsHeading}>
              <Text numberOfLines={1} style={styles.receiptDetailsTitle}>
                {detail?.title ?? 'Shared expense'}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Close shared expense details"
                onPress={() => setSelectedId(null)}
                style={styles.closeButton}
              >
                <Ionicons name="close" size={22} color={colors.ink} />
              </Pressable>
            </View>
            {error ? (
              <Text style={styles.errorText}>{error}</Text>
            ) : !detail ? (
              <ActivityIndicator color={colors.accent} />
            ) : (
              <FlatList
                data={[...detail.entries].sort((a, b) =>
                  (b.date ?? '').localeCompare(a.date ?? ''),
                )}
                keyExtractor={({ id }) => String(id)}
                contentContainerStyle={styles.sharedExpenseDetailList}
                ListHeaderComponent={
                  <View style={styles.sharedExpenseSummary}>
                    <View>
                      <Text style={styles.transactionDetailsLabel}>Your balance</Text>
                      <Text style={styles.transactionDetailsAmount}>
                        {formatCurrency(detail.balance ?? 0)}
                      </Text>
                    </View>
                    <View>
                      <Text style={styles.transactionDetailsLabel}>Total</Text>
                      <Text style={styles.transactionDetailsValue}>
                        {formatCurrency(detail.totalAmount ?? 0)}
                      </Text>
                    </View>
                  </View>
                }
                renderItem={({ item }) => (
                  <View style={styles.sharedExpenseDetailRow}>
                    <View style={styles.transactionCopy}>
                      <Text style={styles.merchant}>{item.description}</Text>
                      <Text style={styles.transactionMeta}>
                        {item.date
                          ? formatTransactionDate(item.date, nativeDeviceLocale())
                          : 'Custom item'}
                        {item.wallet ? ` · ${item.wallet}` : ''}
                      </Text>
                    </View>
                    <Text style={styles.amount}>{formatCurrency(item.amount)}</Text>
                  </View>
                )}
              />
            )}
          </DrawerSheet>
        </View>
      </Modal>
    </View>
  );
}
