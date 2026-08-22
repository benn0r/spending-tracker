import { emptyDraft } from './transactions.ts';
import { isLocalDate } from './dates.ts';
import type {
  ApiReceipt,
  ApiTransaction,
  DraftTransaction,
  EntryMode,
  References,
  TransactionPayload,
} from './types.ts';

export { formatLocalDate, isLocalDate, parseLocalDate } from './dates.ts';
export { emptyReferences, parseReferenceCache, sortCategoryReferences } from './reference-cache.ts';
export * from './storage-keys.ts';

export type QueuedTransaction = {
  id: string;
  payload: TransactionPayload;
  mode: EntryMode;
  account: string;
  category: string;
  error: string;
  receiptId?: number;
};

export type QueuedTransactionInput = Omit<QueuedTransaction, 'id'>;

export type ConfirmedTransactionInput = {
  id: string;
  payload: TransactionPayload;
  mode: EntryMode;
  account?: string;
  category?: string;
  receiptId?: number;
};

export type PreparedReceiptDraft = {
  draft: DraftTransaction;
  mode: EntryMode;
};

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

type OptionalStringList =
  { valid: true; value: string[] | undefined } | { valid: false; value?: never };

function parseOptionalStringList(value: unknown): OptionalStringList {
  if (value === undefined) return { valid: true, value: undefined };
  if (!Array.isArray(value) || !value.every(isNonEmptyString)) return { valid: false };
  return { valid: true, value: [...value] };
}

function parseQueuedPayload(value: unknown, mode: EntryMode): TransactionPayload | null {
  if (!isRecord(value)) return null;
  if (
    !isNonEmptyString(value.account) ||
    !isNonEmptyString(value.date) ||
    !isLocalDate(value.date) ||
    typeof value.amount !== 'number' ||
    !Number.isFinite(value.amount) ||
    value.amount === 0 ||
    (value.notes !== undefined && typeof value.notes !== 'string')
  ) {
    return null;
  }
  const tags = parseOptionalStringList(value.tags);
  if (!tags.valid) return null;
  let expenseSplit: TransactionPayload['expenseSplit'];
  if (value.expenseSplit !== undefined) {
    if (!isRecord(value.expenseSplit)) return null;
    if (
      value.expenseSplit.mode === 'existing' &&
      typeof value.expenseSplit.splitId === 'number' &&
      Number.isInteger(value.expenseSplit.splitId) &&
      value.expenseSplit.splitId > 0
    ) {
      expenseSplit = { mode: 'existing', splitId: value.expenseSplit.splitId };
    } else if (
      value.expenseSplit.mode === 'new' &&
      (value.expenseSplit.title === undefined || typeof value.expenseSplit.title === 'string') &&
      typeof value.expenseSplit.splitCount === 'number' &&
      Number.isInteger(value.expenseSplit.splitCount) &&
      value.expenseSplit.splitCount > 0
    ) {
      expenseSplit = {
        mode: 'new',
        ...(value.expenseSplit.title?.trim() ? { title: value.expenseSplit.title.trim() } : {}),
        splitCount: value.expenseSplit.splitCount,
      };
    } else {
      return null;
    }
  }
  const common: TransactionPayload = {
    account: value.account,
    date: value.date,
    amount: value.amount,
    ...(value.notes === undefined ? {} : { notes: value.notes }),
    ...(tags.value === undefined ? {} : { tags: tags.value }),
    ...(expenseSplit ? { expenseSplit } : {}),
  };
  if (mode === 'transaction') {
    if (!isNonEmptyString(value.category) || value.splits !== undefined) return null;
    return { ...common, category: value.category };
  }
  if (value.category !== undefined || !Array.isArray(value.splits) || value.splits.length < 2) {
    return null;
  }
  const splits: NonNullable<TransactionPayload['splits']> = [];
  for (const candidate of value.splits) {
    if (
      !isRecord(candidate) ||
      !isNonEmptyString(candidate.category) ||
      typeof candidate.amount !== 'number' ||
      !Number.isFinite(candidate.amount) ||
      candidate.amount === 0
    ) {
      return null;
    }
    const splitTags = parseOptionalStringList(candidate.tags);
    if (!splitTags.valid) return null;
    splits.push({
      category: candidate.category,
      amount: candidate.amount,
      ...(splitTags.value === undefined ? {} : { tags: splitTags.value }),
    });
  }
  const splitTotal = splits.reduce((sum, split) => sum + split.amount, 0);
  if (Math.round(splitTotal * 100) !== Math.round(value.amount * 100)) return null;
  return { ...common, splits };
}

function parseQueuedTransaction(value: unknown): QueuedTransaction | null {
  if (
    !isRecord(value) ||
    !isNonEmptyString(value.id) ||
    (value.mode !== 'transaction' && value.mode !== 'split') ||
    !isNonEmptyString(value.account) ||
    !isNonEmptyString(value.category) ||
    typeof value.error !== 'string'
  ) {
    return null;
  }
  if (
    value.receiptId !== undefined &&
    (!Number.isInteger(value.receiptId) || (value.receiptId as number) < 1)
  ) {
    return null;
  }
  const payload = parseQueuedPayload(value.payload, value.mode);
  if (!payload) return null;
  return {
    id: value.id,
    payload,
    mode: value.mode,
    account: value.account,
    category: value.category,
    error: value.error,
    ...(value.receiptId === undefined ? {} : { receiptId: value.receiptId as number }),
  };
}

