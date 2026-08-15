import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { loadExpenseSplits } from '../api';
import { expenseSplitCacheStorageKey } from '../app-model';
import type { ExpenseSplitSummary } from '../types';

export function useExpenseSplits() {
  const [splits, setSplits] = useState<ExpenseSplitSummary[]>([]);
  const refresh = useCallback(async () => {
    const loaded = await loadExpenseSplits();
    setSplits(loaded);
    void AsyncStorage.setItem(expenseSplitCacheStorageKey, JSON.stringify(loaded)).catch(
      () => undefined,
    );
  }, []);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(expenseSplitCacheStorageKey)
      .catch(() => null)
      .then((stored) => {
        if (!active || !stored) return;
        try {
          const cached = JSON.parse(stored) as unknown;
          if (Array.isArray(cached)) setSplits(cached as ExpenseSplitSummary[]);
        } catch {
          // Ignore corrupt cache entries and replace them on refresh.
        }
      })
      .finally(() => {
        if (active) void refresh().catch(() => undefined);
      });
    return () => {
      active = false;
    };
  }, [refresh]);

  return { expenseSplits: splits, refreshExpenseSplits: refresh };
}
