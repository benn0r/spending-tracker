import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  ApiError,
  describeSubmissionError,
  submitReceiptTransaction,
  submitTransaction,
} from '../api';
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
  const itemsRef = useRef<QueuedTransaction[]>([]);
  const persistence = useRef(Promise.resolve());

  const commit = useCallback((next: QueuedTransaction[]) => {
    itemsRef.current = next;
    setItems(next);
    const write = () =>
      next.length
        ? AsyncStorage.setItem(transactionQueueStorageKey, JSON.stringify(next))
        : AsyncStorage.removeItem(transactionQueueStorageKey);
    persistence.current = persistence.current.catch(() => undefined).then(write);
    return persistence.current;
  }, []);

  useEffect(() => {
    let active = true;
    void AsyncStorage.getItem(transactionQueueStorageKey)
      .catch(() => null)
      .then((stored) => {
        if (!active) return;
        const restored = parseTransactionQueue(stored);
        const currentIds = new Set(itemsRef.current.map(({ id }) => id));
        const next = [...itemsRef.current, ...restored.filter(({ id }) => !currentIds.has(id))];
        itemsRef.current = next;
        setItems(next);
      });
    return () => {
      active = false;
    };
  }, []);

  const enqueue = useCallback(
    async (transaction: QueuedTransactionInput) => {
      const next = enqueueQueuedTransaction(itemsRef.current, transaction);
      const queued = next[0]!;
      await commit(next);
      return queued;
    },
    [commit],
  );

  const retry = useCallback(
    async (item: QueuedTransaction, discardClientErrors = false) => {
      setRetryingId(item.id);
      try {
        const created = item.receiptId
          ? await submitReceiptTransaction(item.receiptId, item.payload)
          : await submitTransaction(item.payload);
        await commit(removeQueuedTransaction(itemsRef.current, item.id));
        onConfirmed({
          id: created.id,
          payload: item.payload,
          mode: item.mode,
          account: item.account,
          category: item.category,
          ...(item.receiptId ? { receiptId: item.receiptId } : {}),
        });
        void onRefresh();
      } catch (cause) {
        if (
          discardClientErrors &&
          cause instanceof ApiError &&
          cause.status !== undefined &&
          cause.status < 500
        ) {
          await commit(removeQueuedTransaction(itemsRef.current, item.id));
          throw cause;
        }
        const error = describeSubmissionError(cause);
        await commit(replaceQueuedTransaction(itemsRef.current, { ...item, error }));
      } finally {
        setRetryingId(null);
      }
    },
    [commit, onConfirmed, onRefresh],
  );

  const discard = useCallback(
    (item: QueuedTransaction) => {
      void commit(removeQueuedTransaction(itemsRef.current, item.id));
    },
    [commit],
  );

  return { items, retryingId, enqueue, retry, discard };
}
