import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { deleteReceipt, loadReceipts } from '../api';
import { countActionableReceipts, receiptCacheStorageKey } from '../app-model';
import type { ApiReceipt } from '../types';

export type UseReceiptsResult = {
  receipts: ApiReceipt[];
  receiptsLoading: boolean;
  receiptCount: number;
  refreshReceipts: () => Promise<void>;
  removeReceipt: (receipt: ApiReceipt) => void;
};

export function useReceipts(): UseReceiptsResult {
  const [receipts, setReceipts] = useState<ApiReceipt[]>([]);
  const [receiptsLoading, setReceiptsLoading] = useState(true);

  const refreshReceipts = useCallback(async () => {
    try {
      const loaded = await loadReceipts();
      setReceipts(loaded);
      void AsyncStorage.setItem(receiptCacheStorageKey, JSON.stringify(loaded)).catch(
        () => undefined,
      );
    } finally {
      setReceiptsLoading(false);
    }
  }, []);

  const receiptCount = countActionableReceipts(receipts);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(receiptCacheStorageKey)
      .catch(() => null)
      .then((stored) => {
        if (!active || !stored) return;
        try {
          const cached = JSON.parse(stored) as unknown;
          if (Array.isArray(cached)) setReceipts(cached as ApiReceipt[]);
        } catch {
          // Ignore corrupt cache entries and replace them on refresh.
        }
      })
      .finally(() => {
        if (active) void refreshReceipts().catch(() => undefined);
      });
    return () => {
      active = false;
    };
  }, [refreshReceipts]);

  useEffect(() => {
    if (!receipts.some(({ status }) => status === 'queued' || status === 'processing')) return;
    const poll = setTimeout(() => void refreshReceipts().catch(() => undefined), 2_500);
    return () => clearTimeout(poll);
  }, [receipts, refreshReceipts]);

  useEffect(() => {
    if (Platform.OS !== 'ios') return;
    let cancelled = false;
    const updateBadge = async () => {
      let permissions = await Notifications.getPermissionsAsync();
      if (receiptCount > 0 && permissions.ios?.allowsBadge !== true) {
        permissions = await Notifications.requestPermissionsAsync({
          ios: { allowAlert: false, allowBadge: true, allowSound: false },
        });
      }
      if (!cancelled && (receiptCount === 0 || permissions.ios?.allowsBadge === true)) {
        await Notifications.setBadgeCountAsync(receiptCount);
      }
    };
    void updateBadge().catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [receiptCount]);

  const removeReceipt = useCallback(
    (receipt: ApiReceipt) => {
      setReceipts((current) => {
        const next = current.filter(({ id }) => id !== receipt.id);
        void AsyncStorage.setItem(receiptCacheStorageKey, JSON.stringify(next)).catch(
          () => undefined,
        );
        return next;
      });
      void deleteReceipt(receipt.id).catch(() => void refreshReceipts().catch(() => undefined));
    },
    [refreshReceipts],
  );

  return { receipts, receiptsLoading, receiptCount, refreshReceipts, removeReceipt };
}
