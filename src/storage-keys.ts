export const defaultAccountStorageKey = 'spending-tracker.default-account';
export const transactionQueueStorageKey = 'spending-tracker.transaction-queue';
export const transactionCacheStorageKey = 'spending-tracker.transactions-v1';
export const referenceCacheStorageKey = 'spending-tracker.references-v1';
export const cashFlowCacheStorageKey = 'spending-tracker.cash-flow-v1';
export const receiptCacheStorageKey = 'spending-tracker.receipts-v1';
export const expenseSplitCacheStorageKey = 'spending-tracker.expense-splits-v1';
export const accountCacheStorageKey = (accountId: string) =>
  `spending-tracker.account-v1.${accountId}`;
