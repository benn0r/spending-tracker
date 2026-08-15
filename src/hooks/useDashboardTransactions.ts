import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { deleteTransaction, loadDashboard, loadTransactionPage } from '../api';
import {
  emptyReferences,
  cashFlowCacheStorageKey,
  mergeTransactionPages,
  parseReferenceCache,
  prependConfirmedTransaction,
  referenceCacheStorageKey,
  transactionCacheStorageKey,
} from '../app-model';
import { limitTransactionCache, parseTransactionCache } from '../transactions';
import type { ApiTransaction, CashFlow, EntryMode, References, TransactionPayload } from '../types';

export type DashboardTransactionsController = {
  transactions: ApiTransaction[];
  references: References;
  cashFlow: CashFlow | null;
  loading: boolean;
  loadingMore: boolean;
  error: string;
  refresh: () => Promise<void>;
  refreshSilently: () => Promise<void>;
  loadMoreTransactions: () => Promise<void>;
  addConfirmedTransaction: (
    id: string,
    payload: TransactionPayload,
    mode: EntryMode,
    account?: string,
    category?: string,
  ) => void;
  removeTransaction: (item: ApiTransaction) => void;
};

export function useDashboardTransactions(
  onReferencesLoaded: (references: References) => void,
): DashboardTransactionsController {
  const [transactions, setTransactions] = useState<ApiTransaction[]>([]);
  const [references, setReferences] = useState(emptyReferences);
  const [cashFlow, setCashFlow] = useState<CashFlow | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [transactionPage, setTransactionPage] = useState(1);
  const [transactionTotal, setTransactionTotal] = useState(0);
  const [error, setError] = useState('');
  const transactionLoadGeneration = useRef(0);
  const loadingMoreRef = useRef(false);
  const refreshingRef = useRef(false);

  const persistTransactionCache = useCallback((items: ApiTransaction[]) => {
    void AsyncStorage.setItem(
      transactionCacheStorageKey,
      JSON.stringify(limitTransactionCache(items)),
    ).catch(() => undefined);
  }, []);

  const refreshDashboard = useCallback(
    async (showLoading: boolean) => {
      transactionLoadGeneration.current += 1;
      const requestGeneration = transactionLoadGeneration.current;
      refreshingRef.current = true;
      if (showLoading) setLoading(true);
      setError('');
      try {
        const result = await loadDashboard();
        if (requestGeneration !== transactionLoadGeneration.current) return;
        setTransactions(result.page.transactions);
        persistTransactionCache(result.page.transactions);
        setTransactionPage(result.page.page);
        setTransactionTotal(result.page.total);
        setReferences(result.references);
        setCashFlow(result.cashFlow);
        void AsyncStorage.setItem(cashFlowCacheStorageKey, JSON.stringify(result.cashFlow)).catch(
          () => undefined,
        );
        void AsyncStorage.setItem(
          referenceCacheStorageKey,
          JSON.stringify(result.references),
        ).catch(() => undefined);
        onReferencesLoaded(result.references);
      } catch (cause) {
        if (requestGeneration === transactionLoadGeneration.current) {
          setError(
            cause instanceof Error
              ? cause.message
              : 'Could not connect to Spending Tracker Server.',
          );
        }
      } finally {
        if (requestGeneration === transactionLoadGeneration.current) {
          refreshingRef.current = false;
          setLoading(false);
        }
      }
    },
    [onReferencesLoaded, persistTransactionCache],
  );

  const refresh = useCallback(() => refreshDashboard(true), [refreshDashboard]);
  const refreshSilently = useCallback(() => refreshDashboard(false), [refreshDashboard]);

  const loadMoreTransactions = useCallback(async () => {
    if (
      loading ||
      refreshingRef.current ||
      loadingMoreRef.current ||
      transactions.length >= transactionTotal
    )
      return;
    const generation = transactionLoadGeneration.current;
    loadingMoreRef.current = true;
    setLoadingMore(true);
    try {
      const page = await loadTransactionPage(transactionPage + 1);
      if (generation !== transactionLoadGeneration.current) return;
      setTransactions((current) => mergeTransactionPages(current, page.transactions));
      setTransactionPage(page.page);
      setTransactionTotal(page.total);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not load more transactions.');
    } finally {
      loadingMoreRef.current = false;
      setLoadingMore(false);
    }
  }, [loading, transactionPage, transactionTotal, transactions.length]);

  useEffect(() => {
    let cancelled = false;
    const hydrateThenRefresh = async () => {
      const [cachedTransactionsValue, cachedReferencesValue, cachedCashFlowValue] =
        await Promise.all([
          AsyncStorage.getItem(transactionCacheStorageKey).catch(() => null),
          AsyncStorage.getItem(referenceCacheStorageKey).catch(() => null),
          AsyncStorage.getItem(cashFlowCacheStorageKey).catch(() => null),
        ]);
      const cached = parseTransactionCache(cachedTransactionsValue);
      const cachedReferences = parseReferenceCache(cachedReferencesValue);
      if (cancelled) return;
      if (cached.length) {
        setTransactions(cached);
        setTransactionPage(1);
        setTransactionTotal(cached.length);
      }
      if (cachedReferences) setReferences(cachedReferences);
      if (cachedCashFlowValue) {
        try {
          setCashFlow(JSON.parse(cachedCashFlowValue) as CashFlow);
        } catch {
          // Ignore corrupt cache entries and replace them on refresh.
        }
      }
      void refresh();
    };
    void hydrateThenRefresh();
    return () => {
      cancelled = true;
    };
  }, [refresh]);

  const addConfirmedTransaction = useCallback(
    (
      id: string,
      payload: TransactionPayload,
      mode: EntryMode,
      account?: string,
      category?: string,
    ) => {
      setTransactions((current) => {
        const next = prependConfirmedTransaction(current, {
          id,
          payload,
          mode,
          account,
          category,
        });
        persistTransactionCache(next);
        return next;
      });
    },
    [persistTransactionCache],
  );

  const removeTransaction = useCallback(
    (item: ApiTransaction) => {
      setTransactions((current) => {
        const next = current.filter(({ id }) => id !== item.id);
        persistTransactionCache(next);
        return next;
      });
      setTransactionTotal((current) => Math.max(0, current - 1));
      void deleteTransaction(item.id).catch((cause) => {
        setError(cause instanceof Error ? cause.message : 'Could not delete transaction.');
        void refresh();
      });
    },
    [persistTransactionCache, refresh],
  );

  return {
    transactions,
    references,
    cashFlow,
    loading,
    loadingMore,
    error,
    refresh,
    refreshSilently,
    loadMoreTransactions,
    addConfirmedTransaction,
    removeTransaction,
  };
}
