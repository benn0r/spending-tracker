import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, Text, View } from 'react-native';

import type { QueuedTransaction } from '../../app-model';
import { styles } from '../../styles';
import { colors } from '../../theme';
import { formatDateHeader } from '../../transactions';
import type { ApiTransaction, CategoryReference } from '../../types';
import { SummaryCard } from './SummaryCard';
import { TransactionQueue } from './TransactionQueue';
import { TransactionRow } from './TransactionRow';

type TransactionsScreenProps = {
  transactions: ApiTransaction[];
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
  onRetryQueued: (transaction: QueuedTransaction) => void;
  onDiscardQueued: (transaction: QueuedTransaction) => void;
  onAdd: () => void;
};

export function TransactionsScreen({
  transactions,
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
  onRetryQueued,
  onDiscardQueued,
  onAdd,
}: TransactionsScreenProps) {
  const listRef = useRef<FlatList<ApiTransaction>>(null);

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
        data={transactions}
        removeClippedSubviews={false}
        keyExtractor={(item) => item.id}
        renderItem={({ item, index }) => (
          <View>
            {index === 0 || transactions[index - 1]?.date !== item.date ? (
              <Text style={styles.dateSectionHeader}>{formatDateHeader(item.date)}</Text>
            ) : null}
            <TransactionRow item={item} categories={categories} onDelete={onDelete} />
          </View>
        )}
        ListHeaderComponent={
          <>
            <SummaryCard transactions={transactions} />
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
            <View style={styles.listHeading}>
              <Text style={styles.sectionTitle}>Recent transactions</Text>
              <Text style={styles.filterText}>{transactions.length} loaded</Text>
            </View>
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
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Add transaction"
        onPress={onAdd}
        style={({ pressed }) => [styles.fab, pressed && styles.fabPressed]}
      >
        <Ionicons name="add" size={32} color={colors.white} />
      </Pressable>
    </>
  );
}
