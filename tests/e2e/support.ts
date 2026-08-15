import type { Locator, Page, Route } from '@playwright/test';

import type {
  ApiReceipt,
  ApiTransaction,
  CashFlow,
  References,
  TransactionPage,
} from '../../src/types';

export const fantasyReferences: References = {
  accounts: [
    { id: 'moonlight-wallet', name: 'Moonlight Wallet' },
    { id: 'dragon-hoard', name: 'Dragon Hoard' },
  ],
  categories: [
    {
      id: 'enchanted-groceries',
      name: 'Enchanted Groceries',
      icon: 'basket-outline',
      color: '#B87545',
    },
    {
      id: 'skyship-travel',
      name: 'Skyship Travel',
      icon: 'airplane-outline',
      color: '#3C91C9',
    },
  ],
  tags: [
    { id: 'weekly-quest', name: 'Weekly Quest' },
    { id: 'guild-shared', name: 'Guild Shared' },
  ],
};

export const fantasyCashFlow: CashFlow = {
  currency: 'CHF',
  currentMonth: '2026-08',
  months: [
    { month: '2026-03', income: 5200, expenses: 4100, net: 1100 },
    { month: '2026-04', income: 5400, expenses: 4300, net: 1100 },
    { month: '2026-05', income: 5600, expenses: 4450, net: 1150 },
    { month: '2026-06', income: 5500, expenses: 4700, net: 800 },
    { month: '2026-07', income: 5700, expenses: 4500, net: 1200 },
    { month: '2026-08', income: 4900, expenses: 3200, net: 1700 },
  ],
};

export function makeFantasyTransaction(overrides: Partial<ApiTransaction> = {}): ApiTransaction {
  return {
    id: 'moonbeam-transaction-1',
    date: '2026-08-09',
    amount: -42.75,
    account: 'Moonlight Wallet',
    category: 'Enchanted Groceries',
    payee: 'Moonbeam Market',
    isSplit: false,
    ...overrides,
  };
}

export function makeFantasyReceipt(overrides: Partial<ApiReceipt> = {}): ApiReceipt {
  return {
    id: 1,
    filename: 'moonbeam-market.jpg',
    account: 'moonlight-wallet',
    mimeType: 'image/jpeg',
    status: 'processed',
    suggestion: {
      merchant: 'Moonbeam Market',
      date: '2026-08-09',
      amount: 42.75,
      currency: 'CHF',
      category: 'enchanted-groceries',
      notes: 'Supplies for the observatory',
      tags: ['weekly-quest'],
      items: [],
      splits: [],
      confidence: 0.97,
    },
    error: null,
    submitted: false,
    actualId: null,
    createdAt: '2026-08-09T10:00:00.000Z',
    processedAt: '2026-08-09T10:00:03.000Z',
    submittedAt: null,
    ...overrides,
  };
}

type ApiMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
type RouteHandler = (route: Route) => Promise<void> | void;

export async function routeApi(
  page: Page,
  method: ApiMethod,
  endpoint: `/${string}`,
  handler: RouteHandler,
): Promise<void> {
  await page.route(
    (url) => url.pathname === endpoint,
    async (route) => {
      if (route.request().method() !== method) {
        await route.fallback();
        return;
      }
      await handler(route);
    },
  );
}

export async function fulfillJson(
  route: Route,
  body: unknown,
  options: { status?: number; headers?: Record<string, string> } = {},
): Promise<void> {
  await route.fulfill({
    status: options.status ?? 200,
    contentType: 'application/json',
    headers: options.headers,
    body: JSON.stringify(body),
  });
}

type DynamicList<T> = T[] | (() => T[]);

export async function setupFantasyApi(
  page: Page,
  options: {
    references?: References;
    cashFlow?: CashFlow;
    transactions?: DynamicList<ApiTransaction>;
    receipts?: DynamicList<ApiReceipt>;
  } = {},
): Promise<void> {
  const references = options.references ?? fantasyReferences;
  const cashFlow = options.cashFlow ?? fantasyCashFlow;
  const transactions = options.transactions ?? [makeFantasyTransaction()];
  const receipts = options.receipts ?? [];
  const resolveList = <T>(value: DynamicList<T>): T[] =>
    typeof value === 'function' ? value() : value;

  await routeApi(page, 'GET', '/api/references', (route) => fulfillJson(route, references));
  await routeApi(page, 'GET', '/api/cash-flow', (route) => {
    const accountId = new URL(route.request().url()).searchParams.get('account');
    return fulfillJson(route, accountId ? { ...cashFlow, balance: 254 } : cashFlow);
  });
  await routeApi(page, 'GET', '/api/transactions', (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Math.max(1, Number(url.searchParams.get('page')) || 1);
    const pageSize = Math.max(1, Number(url.searchParams.get('pageSize')) || 20);
    const accountId = url.searchParams.get('account');
    const accountName = references.accounts.find(({ id }) => id === accountId)?.name;
    const allTransactions = resolveList(transactions);
    const filteredTransactions = accountId
      ? allTransactions.filter(({ account }) => account === (accountName ?? accountId))
      : allTransactions;
    const start = (requestedPage - 1) * pageSize;
    const response: TransactionPage = {
      transactions: filteredTransactions.slice(start, start + pageSize),
      total: filteredTransactions.length,
      page: requestedPage,
      pageSize,
    };
    return fulfillJson(route, response);
  });
  await routeApi(page, 'GET', '/api/receipts', (route) =>
    fulfillJson(route, resolveList(receipts)),
  );
}

export type AppTabName = 'Transactions' | 'Accounts' | 'Receipts' | 'Settings';

export async function openTab(page: Page, tab: AppTabName): Promise<void> {
  await page.getByRole('tab', { name: tab }).click();
}

export async function openAndFillExpense(
  page: Page,
  input: {
    account: string;
    category: string;
    amount: string;
    date?: string;
    comment?: string;
    tags?: readonly string[];
  },
): Promise<Locator> {
  await page.getByRole('button', { name: 'Add transaction' }).click();
  const sheet = page.getByTestId('entry-sheet');
  const categorySheet = page.getByTestId('category-sheet');
  if (!(await categorySheet.isVisible())) {
    await sheet.getByRole('button', { name: 'Select category' }).click();
  }
  await categorySheet.getByRole('radio', { name: input.category }).click();
  await sheet.getByRole('radio', { name: input.account }).click();
  await sheet.getByLabel('Amount', { exact: true }).fill(input.amount);

  if (input.date !== undefined) await sheet.getByLabel('Date', { exact: true }).fill(input.date);
  if (input.comment !== undefined) {
    await sheet.getByLabel('Comment', { exact: true }).fill(input.comment);
  }
  for (const tag of input.tags ?? []) {
    const checkbox = sheet.getByRole('checkbox', { name: tag });
    if (!(await checkbox.isChecked())) await checkbox.click();
  }

  return sheet;
}
