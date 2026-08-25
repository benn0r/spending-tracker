import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import type { QueuedTransaction } from '../../app-model';
import { GlassBackground } from '../../components/GlassBackground';
import { LiquidGlassActionButton } from '../../components/LiquidGlassActionButton';
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

const TRANSACTION_LIST_TOP_INSET = 24;

type TransactionsScreenProps = {
  topInset?: number;
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
  topInset = 0,
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
  const [scanningReceipt, setScanningReceipt] = useState(false);
  const [receiptError, setReceiptError] = useState('');
  const [fixedHeader, setFixedHeader] = useState<{ date: string; direction: 1 | -1 }>({
    date: '',
    direction: 1,
  });
  const lastScrollOffset = useRef(0);
  const listHeaderEnd = useRef(0);
  const listItemHeights = useRef<Record<string, number>>({});

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
        contentInsetAdjustmentBehavior="never"
        removeClippedSubviews={false}
        keyExtractor={(item) => (item.kind === 'date' ? `date-${item.date}` : `group-${item.date}`)}
        renderItem={({ item, index }) =>
          item.kind === 'date' ? (
            <DateSectionHeader
              date={item.date}
              total={dayTotals[item.date] ?? 0}
              flushTop={index === 0}
              onLayout={({ nativeEvent }) => {
                listItemHeights.current[`date-${item.date}`] = nativeEvent.layout.height;
              }}
            />
          ) : (
            <View
              onLayout={({ nativeEvent }) => {
                listItemHeights.current[`group-${item.date}`] = nativeEvent.layout.height;
              }}
              style={styles.dailyTransactionGroup}
            >
              <GlassBackground intensity={56} tintColor="rgba(255, 255, 255, 0.84)" />
              {item.transactions.map((transaction) => (
                <TransactionRow
                  contained
                  key={transaction.id}
                  item={transaction}
                  categories={categories}
                  onDelete={onDelete}
                  onEdit={onEdit}
                />
              ))}
            </View>
          )
        }
        ListHeaderComponent={
          <View
            onLayout={({ nativeEvent }) => {
              listHeaderEnd.current = nativeEvent.layout.y + nativeEvent.layout.height;
            }}
          >
            <SummaryCard cashFlow={cashFlow} />
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
          </View>
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
        contentContainerStyle={[styles.content, { paddingTop: 24 + topInset }]}
        showsVerticalScrollIndicator={false}
        onEndReached={() => void onLoadMore()}
        onEndReachedThreshold={0.35}
        onScroll={({ nativeEvent }) => {
          const scrollOffset = nativeEvent.contentOffset.y;
          const direction: 1 | -1 = scrollOffset >= lastScrollOffset.current ? 1 : -1;
          lastScrollOffset.current = scrollOffset;
          let nextStuckDate = '';
          let itemOffset = listHeaderEnd.current + TRANSACTION_LIST_TOP_INSET;
          for (const item of listItems) {
            const key = `${item.kind}-${item.date}`;
            if (item.kind === 'date' && itemOffset <= scrollOffset) {
              nextStuckDate = item.date;
            }
            itemOffset += listItemHeights.current[key] ?? 0;
          }
          setFixedHeader((current) =>
            current.date === nextStuckDate ? current : { date: nextStuckDate, direction },
          );
          const distanceFromEnd =
            nativeEvent.contentSize.height -
            nativeEvent.layoutMeasurement.height -
            nativeEvent.contentOffset.y;
          if (distanceFromEnd < 240) void onLoadMore();
        }}
        scrollEventThrottle={16}
        refreshControl={
          <RefreshControl
            refreshing={loading}
            onRefresh={() => void onRefresh()}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.white}
            progressViewOffset={topInset + 8}
          />
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
      />
      <View
        pointerEvents="none"
        style={[styles.topStatusFade, { height: topInset + 36 }]}
        testID="top-status-fade"
      />
      {fixedHeader.date ? (
        <View pointerEvents="none" style={styles.fixedDateSectionHeaderContainer}>
          <DateSectionHeader
            date={fixedHeader.date}
            total={dayTotals[fixedHeader.date] ?? 0}
            flushTop
            sticky
            elevated
            animateContent
            animationDirection={fixedHeader.direction}
            topInset={topInset}
          />
        </View>
      ) : null}
      {receiptError ? (
        <View style={styles.homeReceiptError}>
          <Text style={styles.homeReceiptErrorText}>{receiptError}</Text>
        </View>
      ) : null}
      <View style={styles.homeActionGroup}>
        <LiquidGlassActionButton
          label="Scan receipt"
          icon="camera-outline"
          systemImage="camera"
          size={42}
          disabled={scanningReceipt}
          onPress={() => void scanReceipt()}
          loading={scanningReceipt}
        />
        <LiquidGlassActionButton
          label="Add transaction"
          icon="add"
          systemImage="plus"
          size={54}
          prominent
          onPress={onAdd}
        />
      </View>
    </>
  );
}
