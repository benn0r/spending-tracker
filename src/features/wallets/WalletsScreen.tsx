import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { deleteTransaction, loadTransactionPage } from '../../api';
import { mergeTransactionPages } from '../../app-model';
import { AccountDropdown } from '../../components/AccountDropdown';
import { styles } from '../../styles';
import { colors } from '../../theme';
import { formatDateHeader } from '../../transactions';
import type { ApiTransaction, CategoryReference, Reference } from '../../types';
import { TransactionRow } from '../transactions/TransactionRow';

export function WalletsScreen({
  accounts,
  categories,
}: {
  accounts: Reference[];
  categories: CategoryReference[];
}) {
  const [wallet, setWallet] = useState('');
  const [items, setItems] = useState<ApiTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const loadingMoreRef = useRef(false);
  const generation = useRef(0);
  const selectedWallet = wallet || accounts[0]?.id || '';

  const refresh = useCallback(
    async (showIndicator = true) => {
      generation.current += 1;
      const requestGeneration = generation.current;
      if (!selectedWallet) {
        setItems([]);
        setTotal(0);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setLoading(true);
      setRefreshing(showIndicator);
      setError('');
      try {
        const result = await loadTransactionPage(1, 20, selectedWallet);
        if (requestGeneration !== generation.current) return;
        setItems(result.transactions);
        setPage(result.page);
        setTotal(result.total);
      } catch (cause) {
        if (requestGeneration === generation.current)
          setError(cause instanceof Error ? cause.message : 'Could not load wallet transactions.');
      } finally {
        if (requestGeneration === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [selectedWallet],
  );

  useEffect(() => {
    const initialLoad = setTimeout(() => void refresh(false), 0);
    return () => clearTimeout(initialLoad);
  }, [refresh]);

  const loadMore = useCallback(async () => {
    if (!selectedWallet || loading || loadingMoreRef.current || items.length >= total) return;
    const requestGeneration = generation.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await loadTransactionPage(page + 1, 20, selectedWallet);
      if (requestGeneration !== generation.current) return;
      setItems((current) => mergeTransactionPages(current, result.transactions));
      setPage(result.page);
      setTotal(result.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more transactions.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [items.length, loading, page, selectedWallet, total]);

  return (
    <FlatList
      testID="wallets-list"
      data={items}
      keyExtractor={({ id }) => id}
      renderItem={({ item, index }) => (
        <View>
          {index === 0 || items[index - 1]?.date !== item.date ? (
            <Text style={styles.dateSectionHeader}>{formatDateHeader(item.date)}</Text>
          ) : null}
          <TransactionRow
            item={item}
            categories={categories}
            onDelete={(transaction) => {
              setItems((current) => current.filter(({ id }) => id !== transaction.id));
              setTotal((current) => Math.max(0, current - 1));
              void deleteTransaction(transaction.id).catch(() => void refresh());
            }}
          />
        </View>
      )}
      contentContainerStyle={styles.walletContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View>
          <Text style={styles.secondaryEyebrow}>ACCOUNTS</Text>
          <Text style={styles.secondaryTitle}>Wallets</Text>
          <Text style={styles.settingsIntro}>Choose a wallet to see its transactions.</Text>
          <View style={styles.settingsSection}>
            <AccountDropdown
              value={selectedWallet}
              options={accounts}
              onChange={setWallet}
              label="Wallet"
              hint="Only transactions from this wallet are shown"
              accessibilityLabel="Select wallet"
            />
          </View>
          <View style={styles.walletListHeading}>
            <Text style={styles.sectionTitle}>Wallet transactions</Text>
            <Text style={styles.filterText}>{items.length} loaded</Text>
          </View>
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </View>
      }
      ListEmptyComponent={
        loading ? null : (
          <Text style={styles.emptyText}>
            {accounts.length ? 'No transactions in this wallet.' : 'No wallets are enabled.'}
          </Text>
        )
      }
      ListFooterComponent={
        loadingMore ? <ActivityIndicator color={colors.accent} style={styles.loadingMore} /> : null
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => void refresh(true)}
          tintColor={colors.accent}
          colors={[colors.accent]}
          progressBackgroundColor={colors.white}
        />
      }
      onEndReached={() => void loadMore()}
      onEndReachedThreshold={0.35}
      onScroll={({ nativeEvent }) => {
        const distanceFromEnd =
          nativeEvent.contentSize.height -
          nativeEvent.layoutMeasurement.height -
          nativeEvent.contentOffset.y;
        if (distanceFromEnd < 240) void loadMore();
      }}
      scrollEventThrottle={200}
      showsVerticalScrollIndicator={false}
    />
  );
}
