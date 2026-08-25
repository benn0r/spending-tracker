import { formatLocalDate, isLocalDate } from './dates.ts';
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

export function transactionDayTotals(transactions: ApiTransaction[]): Record<string, number> {
  return transactions.reduce<Record<string, number>>((totals, transaction) => {
    totals[transaction.date] = (totals[transaction.date] ?? 0) + transaction.amount;
    return totals;
  }, {});
}

export type TransactionListItem =
  { kind: 'date'; date: string } | { kind: 'group'; date: string; transactions: ApiTransaction[] };

export function transactionListItems(transactions: ApiTransaction[]): TransactionListItem[] {
  const items: TransactionListItem[] = [];
  for (const transaction of transactions) {
    const currentGroup = items.at(-1);
    if (currentGroup?.kind === 'group' && currentGroup.date === transaction.date) {
      currentGroup.transactions.push(transaction);
    } else {
      items.push({ kind: 'date', date: transaction.date });
      items.push({ kind: 'group', date: transaction.date, transactions: [transaction] });
    }
  }
  return items;
}

export function isDraftValid(draft: DraftTransaction, mode: EntryMode): boolean {
  const amount = numberValue(draft.amount);
  if (
    !draft.account ||
    !Number.isFinite(amount) ||
    amount <= 0 ||
    (draft.date.length > 0 && !isLocalDate(draft.date))
  )
    return false;
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
    date: draft.date || formatLocalDate(date),
    amount: -numberValue(draft.amount),
    ...(draft.comment.trim() ? { notes: draft.comment.trim() } : {}),
  };
  if (mode === 'split') {
    return {
      ...common,
      splits: draft.splits.map((split) => ({
        category: split.category,
        amount: -numberValue(split.amount),
        ...(split.tags.length ? { tags: split.tags } : {}),
      })),
    };
  }
  return {
    ...common,
    category: draft.category,
    ...(draft.tags.length ? { tags: draft.tags } : {}),
  };
}

export function deviceLocale(): string {
  return Intl.DateTimeFormat().resolvedOptions().locale;
}

export function formatTransactionDate(date: string, locale = deviceLocale()): string {
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'short',
  }).format(value);
}

export function formatDateHeader(date: string, now = new Date(), locale = deviceLocale()): string {
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
  const value = new Date(`${date}T12:00:00`);
  if (Number.isNaN(value.getTime())) return date;
  const options = {
    day: 'numeric',
    month: 'long',
    ...(value.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' as const }),
  } as const;
  const formatter = new Intl.DateTimeFormat(locale, options);
  const shortParts = new Intl.DateTimeFormat(locale, { dateStyle: 'short' }).formatToParts(value);
  const dayIndex = shortParts.findIndex(({ type }) => type === 'day');
  const daySuffix = shortParts[dayIndex + 1]?.value.trim() === '.' ? '.' : '';
  return formatter
    .formatToParts(value)
    .map(({ type, value: part }) => (type === 'day' ? `${part}${daySuffix}` : part))
    .join('');
}
