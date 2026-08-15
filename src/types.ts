export type EntryMode = 'transaction' | 'split';

export type Reference = { id: string; name: string };
export type CategoryReference = Reference & {
  icon?: string;
  iconId?: number | null;
  color?: string;
  sortOrder?: number | null;
};

export type ApiTransaction = {
  id: string;
  date: string;
  amount: number;
  account: string;
  category: string;
  payee: string;
  notes?: string;
  tags?: string[];
  isSplit: boolean;
  children?: {
    id: string;
    category: string;
    amount: number;
    notes?: string;
    tags: string[];
  }[];
  cleared?: boolean;
  type?: 'Expense' | 'Income' | 'Transfer';
  transferAccount?: string;
};

export type TransactionPage = {
  transactions: ApiTransaction[];
  total: number;
  page: number;
  pageSize: number;
};

export type CashFlowMonth = {
  month: string;
  income: number;
  expenses: number;
  net: number;
};

export type CashFlow = {
  currency: string;
  currentMonth: string;
  months: CashFlowMonth[];
  balance?: number;
};

export type References = {
  accounts: Reference[];
  categories: CategoryReference[];
  tags: Reference[];
};

export type ExpenseSplitSummary = {
  id: number;
  title: string;
  splitCount: number;
  transactionCount: number;
};

export type ExpenseSplitSelection =
  { mode: 'existing'; splitId: number } | { mode: 'new'; title?: string; splitCount: number };

export type SplitDraft = { category: string; amount: string; tags: string[] };

export type DraftTransaction = {
  account: string;
  category: string;
  date: string;
  amount: string;
  tags: string[];
  comment: string;
  splits: SplitDraft[];
};

export type ReceiptSuggestion = {
  merchant: string;
  date: string;
  amount: number;
  currency: string;
  category: string;
  notes: string;
  tags: string[];
  items: {
    description: string;
    quantity: number;
    unitAmount: number;
    totalAmount: number;
    category?: string;
  }[];
  splits: { category: string; amount: number; notes: string; tags: string[] }[];
  confidence: number;
};

export type ApiReceipt = {
  id: number;
  filename: string;
  account: string | null;
  mimeType: string;
  status: 'queued' | 'processing' | 'processed' | 'failed';
  suggestion: ReceiptSuggestion | null;
  error: string | null;
  submitted: boolean;
  actualId: string | null;
  createdAt: string;
  processedAt: string | null;
  submittedAt: string | null;
};

export type TransactionPayload = {
  account: string;
  category?: string;
  date: string;
  amount: number;
  notes?: string;
  tags?: string[];
  splits?: { category: string; amount: number; tags?: string[] }[];
  expenseSplit?: ExpenseSplitSelection;
};