export function parseTransactionQueue(value: string | null): QueuedTransaction[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    const items: QueuedTransaction[] = [];
    const ids = new Set<string>();
    for (const candidate of parsed) {
      const item = parseQueuedTransaction(candidate);
      if (!item || ids.has(item.id)) continue;
      ids.add(item.id);
      items.push(item);
    }
    return items;
  } catch {
    return [];
  }
}

export function prepareReceiptDraft(
  receipt: ApiReceipt,
  references: References,
): PreparedReceiptDraft | null {
  const suggestion = receipt.suggestion;
  if (!suggestion) return null;
  const enabledAccounts = new Set(references.accounts.map(({ id }) => id));
  const enabledCategories = new Set(references.categories.map(({ id }) => id));
  const enabledTags = new Set(references.tags.map(({ id }) => id));
  const splits = (Array.isArray(suggestion.splits) ? suggestion.splits : [])
    .filter(({ category }) => enabledCategories.has(category))
    .map((split) => ({
      category: split.category,
      amount: String(Math.abs(split.amount)),
      tags: (Array.isArray(split.tags) ? split.tags : []).filter((tag) => enabledTags.has(tag)),
    }));
  const mode: EntryMode = splits.length >= 2 ? 'split' : 'transaction';
  const draft: DraftTransaction = {
    ...emptyDraft,
    account: receipt.account && enabledAccounts.has(receipt.account) ? receipt.account : '',
    category: enabledCategories.has(suggestion.category) ? suggestion.category : '',
    date: suggestion.date,
    amount: String(Math.abs(suggestion.amount)),
    tags: (Array.isArray(suggestion.tags) ? suggestion.tags : []).filter((tag) =>
      enabledTags.has(tag),
    ),
    comment: [suggestion.merchant, suggestion.notes].filter(Boolean).join(' · '),
    splits: mode === 'split' ? splits : emptyDraft.splits.map((split) => ({ ...split })),
  };
  return { draft, mode };
}

export function isReceiptActionable({ status, submitted }: ApiReceipt): boolean {
  return status === 'queued' || status === 'processing' || (status === 'processed' && !submitted);
}

export function countActionableReceipts(receipts: ApiReceipt[]): number {
  return receipts.filter(isReceiptActionable).length;
}

export function mergeTransactionPages(
  current: ApiTransaction[],
  incoming: ApiTransaction[],
): ApiTransaction[] {
  const seen = new Set<string>();
  const merged: ApiTransaction[] = [];
  for (const transaction of [...current, ...incoming]) {
    if (seen.has(transaction.id)) continue;
    seen.add(transaction.id);
    merged.push(transaction);
  }
  return merged;
}

export function createConfirmedTransaction({
  id,
  payload,
  mode,
  account,
  category,
}: ConfirmedTransactionInput): ApiTransaction {
  return {
    id,
    date: payload.date,
    amount: payload.amount,
    account: account ?? 'Unknown account',
    category: category ?? (mode === 'split' ? 'Split transaction' : 'Uncategorized'),
    payee: '—',
    notes: payload.notes,
    isSplit: mode === 'split',
    ...(mode === 'split'
      ? {
          children: (payload.splits ?? []).map((split, index) => ({
            id: `${id}-split-${index + 1}`,
            category: split.category,
            amount: split.amount,
            tags: split.tags ?? [],
          })),
        }
      : {}),
  };
}

export function prependConfirmedTransaction(
  current: ApiTransaction[],
  input: ConfirmedTransactionInput,
): ApiTransaction[] {
  return mergeTransactionPages([createConfirmedTransaction(input)], current);
}

export function queuedTransactionBaseId(input: QueuedTransactionInput): string {
  return `queued-${input.payload.date}-${input.payload.account}-${Math.abs(input.payload.amount)}`;
}

export function enqueueQueuedTransaction(
  current: QueuedTransaction[],
  input: QueuedTransactionInput,
): QueuedTransaction[] {
  const baseId = queuedTransactionBaseId(input);
  const existingIds = new Set(current.map(({ id }) => id));
  let suffix = 1;
  while (existingIds.has(`${baseId}-${suffix}`)) suffix += 1;
  return [{ id: `${baseId}-${suffix}`, ...input }, ...current];
}

export function replaceQueuedTransaction(
  current: QueuedTransaction[],
  replacement: QueuedTransaction,
): QueuedTransaction[] {
  if (!current.some(({ id }) => id === replacement.id)) return current;
  return current.map((item) => (item.id === replacement.id ? replacement : item));
}

export function removeQueuedTransaction(
  current: QueuedTransaction[],
  id: string,
): QueuedTransaction[] {
  return current.filter((item) => item.id !== id);
}
