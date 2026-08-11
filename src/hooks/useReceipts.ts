import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { deleteReceipt, loadReceipts } from '../api';
import { countActionableReceipts } from '../app-model';
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
      setReceipts(await loadReceipts());
    } finally {
      setReceiptsLoading(false);
    }
  }, []);

  const receiptCount = countActionableReceipts(receipts);

  useEffect(() => {
    const initialLoad = setTimeout(() => void refreshReceipts().catch(() => undefined), 0);
    return () => clearTimeout(initialLoad);
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
      setReceipts((current) => current.filter(({ id }) => id !== receipt.id));
      void deleteReceipt(receipt.id).catch(() => void refreshReceipts().catch(() => undefined));
    },
    [refreshReceipts],
  );

  return { receipts, receiptsLoading, receiptCount, refreshReceipts, removeReceipt };
}
