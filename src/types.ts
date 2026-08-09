export type EntryMode = 'transaction' | 'split';

export type Reference = { id: string; name: string };

export type ApiTransaction = {
  id: string;
  date: string;
  amount: number;
  account: string;
  category: string;
  payee: string;
  notes?: string;
  isSplit: boolean;
};

export type TransactionPage = {
  transactions: ApiTransaction[];
  total: number;
  page: number;
  pageSize: number;
};

export type References = {
  accounts: Reference[];
  categories: Reference[];
  tags: Reference[];
};

export type SplitDraft = { category: string; amount: string; tags: string[] };

export type DraftTransaction = {
  account: string;
  category: string;
  amount: string;
  tags: string[];
  comment: string;
  splits: SplitDraft[];
};

export type TransactionPayload = {
  account: string;
  category?: string;
  date: string;
  amount: number;
  notes?: string;
  tags?: string[];
  splits?: { category: string; amount: number; tags?: string[] }[];
};
