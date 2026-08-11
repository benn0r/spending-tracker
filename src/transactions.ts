import type { ApiTransaction, DraftTransaction, EntryMode, TransactionPayload } from './types';

export const transactionCacheSize = 20;

export function limitTransactionCache(transactions: ApiTransaction[]): ApiTransaction[] {
  return transactions.slice(0, transactionCacheSize);
}

export function parseTransactionCache(value: string | null): ApiTransaction[] {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return limitTransactionCache(
      parsed.filter(
        (item): item is ApiTransaction =>
          typeof item === 'object' &&
          item !== null &&
          typeof (item as ApiTransaction).id === 'string' &&
          typeof (item as ApiTransaction).date === 'string' &&
          typeof (item as ApiTransaction).amount === 'number' &&
          typeof (item as ApiTransaction).account === 'string' &&
          typeof (item as ApiTransaction).category === 'string' &&
          typeof (item as ApiTransaction).payee === 'string' &&
          typeof (item as ApiTransaction).isSplit === 'boolean',
      ),
    );
  } catch {
    return [];
  }
}

export const emptyDraft: DraftTransaction = {
  account: '',
  category: '',
  date: '',
  amount: '',
  tags: [],
  comment: '',
  splits: [
    { category: '', amount: '', tags: [] },
    { category: '', amount: '', tags: [] },
  ],
};

function numberValue(value: string): number {
  return Number(value.replace(',', '.'));
}

export function formatCurrency(amount: number): string {
  const sign = amount < 0 ? '−' : '+';
  return `${sign} CHF ${Math.abs(amount).toLocaleString('en-CH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function summarize(transactions: ApiTransaction[]) {
  const income = transactions.reduce((total, item) => total + Math.max(0, item.amount), 0);
  const spent = transactions.reduce((total, item) => total + Math.abs(Math.min(0, item.amount)), 0);
  return { income, spent, balance: income - spent };
}

export function isDraftValid(draft: DraftTransaction, mode: EntryMode): boolean {
  const amount = numberValue(draft.amount);
  if (!draft.account || !Number.isFinite(amount) || amount <= 0) return false;
  if (mode === 'transaction') return Boolean(draft.category);
  if (draft.splits.length < 2) return false;
  const splitAmounts = draft.splits.map((split) => numberValue(split.amount));
  return (
    draft.splits.every((split) => Boolean(split.category)) &&
    splitAmounts.every((value) => Number.isFinite(value) && value > 0) &&
    Math.round(splitAmounts.reduce((sum, value) => sum + value, 0) * 100) ===
      Math.round(amount * 100)
  );
}

export function createPayload(
  draft: DraftTransaction,
  mode: EntryMode,
  date = new Date(),
): TransactionPayload {
  if (!isDraftValid(draft, mode)) throw new Error('Complete all required transaction fields.');
  const common = {
    account: draft.account,
    date: draft.date || date.toISOString().slice(0, 10),
    amount: -numberValue(draft.amount),
    notes: draft.comment.trim() || undefined,
  };
  if (mode === 'split') {
    return {
      ...common,
      splits: draft.splits.map((split) => ({
        category: split.category,
        amount: -numberValue(split.amount),
        tags: split.tags.length ? split.tags : undefined,
      })),
    };
  }
  return {
    ...common,
    category: draft.category,
    tags: draft.tags.length ? draft.tags : undefined,
  };
}

export function formatTransactionDate(date: string): string {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat(undefined, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(value);
}

export function formatDateHeader(date: string, now = new Date()): string {
  const localValue = (value: Date) =>
    [
      value.getFullYear(),
      String(value.getMonth() + 1).padStart(2, '0'),
      String(value.getDate()).padStart(2, '0'),
    ].join('-');
  if (date === localValue(now)) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === localValue(yesterday)) return 'Yesterday';
  return formatTransactionDate(date);
}
