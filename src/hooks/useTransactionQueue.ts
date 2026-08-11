import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { describeSubmissionError, submitTransaction } from '../api';
import {
  enqueueQueuedTransaction,
  parseTransactionQueue,
  removeQueuedTransaction,
  replaceQueuedTransaction,
  transactionQueueStorageKey,
  type ConfirmedTransactionInput,
  type QueuedTransaction,
  type QueuedTransactionInput,
} from '../app-model';

export function useTransactionQueue({
  onConfirmed,
  onRefresh,
}: {
  onConfirmed: (transaction: ConfirmedTransactionInput) => void;
  onRefresh: () => Promise<void>;
}) {
  const [items, setItems] = useState<QueuedTransaction[]>([]);
  const [retryingId, setRetryingId] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(transactionQueueStorageKey)
      .catch(() => null)
      .then((stored) => {
        if (!active) return;
        const restored = parseTransactionQueue(stored);
        setItems((current) => {
          const currentIds = new Set(current.map(({ id }) => id));
          return [...current, ...restored.filter(({ id }) => !currentIds.has(id))];
        });
      })
      .finally(() => {
        if (active) setHydrated(true);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    if (items.length) {
      void AsyncStorage.setItem(transactionQueueStorageKey, JSON.stringify(items));
    } else {
      void AsyncStorage.removeItem(transactionQueueStorageKey);
    }
  }, [hydrated, items]);

  const enqueue = useCallback((transaction: QueuedTransactionInput) => {
    setItems((current) => enqueueQueuedTransaction(current, transaction));
  }, []);

  const retry = useCallback(
    async (item: QueuedTransaction) => {
      setRetryingId(item.id);
      try {
        const created = await submitTransaction(item.payload);
        setItems((current) => removeQueuedTransaction(current, item.id));
        onConfirmed({
          id: created.id,
          payload: item.payload,
          mode: item.mode,
          account: item.account,
          category: item.category,
        });
        void onRefresh();
      } catch (cause) {
        const error = describeSubmissionError(cause);
        setItems((current) => replaceQueuedTransaction(current, { ...item, error }));
      } finally {
        setRetryingId(null);
      }
    },
    [onConfirmed, onRefresh],
  );

  const discard = useCallback((item: QueuedTransaction) => {
    setItems((current) => removeQueuedTransaction(current, item.id));
  }, []);

  return { items, retryingId, enqueue, retry, discard };
}
