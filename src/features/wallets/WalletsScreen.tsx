import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  RefreshControl,
  Text,
  View,
} from 'react-native';
import { deleteTransaction, loadCashFlow, loadTransactionPage } from '../../api';
import { accountCacheStorageKey, mergeTransactionPages } from '../../app-model';
import { AccountDropdown } from '../../components/AccountDropdown';
import { GlassBackground } from '../../components/GlassBackground';
import { nativeDeviceLocale } from '../../device-locale';
import { styles } from '../../styles';
import { colors } from '../../theme';
import { transactionDayTotals, transactionListItems } from '../../transactions';
import type { ApiTransaction, CashFlow, CategoryReference, Reference } from '../../types';
import { TransactionRow } from '../transactions/TransactionRow';
import { DateSectionHeader } from '../transactions/DateSectionHeader';

function formatAccountAmount(value: number | undefined, currency: string | undefined) {
  if (value === undefined) return '—';
  return new Intl.NumberFormat(nativeDeviceLocale(), {
    style: 'currency',
    currency: currency ?? 'CHF',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function WalletsScreen({
  accounts,
  categories,
  defaultAccount,
  topInset = 0,
}: {
  accounts: Reference[];
  categories: CategoryReference[];
  defaultAccount: string;
  topInset?: number;
}) {
  const [wallet, setWallet] = useState('');
  const [items, setItems] = useState<ApiTransaction[]>([]);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [headerHeight, setHeaderHeight] = useState(132);
  const [scrollY] = useState(() => new Animated.Value(0));
  const headerPullDown = scrollY.interpolate({
    inputRange: [-240, 0, 1],
    outputRange: [240, 0, 0],
    extrapolate: 'clamp',
  });
  const loadingMoreRef = useRef(false);
  const generation = useRef(0);
  const availableDefaultAccount = accounts.some(({ id }) => id === defaultAccount)
    ? defaultAccount
    : '';
  const selectedWallet = wallet || availableDefaultAccount || accounts[0]?.id || '';
  const selectedWalletName = accounts.find(({ id }) => id === selectedWallet)?.name;
  const dayTotals = useMemo(() => transactionDayTotals(items), [items]);
  const listItems = useMemo(() => transactionListItems(items), [items]);

  const persistAccountCache = useCallback(
    (transactions: ApiTransaction[], nextCashFlow: CashFlow | null, nextTotal: number) => {
      if (!selectedWallet) return;
      void AsyncStorage.setItem(
        accountCacheStorageKey(selectedWallet),
        JSON.stringify({ transactions, cashFlow: nextCashFlow, total: nextTotal }),
      ).catch(() => undefined);
    },
    [selectedWallet],
  );

  const refresh = useCallback(
    async (showIndicator = true) => {
      generation.current += 1;
      const requestGeneration = generation.current;
      if (!selectedWallet) {
        setItems([]);
        setTotal(0);
        setCashFlow(null);
        setLoading(false);
        setRefreshing(false);
        return;
      }
      setLoading(true);
      setRefreshing(showIndicator);
      setError('');
      try {
        const [transactionsResult, cashFlowResult] = await Promise.allSettled([
          loadTransactionPage(1, 20, selectedWallet, selectedWalletName),
          loadCashFlow(selectedWallet),
        ]);
        if (requestGeneration !== generation.current) return;
        if (transactionsResult.status === 'rejected') throw transactionsResult.reason;
        const result = transactionsResult.value;
        setItems(result.transactions);
        setPage(result.page);
        setTotal(result.total);
        const nextCashFlow = cashFlowResult.status === 'fulfilled' ? cashFlowResult.value : null;
        setCashFlow(nextCashFlow);
        persistAccountCache(result.transactions, nextCashFlow, result.total);
      } catch (cause) {
        if (requestGeneration === generation.current)
          setError(cause instanceof Error ? cause.message : 'Could not load account transactions.');
      } finally {
        if (requestGeneration === generation.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [persistAccountCache, selectedWallet, selectedWalletName],
  );

  useEffect(() => {
    let active = true;
    if (!selectedWallet) return () => undefined;
    void AsyncStorage.getItem(accountCacheStorageKey(selectedWallet))
      .catch(() => null)
      .then((stored) => {
        if (!active) return;
        setItems([]);
        setTotal(0);
        setCashFlow(null);
        if (!stored) return;
        try {
          const cached = JSON.parse(stored) as {
            transactions?: ApiTransaction[];
            cashFlow?: CashFlow | null;
            total?: number;
          };
          if (Array.isArray(cached.transactions)) setItems(cached.transactions);
          if (typeof cached.total === 'number') setTotal(cached.total);
          if (cached.cashFlow) setCashFlow(cached.cashFlow);
        } catch {
          // Ignore corrupt cache entries and replace them on refresh.
        }
      })
      .finally(() => {
        if (active) void refresh(false);
      });
    return () => {
      active = false;
    };
  }, [refresh, selectedWallet]);

  const loadMore = useCallback(async () => {
    if (!selectedWallet || loading || loadingMoreRef.current || items.length >= total) return;
    const requestGeneration = generation.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const result = await loadTransactionPage(page + 1, 20, selectedWallet, selectedWalletName);
      if (requestGeneration !== generation.current) return;
      setItems((current) => {
        const next = mergeTransactionPages(current, result.transactions);
        persistAccountCache(next, cashFlow, result.total);
        return next;
      });
      setPage(result.page);
      setTotal(result.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more transactions.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [
    cashFlow,
    items.length,
    loading,
    page,
    persistAccountCache,
    selectedWallet,
    selectedWalletName,
    total,
  ]);

  const handleScroll = useCallback(
    ({ nativeEvent }: NativeSyntheticEvent<NativeScrollEvent>) => {
      const distanceFromEnd =
        nativeEvent.contentSize.height -
        nativeEvent.layoutMeasurement.height -
        nativeEvent.contentOffset.y;
      if (distanceFromEnd < 240) void loadMore();
    },
    [loadMore],
  );
  const animatedScrollHandler = useMemo(
    () =>
      // Animated.event treats its mapping node as configuration; it does not read the value here.
      // eslint-disable-next-line react-hooks/refs
      Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], {
        useNativeDriver: true,
        listener: handleScroll,
      }),
    [handleScroll, scrollY],
  );

  return (
    <View style={styles.accountScreen}>
      <Animated.View
        onLayout={({ nativeEvent }) => setHeaderHeight(nativeEvent.layout.height)}
        style={[
          styles.accountStickyHeader,
          { top: topInset + 16, transform: [{ translateY: headerPullDown }] },
        ]}
      >
        <GlassBackground intensity={62} tintColor="rgba(255, 255, 255, 0.24)" />
        <Text style={styles.secondaryEyebrow}>ACCOUNTS</Text>
        <AccountDropdown
          value={selectedWallet}
          options={accounts}
          onChange={setWallet}
          label="Account"
          accessibilityLabel="Select account"
          variant="header"
        />
        <View style={styles.accountHeaderMetrics}>
          <View style={styles.accountHeaderMetric}>
            <Text style={styles.accountHeaderMetricLabel}>CURRENT BALANCE</Text>
            <Text style={styles.accountHeaderMetricValue} numberOfLines={1}>
              {formatAccountAmount(cashFlow?.balance, cashFlow?.currency)}
            </Text>
          </View>
          <View style={styles.accountHeaderMetricDivider} />
          <View style={styles.accountHeaderMetric}>
            <Text style={styles.accountHeaderMetricLabel}>MONTHLY CASH FLOW</Text>
            <Text style={styles.accountHeaderMetricValue} numberOfLines={1}>
              {formatAccountAmount(cashFlow?.months.at(-1)?.net, cashFlow?.currency)}
            </Text>
          </View>
        </View>
      </Animated.View>
      <Animated.FlatList
        testID="wallets-list"
        data={listItems}
        contentInsetAdjustmentBehavior="never"
        keyExtractor={(item) => (item.kind === 'date' ? `date-${item.date}` : `group-${item.date}`)}
        renderItem={({ item, index }) =>
          item.kind === 'date' ? (
            <DateSectionHeader
              date={item.date}
              total={dayTotals[item.date] ?? 0}
              flushTop={index === 0}
            />
          ) : (
            <View style={styles.dailyTransactionGroup}>
              <GlassBackground intensity={56} tintColor="rgba(255, 255, 255, 0.84)" />
              {item.transactions.map((transaction) => (
                <TransactionRow
                  contained
                  key={transaction.id}
                  item={transaction}
                  categories={categories}
                  onDelete={(deleted) => {
                    setItems((current) => {
                      const next = current.filter(({ id }) => id !== deleted.id);
                      persistAccountCache(next, cashFlow, Math.max(0, total - 1));
                      return next;
                    });
                    setTotal((current) => Math.max(0, current - 1));
                    void deleteTransaction(deleted.id).catch(() => void refresh());
                  }}
                />
              ))}
            </View>
          )
        }
        contentContainerStyle={[
          styles.walletContent,
          { paddingTop: topInset + 16 + headerHeight + 12 },
        ]}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListHeaderComponent={
          <View>{error ? <Text style={styles.errorText}>{error}</Text> : null}</View>
        }
        ListEmptyComponent={
          loading ? null : (
            <Text style={styles.emptyText}>
              {accounts.length ? 'No transactions in this account.' : 'No accounts are enabled.'}
            </Text>
          )
        }
        ListFooterComponent={
          loadingMore ? (
            <ActivityIndicator color={colors.accent} style={styles.loadingMore} />
          ) : null
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void refresh(true)}
            tintColor={colors.accent}
            colors={[colors.accent]}
            progressBackgroundColor={colors.white}
            progressViewOffset={topInset + 8}
          />
        }
        onEndReached={() => void loadMore()}
        onEndReachedThreshold={0.35}
        onScroll={animatedScrollHandler}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
      />
      <View pointerEvents="none" style={[styles.topStatusFade, { height: topInset + 36 }]} />
    </View>
  );
}
