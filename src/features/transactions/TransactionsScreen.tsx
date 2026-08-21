import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import type { QueuedTransaction } from '../../app-model';
import { styles } from '../../styles';
import { colors } from '../../theme';
import {
  transactionDayTotals,
  transactionListItems,
  type TransactionListItem,
} from '../../transactions';
import type { ApiTransaction, CashFlow, CategoryReference } from '../../types';
import { SummaryCard } from './SummaryCard';
import { DateSectionHeader } from './DateSectionHeader';
import { TransactionQueue } from './TransactionQueue';
import { TransactionRow } from './TransactionRow';

type TransactionsScreenProps = {
  transactions: ApiTransaction[];
  cashFlow: CashFlow | null;
  categories: CategoryReference[];
  queuedTransactions: QueuedTransaction[];
  retryingTransaction: string | null;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  activationRequest: number;
  onRefresh: () => Promise<void>;
  onActivationRefresh: () => Promise<void>;
  onLoadMore: () => Promise<void>;
  onDelete: (transaction: ApiTransaction) => void;
  onEdit: (transaction: ApiTransaction) => void;
  onRetryQueued: (transaction: QueuedTransaction) => void;
  onDiscardQueued: (transaction: QueuedTransaction) => void;
  onScanReceipt: () => Promise<void>;
  onAdd: () => void;
};

export function TransactionsScreen({
  transactions,
  cashFlow,
  categories,
  queuedTransactions,
  retryingTransaction,
  loading,
  loadingMore,
  error,
  activationRequest,
  onRefresh,
  onActivationRefresh,
  onLoadMore,
  onDelete,
  onEdit,
  onRetryQueued,
  onDiscardQueued,
  onScanReceipt,
  onAdd,
}: TransactionsScreenProps) {
  const listRef = useRef<FlatList<TransactionListItem>>(null);
  const dayTotals = useMemo(() => transactionDayTotals(transactions), [transactions]);
  const listItems = useMemo(() => transactionListItems(transactions), [transactions]);
  const stickyHeaderIndices = useMemo(
    () => listItems.flatMap((item, index) => (item.kind === 'date' ? [index + 1] : [])),
    [listItems],
  );
  const [cashFlowHeight, setCashFlowHeight] = useState(0);
  const [showScrolledDivider, setShowScrolledDivider] = useState(false);
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');

  const scanReceipt = async () => {
    setScanningReceipt(true);
    setReceiptError('');
    try {
      await onScanReceipt();
    } catch (cause) {
      setReceiptError(
        cause instanceof Error ? cause.message : 'Could not open the camera or upload receipt.',
      );
    } finally {
      setScanningReceipt(false);
    }
  };

  useEffect(() => {
    if (activationRequest === 0) return;
    const scrollToTop = () => listRef.current?.scrollToOffset({ offset: 0, animated: false });
    scrollToTop();
    void onActivationRefresh().finally(() => {
      scrollToTop();
      requestAnimationFrame(scrollToTop);
    });
  }, [activationRequest, onActivationRefresh]);

  if (loading && !transactions.length) {
    return (
      <View style={styles.state}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={styles.stateText}>Loading your budget…</Text>
      </View>
    );
  }

  if (error && !transactions.length && !queuedTransactions.length) {
    return (
      <View style={styles.state}>
        <Ionicons name="cloud-offline-outline" size={42} color={colors.accentDark} />
        <Text style={styles.stateTitle}>Couldn’t load your budget</Text>
        <Text style={styles.stateText}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Retry loading transactions"
          onPress={() => void onRefresh()}
          style={styles.retryButton}
        >
          <Text style={styles.retryText}>Try again</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <>
      <FlatList
        ref={listRef}
        testID="transactions-list"
        data={listItems}
        stickyHeaderIndices={stickyHeaderIndices}
        removeClippedSubviews={false}
        keyExtractor={(item) =>
          item.kind === 'date'
            ? `date-${item.date}`
            : item.kind === 'spacing'
              ? item.id
              : `transaction-${item.transaction.id}`
        }
        renderItem={({ item, index }) =>
          item.kind === 'date' ? (
            <DateSectionHeader
              date={item.date}
              total={dayTotals[item.date] ?? 0}
              flushTop={index === 0}
              sticky
            />
          ) : item.kind === 'spacing' ? (
            <View style={styles.transactionSectionSpacing} />
          ) : (
            <TransactionRow
              item={item.transaction}
              categories={categories}
              onDelete={onDelete}
              onEdit={onEdit}
            />
          )
        }
        ListHeaderComponent={
          <>
            <SummaryCard
              cashFlow={cashFlow}
              onLayout={({ nativeEvent }) => setCashFlowHeight(nativeEvent.layout.height)}
            />
            {error ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Retry loading transactions"
                onPress={() => void onRefresh()}
                style={styles.inlineError}
              >
                <Text style={styles.inlineErrorText}>{error} Tap to retry.</Text>
              </Pressable>
            ) : null}
            <TransactionQueue
              items={queuedTransactions}
              retrying={retryingTransaction}
              onRetry={onRetryQueued}
              onDiscard={onDiscardQueued}
            />
          </>
        }
        ListEmptyComponent={<Text style={styles.emptyText}>No transactions yet.</Text>}
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator
              testID="loading-more-transactions"
              color={colors.accent}
              style={styles.loadingMore}
            />
          ) : null
        }
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void onLoadMore()}
        onEndReachedThreshold={0.35}
        onScroll={({ nativeEvent }) => {
          const pastCashFlow = cashFlowHeight > 0 && nativeEvent.contentOffset.y >= cashFlowHeight;
          setShowScrolledDivider((current) => (current === pastCashFlow ? current : pastCashFlow));
          const distanceFromEnd =
            nativeEvent.contentSize.height -
            nativeEvent.layoutMeasurement.height -
            nativeEvent.contentOffset.y;
          if (distanceFromEnd < 240) void onLoadMore();
        }}
        scrollEventThrottle={200}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.white}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      {showScrolledDivider ? <View pointerEvents="none" style={styles.scrolledTopDivider} /> : null}
      {receiptError ? (
        <View style={styles.homeReceiptError}>
          <Text style={styles.homeReceiptErrorText}>{receiptError}</Text>
        </View>
      ) : null}
      <View style={styles.homeActionGroup}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Scan receipt"
          disabled={scanningReceipt}
          onPress={() => void scanReceipt()}
          style={({ pressed }) => [styles.homeCameraFab, pressed && styles.homeCameraFabPressed]}
        >
          {scanningReceipt ? (
            <ActivityIndicator color={colors.accent} />
          ) : (
            <Ionicons name="camera-outline" size={25} color={colors.accent} />
          )}
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Add transaction"
          onPress={onAdd}
          style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
        >
          <Ionicons name="add" size={32} color={colors.white} />
        </Pressable>
      </View>
    </>
  );
}
