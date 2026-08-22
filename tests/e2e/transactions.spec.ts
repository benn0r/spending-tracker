import { expect, test } from './fixtures';

const references = {
  accounts: [
    { id: 'account-1', name: 'Everyday' },
    { id: 'account-2', name: 'Savings' },
  ],
  categories: [
    { id: 'food-id', name: 'Groceries', icon: 'basket', color: '#B87545' },
    { id: 'home-id', name: 'Home', icon: 'home', color: '#77409A' },
  ],
  tags: [{ id: 'weekly-id', name: 'Weekly' }],
};
const transaction = {
  id: 'transaction-1',
  date: '2026-08-09',
  amount: -64.2,
  account: 'Everyday',
  category: 'Groceries',
  payee: 'Green Grocer',
  isSplit: false,
  cleared: true,
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/cash-flow', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ currency: 'CHF', currentMonth: '2026-08', months: [] }),
    }),
  );
  await page.route('**/api/references', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(references) }),
  );
  await page.route('**/api/receipts**', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify([]) }),
  );
  await page.route('**/api/splits', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        splits: [{ id: 7, title: 'Household', splitCount: 2, transactionCount: 3 }],
      }),
    }),
  );
});

test('edits a transaction after closing details and exercises every edit-form control', async ({
  page,
}) => {
  let updated: Record<string, unknown> | undefined;
  await page.route('**/api/transactions/transaction-1', async (route) => {
    if (route.request().method() !== 'PATCH') {
      await route.fallback();
      return;
    }
    updated = route.request().postDataJSON() as Record<string, unknown>;
    await route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ status: 'ok' }),
    });
  });
  await page.route('**/api/transactions**', (route) =>
    route.request().method() === 'GET'
      ? route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 200 }),
        })
      : route.fallback(),
  );

  await page.goto('/');
  await page.getByRole('button', { name: 'View details for Green Grocer' }).click();
  const details = page.getByTestId('transaction-details-sheet');
  await details.getByRole('button', { name: 'Edit transaction' }).click();
  await expect(details).toBeHidden();

  const sheet = page.getByTestId('entry-sheet');
  await expect(sheet).toBeVisible();
  await expect(sheet.getByLabel('Amount', { exact: true })).toHaveValue('64.2');
  await expect(sheet.getByLabel('Date', { exact: true })).toHaveValue('2026-08-09');
  await expect(sheet.getByRole('radio', { name: 'Everyday' })).toBeChecked();
  await expect(sheet.getByRole('button', { name: 'Select category' })).toContainText('Groceries');

  await sheet.getByRole('tab', { name: 'Split transaction' }).click();
  await expect(sheet.getByRole('button', { name: 'Save changes' })).toBeDisabled();
  await sheet.getByRole('tab', { name: 'Transaction', exact: true }).click();
  await sheet.getByRole('radio', { name: 'Savings' }).click();
  await sheet.getByRole('tab', { name: 'Income' }).click();
  await expect(sheet.getByRole('checkbox', { name: 'Add to shared expenses' })).toHaveCount(0);
  await sheet.getByRole('tab', { name: 'Expense' }).click();

  await sheet.getByRole('button', { name: 'Select category' }).click();
  await page.getByTestId('category-sheet').getByRole('radio', { name: 'Home' }).click();
  await sheet.getByLabel('Amount', { exact: true }).fill('71.25');
  await sheet.getByLabel('Date', { exact: true }).fill('2026-08-14');
  await sheet.getByLabel('Comment', { exact: true }).fill('Updated moon garden supplies');

  await sheet.getByRole('button', { name: 'Search tags' }).click();
  const tags = page.getByTestId('tag-search-sheet');
  await tags.getByLabel('Search tags').fill('week');
  await tags.getByRole('checkbox', { name: 'Weekly' }).click();
  await tags.getByRole('button', { name: 'Done selecting tags' }).click();

  await sheet.getByRole('checkbox', { name: 'Add to shared expenses' }).click();
  const shared = page.getByTestId('expense-split-sheet');
  await shared.getByRole('radio', { name: 'Household · 2 people' }).click();
  await sheet.getByRole('button', { name: 'Shared expense' }).click();
  await page
    .getByRole('button', { name: 'Close shared expenses' })
    .click({ position: { x: 8, y: 8 } });

  await sheet.getByRole('button', { name: 'Save changes' }).click();
  await expect(sheet).toBeHidden();
  expect(updated).toEqual({
    account: 'account-2',
    category: 'home-id',
    date: '2026-08-14',
    amount: -71.25,
    notes: 'Updated moon garden supplies',
    tags: ['weekly-id'],
    expenseSplit: { mode: 'existing', splitId: 7 },
  });
});

test('shows split postings nested beneath their parent transaction', async ({ page }) => {
  const split = {
    ...transaction,
    id: 'split-parent',
    amount: -30,
    isSplit: true,
    children: [
      {
        id: 'split-food',
        category: 'Groceries',
        amount: -12,
        notes: 'Trail snacks',
        tags: ['shared'],
      },
      { id: 'split-home', category: 'Home', amount: -18, tags: [] },
    ],
  };
  await page.route('**/api/transactions**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [split], total: 1, page: 1, pageSize: 200 }),
    }),
  );

  await page.goto('/');
  await expect(page.getByLabel('Split transaction')).toBeVisible();
  await expect(page.getByLabel(/Split entry 1 of 2: Groceries/)).toBeVisible();
  await expect(page.getByLabel(/Split entry 2 of 2: Home/)).toBeVisible();
  await expect(page.getByText('− CHF 12.00')).toBeVisible();
  await expect(page.getByText('− CHF 18.00')).toBeVisible();
});

test('loads API transactions and submits a new expense', async ({ page }) => {
  let items = [transaction];
  let submitted: Record<string, unknown> | undefined;
  const today = new Date();
  const todayValue = [
    today.getFullYear(),
    String(today.getMonth() + 1).padStart(2, '0'),
    String(today.getDate()).padStart(2, '0'),
  ].join('-');
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayValue = [
    yesterday.getFullYear(),
    String(yesterday.getMonth() + 1).padStart(2, '0'),
    String(yesterday.getDate()).padStart(2, '0'),
  ].join('-');
  await page.route('**/api/transactions**', async (route) => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON();
      items = [
        { ...transaction, id: 'transaction-2', amount: -28.9, category: 'Groceries', payee: '—' },
        ...items,
      ];
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'transaction-2', status: 'created' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: items, total: items.length, page: 1, pageSize: 200 }),
    });
  });
  await page.goto('/');
  await expect(page.getByText('Good morning')).toHaveCount(0);
  await expect(page.getByLabel('Refresh transactions')).toHaveCount(0);
  await expect(page.getByText('Green Grocer')).toBeVisible();
  await expect(page.getByLabel('Verified in Actual Budget')).toBeVisible();
  await page.getByRole('button', { name: 'View details for Green Grocer' }).click();
  const details = page.getByTestId('transaction-details-sheet');
  await expect(details).toBeVisible();
  await expect(details.getByText('Everyday', { exact: true })).toBeVisible();
  await expect(details.getByText('Groceries', { exact: true })).toBeVisible();
  await expect(details.getByText('Expense', { exact: true })).toBeVisible();
  await expect(details.getByText('− CHF 64.20', { exact: true })).toBeVisible();
  await details.getByRole('button', { name: 'Close transaction details' }).click();
  await expect(details).toHaveCount(0);
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await expect(page.getByTestId('category-sheet')).toBeVisible();
  await page.getByRole('radio', { name: 'Groceries' }).click();
  await expect(page.getByLabel('Amount')).toBeFocused();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await page.getByLabel('Amount').fill('28.90');
  await expect(page.getByLabel('Date')).toHaveValue(todayValue);
  await page.getByLabel('Date').fill(yesterdayValue);
  await expect(page.getByLabel('Date')).toHaveValue(yesterdayValue);
  const weeklyTag = page.getByTestId('entry-sheet').getByRole('checkbox', { name: 'Weekly' });
  await weeklyTag.click();
  await expect(weeklyTag).toBeChecked();
  await page.getByLabel('Comment').fill('Book shop');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await expect(page.getByTestId('entry-sheet')).toBeHidden();
  await expect
    .poll(() => submitted)
    .toEqual({
      account: 'account-1',
      category: 'food-id',
      amount: -28.9,
      date: yesterdayValue,
      notes: 'Book shop',
      tags: ['weekly-id'],
    });
  await expect(page.getByText('− CHF 28.90')).toBeVisible();
});

test('creates an income with a positive Actual Budget amount', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  let items: (typeof transaction)[] = [];
  await page.route('**/api/transactions**', (route) => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON();
      items = [
        {
          ...transaction,
          id: 'income-1',
          amount: 125.5,
          payee: 'Income',
        },
      ];
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'income-1', status: 'created' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: items, total: items.length, page: 1, pageSize: 200 }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByRole('radio', { name: 'Groceries' }).click();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await page.getByRole('tab', { name: 'Income' }).click();
  await expect(page.getByRole('checkbox', { name: 'Add to shared expenses' })).toHaveCount(0);
  await page.getByLabel('Amount').fill('125.50');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect.poll(() => submitted?.amount).toBe(125.5);
  await expect(page.getByTestId('transaction-income-1').getByText('+ CHF 125.50')).toBeVisible();
});

test('loads 20 transactions initially and fetches the next page on scroll', async ({ page }) => {
  const items = Array.from({ length: 55 }, (_, index) => ({
    ...transaction,
    id: `transaction-${index}`,
    payee: `Merchant ${index}`,
  }));
  const requests: string[] = [];
  await page.route('**/api/transactions**', (route) => {
    const url = new URL(route.request().url());
    requests.push(url.search);
    const requestedPage = Number(url.searchParams.get('page'));
    const pageSize = Number(url.searchParams.get('pageSize'));
    const start = (requestedPage - 1) * pageSize;
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        transactions: items.slice(start, start + pageSize),
        total: items.length,
        page: requestedPage,
        pageSize,
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByText('Merchant 19')).toBeVisible();
  await expect(page.getByText('Recent transactions', { exact: true })).toHaveCount(0);
  expect(requests[0]).toBe('?page=1&pageSize=20');

  await page.evaluate(() => {
    const scroller = [...document.querySelectorAll<HTMLElement>('*')].find(
      (element) =>
        element.scrollHeight > element.clientHeight &&
        ['auto', 'scroll'].includes(getComputedStyle(element).overflowY),
    );
    if (!scroller) throw new Error('Transaction scroller not found');
    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect.poll(() => requests).toContain('?page=2&pageSize=20');
  await expect(page.getByText('Merchant 39')).toBeVisible();
});

test('refreshes transactions and scrolls to the top when its active tab is tapped', async ({
  page,
}) => {
  const items = Array.from({ length: 40 }, (_, index) => ({
    ...transaction,
    id: `tab-refresh-transaction-${index}`,
    payee: `Tab refresh merchant ${index}`,
  }));
  let firstPageRequests = 0;
  let refreshRequestStarted = false;
  let releaseRefreshResponse: () => void = () => undefined;
  const refreshResponseReady = new Promise<void>((resolve) => {
    releaseRefreshResponse = resolve;
  });
  await page.route('**/api/transactions**', async (route) => {
    const url = new URL(route.request().url());
    const requestedPage = Number(url.searchParams.get('page'));
    if (!url.searchParams.has('account') && requestedPage === 1) {
      firstPageRequests += 1;
      if (firstPageRequests === 2) {
        refreshRequestStarted = true;
        await refreshResponseReady;
      }
    }
    const pageSize = Number(url.searchParams.get('pageSize'));
    const start = (requestedPage - 1) * pageSize;
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        transactions: items.slice(start, start + pageSize),
        total: items.length,
        page: requestedPage,
        pageSize,
      }),
    });
  });

  await page.goto('/');
  await expect(page.getByText('Tab refresh merchant 19')).toBeVisible();
  await expect.poll(() => firstPageRequests).toBe(1);

  const list = page.getByTestId('transactions-list');
  await list.evaluate((element) => {
    const candidates = [element, ...element.querySelectorAll<HTMLElement>('*')];
    const scroller = candidates.find(
      (candidate) =>
        candidate.scrollHeight > candidate.clientHeight &&
        ['auto', 'scroll'].includes(getComputedStyle(candidate).overflowY),
    );
    if (!scroller) throw new Error('Transaction scroller not found');
    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
  await expect
    .poll(() =>
      list.evaluate((element) => {
        const candidates = [element, ...element.querySelectorAll<HTMLElement>('*')];
        return (
          candidates.find(
            (candidate) =>
              candidate.scrollHeight > candidate.clientHeight &&
              ['auto', 'scroll'].includes(getComputedStyle(candidate).overflowY),
          )?.scrollTop ?? 0
        );
      }),
    )
    .toBeGreaterThan(0);

  await page.getByRole('tab', { name: 'Transactions' }).click();

  await expect.poll(() => refreshRequestStarted).toBe(true);
  await expect(page.getByRole('progressbar')).toHaveCount(0);
  await expect(page.getByText('Tab refresh merchant 19')).toBeVisible();

  releaseRefreshResponse();

  await expect.poll(() => firstPageRequests).toBe(2);
  await expect
    .poll(() =>
      list.evaluate((element) => {
        const candidates = [element, ...element.querySelectorAll<HTMLElement>('*')];
        return (
          candidates.find(
            (candidate) =>
              candidate.scrollHeight > candidate.clientHeight &&
              ['auto', 'scroll'].includes(getComputedStyle(candidate).overflowY),
          )?.scrollTop ?? 0
        );
      }),
    )
    .toBe(0);
});

test('opens wallets without an initial loading indicator while its data is delayed', async ({
  page,
}) => {
  const walletTransaction = {
    ...transaction,
    id: 'delayed-wallet-transaction',
    payee: 'Delayed wallet merchant',
  };
  let walletRequestStarted = false;
  let releaseWalletResponse: () => void = () => undefined;
  const walletResponseReady = new Promise<void>((resolve) => {
    releaseWalletResponse = resolve;
  });
  await page.route('**/api/transactions**', async (route) => {
    const url = new URL(route.request().url());
    if (url.searchParams.has('account')) {
      walletRequestStarted = true;
      await walletResponseReady;
      return route.fulfill({
        contentType: 'application/json',
        body: JSON.stringify({
          transactions: [walletTransaction],
          total: 1,
          page: 1,
          pageSize: 20,
        }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 20 }),
    });
  });

  await page.goto('/');
  await expect(page.getByText('Green Grocer')).toBeVisible();
  await page.getByRole('tab', { name: 'Accounts' }).click();
  await expect.poll(() => walletRequestStarted).toBe(true);

  await expect(page.getByRole('button', { name: 'Select account' })).toBeVisible();
  await expect(page.getByRole('progressbar')).toHaveCount(0);

  releaseWalletResponse();
  await expect(page.getByText('Delayed wallet merchant')).toBeVisible();
});

test('swipes transactions and receipts left to delete them', async ({ page }) => {
  let transactionDeleted = false;
  let receiptDeleted = false;
  await page.unroute('**/api/receipts**');
  await page.route('**/api/transactions**', (route) => {
    if (route.request().method() === 'DELETE') {
      transactionDeleted = true;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 50 }),
    });
  });
  await page.route('**/api/receipts**', (route) => {
    if (route.request().method() === 'DELETE') {
      receiptDeleted = true;
      return route.fulfill({ status: 204 });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 8,
          filename: 'market.jpg',
          account: 'account-1',
          mimeType: 'image/jpeg',
          status: 'failed',
          suggestion: null,
          error: 'Unreadable',
          submitted: false,
          actualId: null,
          createdAt: '2026-08-09',
          processedAt: null,
          submittedAt: null,
        },
      ]),
    });
  });

  await page.goto('/');
  const transactionRow = page.getByTestId('transaction-transaction-1');
  const transactionBox = await transactionRow.boundingBox();
  if (!transactionBox) throw new Error('Transaction row has no bounds');
  await page.mouse.move(transactionBox.x + transactionBox.width - 15, transactionBox.y + 25);
  await page.mouse.down();
  await page.mouse.move(transactionBox.x + transactionBox.width - 110, transactionBox.y + 25, {
    steps: 10,
  });
  await page.mouse.up();
  await expect(page.getByTestId('transaction-details-sheet')).toHaveCount(0);
  await page.touchscreen.tap(10, 10);
  await page.waitForTimeout(300);
  await page.mouse.move(transactionBox.x + transactionBox.width - 15, transactionBox.y + 25);
  await page.mouse.down();
  await page.mouse.move(transactionBox.x + transactionBox.width - 110, transactionBox.y + 25, {
    steps: 10,
  });
  await page.mouse.up();
  await page.getByRole('button', { name: 'Delete Green Grocer', exact: true }).click();
  await expect(page.getByText('Delete Green Grocer?')).toBeVisible();
  await page.getByRole('button', { name: 'Cancel delete' }).click();
  await expect(transactionRow).toBeVisible();
  await page.getByRole('button', { name: 'Delete Green Grocer', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete Green Grocer' }).click();
  await expect(transactionRow).toHaveCount(0);
  expect(transactionDeleted).toBe(true);

  await page.getByRole('tab', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Receipts' }).click();
  await page.waitForTimeout(300);
  const receiptRow = page.getByTestId('receipt-8');
  const receiptBox = await receiptRow.boundingBox();
  if (!receiptBox) throw new Error('Receipt row has no bounds');
  await page.mouse.move(receiptBox.x + receiptBox.width - 15, receiptBox.y + 25);
  await page.mouse.down();
  await page.mouse.move(receiptBox.x + receiptBox.width - 110, receiptBox.y + 25, { steps: 10 });
  await page.mouse.up();
  await expect(page.getByLabel('Close receipt details')).toHaveCount(0);
  await page.getByRole('button', { name: 'Delete market.jpg', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete market.jpg' }).click();
  await expect(receiptRow).toHaveCount(0);
  expect(receiptDeleted).toBe(true);
});

test('selects a wallet and shows only that wallet’s transactions', async ({ page }) => {
  const savingsTransaction = {
    ...transaction,
    id: 'savings-transaction',
    account: 'Savings',
    payee: 'Savings interest',
    amount: 12,
  };
  await page.route('**/api/transactions**', (route) => {
    const url = new URL(route.request().url());
    const account = url.searchParams.get('account');
    const transactions = account === 'account-2' ? [savingsTransaction] : [transaction];
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions, total: 1, page: 1, pageSize: 50 }),
    });
  });

  await page.goto('/');
  await page.getByRole('tab', { name: 'Accounts' }).click();
  await expect(page.getByText('Green Grocer')).toBeVisible();
  await page.getByRole('button', { name: 'Select account' }).click();
  await page.getByRole('radio', { name: 'Savings' }).click();

  await expect(page.getByText('Savings interest')).toBeVisible();
  await expect(page.getByText('Green Grocer')).toHaveCount(0);
});

test('opens a processed receipt as a prefilled transaction', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  let receiptSubmitted = false;
  await page.unroute('**/api/receipts**');
  await page.route('**/api/receipts**', (route) => {
    if (route.request().method() === 'POST' && route.request().url().endsWith('/submit')) {
      submitted = route.request().postDataJSON();
      receiptSubmitted = true;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'receipt-transaction', status: 'created' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 7,
          filename: 'receipt.jpg',
          account: 'account-1',
          mimeType: 'image/jpeg',
          status: 'processed',
          suggestion: {
            merchant: 'Corner Market',
            date: '2026-08-08',
            amount: 18.75,
            currency: 'CHF',
            category: 'food-id',
            notes: 'Weekly groceries',
            tags: ['weekly-id'],
            items: [],
            splits: [],
            confidence: 0.96,
          },
          error: null,
          submitted: receiptSubmitted,
          actualId: null,
          createdAt: '2026-08-09',
          processedAt: '2026-08-09',
          submittedAt: null,
        },
      ]),
    });
  });
  await page.route('**/api/transactions**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 50 }),
    }),
  );

  await page.goto('/');
  await expect(page.getByTestId('receipt-tab-badge')).toHaveText('1');
  await page.getByRole('tab', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Receipts' }).click();
  await expect(page.getByRole('button', { name: 'Scan receipt' })).toBeVisible();
  await page.getByRole('button', { name: 'View details for Corner Market' }).click();
  await page.getByRole('button', { name: 'View Corner Market' }).click();
  await expect(page.getByTestId('receipt-preview')).toBeVisible();
  await expect(page.getByLabel('Receipt photo receipt.jpg')).toBeVisible();
  await page.getByRole('button', { name: 'Close receipt photo' }).click();
  await expect(page.getByTestId('receipt-preview')).toHaveCount(0);
  await page.getByRole('button', { name: 'View details for Corner Market' }).click();
  await page.getByRole('button', { name: 'Add Corner Market' }).click();

  await expect(page.getByTestId('entry-sheet')).toBeVisible();
  await expect(page.getByLabel('Amount')).toHaveValue('18.75');
  await expect(page.getByLabel('Date')).toHaveValue('2026-08-08');
  await expect(page.getByLabel('Comment')).toHaveValue('Corner Market · Weekly groceries');
  await expect(page.getByRole('button', { name: 'Select category' })).toContainText('Groceries');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByTestId('receipt-tab-badge')).toHaveCount(0);

  await expect
    .poll(() => submitted)
    .toEqual({
      account: 'account-1',
      category: 'food-id',
      date: '2026-08-08',
      amount: -18.75,
      notes: 'Corner Market · Weekly groceries',
      tags: ['weekly-id'],
    });
});

test('corrects an unbalanced processed receipt before submitting it', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  let receiptSubmitted = false;
  await page.unroute('**/api/receipts**');
  await page.route('**/api/receipts**', (route) => {
    if (route.request().method() === 'POST' && route.request().url().endsWith('/submit')) {
      submitted = route.request().postDataJSON();
      receiptSubmitted = true;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'corrected-receipt-transaction', status: 'created' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 9,
          filename: 'imperfect-receipt.jpg',
          account: 'account-1',
          mimeType: 'image/jpeg',
          status: 'processed',
          suggestion: {
            merchant: 'Split Cafe',
            date: '2026-08-06',
            amount: 30,
            currency: 'CHF',
            category: 'food-id',
            notes: 'Receipt total differs from detected lines',
            tags: [],
            items: [],
            splits: [
              {
                category: 'food-id',
                amount: 18,
                notes: 'Lunch',
                tags: ['weekly-id'],
              },
              { category: 'home-id', amount: 7, notes: 'Supplies', tags: [] },
            ],
            confidence: 0.71,
          },
          error: null,
          submitted: receiptSubmitted,
          actualId: null,
          createdAt: '2026-08-06',
          processedAt: '2026-08-06',
          submittedAt: null,
        },
      ]),
    });
  });
  await page.route('**/api/transactions**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 20 }),
    }),
  );

  await page.goto('/');
  await page.getByRole('tab', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Receipts' }).click();
  await page.getByRole('button', { name: 'View details for Split Cafe' }).click();
  const addReceipt = page.getByRole('button', { name: 'Add Split Cafe' });
  await expect(addReceipt).toBeVisible();
  await addReceipt.click();

  const entrySheet = page.getByTestId('entry-sheet');
  await expect(entrySheet).toBeVisible();
  await expect(entrySheet.getByText('Split 1', { exact: true })).toBeVisible();
  await expect(entrySheet.getByText('Split 2', { exact: true })).toBeVisible();
  await expect(entrySheet.getByRole('radio', { name: 'Everyday' })).toBeChecked();
  await expect(entrySheet.getByLabel('Amount', { exact: true })).toHaveValue('30');
  await expect(
    entrySheet.getByRole('button', { name: 'Select category for Split 1' }),
  ).toContainText('Groceries');
  await expect(
    entrySheet.getByRole('button', { name: 'Select category for Split 2' }),
  ).toContainText('Home');
  const splitAmounts = entrySheet.getByLabel('Split amount');
  await expect(splitAmounts.nth(0)).toHaveValue('18');
  await expect(splitAmounts.nth(1)).toHaveValue('7');

  const save = entrySheet.getByRole('button', { name: 'Save changes' });
  await expect(save).toBeDisabled();
  await expect.poll(() => submitted).toBeUndefined();

  await splitAmounts.nth(1).fill('12');
  await expect(save).toBeEnabled();
  await save.click();

  await expect(entrySheet).toBeHidden();
  await expect
    .poll(() => submitted)
    .toEqual({
      account: 'account-1',
      date: '2026-08-06',
      amount: -30,
      notes: 'Split Cafe · Receipt total differs from detected lines',
      splits: [
        { category: 'food-id', amount: -18, tags: ['weekly-id'] },
        { category: 'home-id', amount: -12 },
      ],
    });
});

test('submits a balanced split transaction', async ({ page }) => {
  let submitted: Record<string, unknown> | undefined;
  await page.route('**/api/transactions**', async (route) => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'split-1', status: 'created' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 200 }),
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page
    .getByRole('button', { name: 'Close category picker' })
    .click({ position: { x: 8, y: 8 } });
  await expect(page.getByLabel('Amount')).toBeFocused();
  await page.getByRole('tab', { name: 'Split transaction' }).click();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await page.getByLabel('Amount', { exact: true }).fill('20');
  await page.getByRole('button', { name: 'Select category for Split 1' }).click();
  await page.getByRole('radio', { name: 'Groceries' }).last().click();
  await page.getByRole('button', { name: 'Select category for Split 2' }).click();
  await page.getByRole('radio', { name: 'Groceries' }).last().click();
  const amounts = page.getByLabel('Split amount');
  await amounts.nth(0).fill('12');
  await amounts.nth(1).fill('8');
  await page.getByRole('button', { name: 'Save transaction' }).click();
  await expect
    .poll(() => submitted)
    .toEqual(
      expect.objectContaining({
        account: 'account-1',
        amount: -20,
        splits: [
          { category: 'food-id', amount: -12 },
          { category: 'food-id', amount: -8 },
        ],
      }),
    );
});

test('navigates tabs and persists the default account', async ({ page }) => {
  await page.route('**/api/transactions**', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 200 }),
    }),
  );
  await page.goto('/');

  await page.getByRole('tab', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Receipts' }).click();
  await expect(page.getByText('No receipts yet')).toBeVisible();

  await page.getByRole('tab', { name: 'Settings' }).click();
  await page.getByRole('button', { name: 'Select default account' }).click();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await expect(page.getByRole('button', { name: 'Select default account' })).toContainText(
    'Everyday',
  );

  await page.reload();
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByRole('button', { name: 'Select default account' })).toContainText(
    'Everyday',
  );
});

test('queues a failed transaction and retries it later', async ({ page }) => {
  let attempts = 0;
  let items = [transaction];
  await page.route('**/api/transactions**', async (route) => {
    if (route.request().method() === 'POST') {
      attempts += 1;
      if (attempts === 1) {
        return route.fulfill({
          status: 502,
          headers: {
            'x-request-id': 'debug-request-123',
            'access-control-expose-headers': 'x-request-id',
          },
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Budget server unavailable',
            detail: 'Actual rejected the transaction',
          }),
        });
      }
      items = [{ ...transaction, id: 'retried-1', amount: -18, payee: '—' }, ...items];
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'retried-1', status: 'created' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: items, total: items.length, page: 1, pageSize: 200 }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByRole('radio', { name: 'Groceries' }).click();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await page.getByLabel('Amount').fill('18');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect(page.getByTestId('entry-sheet')).toBeHidden();
  await expect(page.getByText('Waiting to sync')).toBeVisible();
  await expect(page.getByText('Budget server unavailable')).toBeVisible();
  await expect(page.getByText(/HTTP 502/)).toBeVisible();
  await expect(page.getByText(/Actual rejected the transaction/)).toBeVisible();
  await expect(page.getByText(/Request ID: debug-request-123/)).toBeVisible();
  await page.getByRole('button', { name: 'Retry Groceries' }).click();
  await expect(page.getByTestId('transaction-queue')).toBeHidden();
  await expect(page.getByText('− CHF 18.00')).toBeVisible();
});

test('adds a new transaction to an existing expense-sharing split', async ({ page }) => {
  let submitted: Record<string, unknown> | null = null;
  await page.route('**/api/transactions**', async (route) => {
    if (route.request().method() === 'POST') {
      submitted = route.request().postDataJSON() as Record<string, unknown>;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'shared-expense', status: 'created' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 20 }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByRole('radio', { name: 'Groceries' }).click();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await page.getByLabel('Amount').fill('21');
  await page.getByRole('checkbox', { name: 'Add to shared expenses' }).click();
  await page.getByRole('radio', { name: 'Household · 2 people' }).click();
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect
    .poll(() => submitted)
    .toMatchObject({
      amount: -21,
      expenseSplit: { mode: 'existing', splitId: 7 },
    });
});

test('persists a new transaction before its network request completes', async ({ page }) => {
  let releaseRequest: () => void = () => undefined;
  const requestPending = new Promise<void>((resolve) => {
    releaseRequest = resolve;
  });
  await page.route('**/api/transactions**', async (route) => {
    if (route.request().method() === 'POST') {
      await requestPending;
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'persisted-first', status: 'created' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 20 }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByRole('radio', { name: 'Groceries' }).click();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await page.getByLabel('Amount').fill('19');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect(page.getByTestId('entry-sheet')).toHaveCount(0);
  await expect(page.getByTestId('transaction-queue')).toBeVisible();
  await expect(page.getByTestId('transaction-transaction-1')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = localStorage.getItem('spending-tracker.transaction-queue');
        return stored ? JSON.parse(stored).length : 0;
      }),
    )
    .toBe(1);

  releaseRequest();
  await expect(page.getByTestId('transaction-queue')).toBeHidden();
});

test('restores a queued transaction after reload and retries the exact payload', async ({
  page,
}) => {
  const submittedPayloads: Record<string, unknown>[] = [];
  let items = [transaction];
  await page.route('**/api/transactions**', async (route) => {
    if (route.request().method() === 'POST') {
      const payload = route.request().postDataJSON() as Record<string, unknown>;
      submittedPayloads.push(payload);
      if (submittedPayloads.length === 1) {
        return route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Temporarily offline' }),
        });
      }
      items = [
        {
          ...transaction,
          id: 'retried-after-reload',
          date: payload.date as string,
          amount: payload.amount as number,
          payee: '—',
        },
        ...items,
      ];
      return route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({ id: 'retried-after-reload', status: 'created' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: items, total: items.length, page: 1, pageSize: 20 }),
    });
  });

  const expectedPayload = {
    account: 'account-1',
    category: 'food-id',
    date: '2026-08-07',
    amount: -31.25,
    notes: 'Persist this expense',
    tags: ['weekly-id'],
  };

  await page.goto('/');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByTestId('category-sheet').getByRole('radio', { name: 'Groceries' }).click();
  await page.getByTestId('entry-sheet').getByRole('radio', { name: 'Everyday' }).click();
  await page.getByLabel('Amount').fill('31.25');
  await page.getByLabel('Date').fill('2026-08-07');
  await page.getByTestId('entry-sheet').getByRole('checkbox', { name: 'Weekly' }).click();
  await page.getByLabel('Comment').fill('Persist this expense');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect(page.getByTestId('transaction-queue')).toBeVisible();
  await expect.poll(() => submittedPayloads).toEqual([expectedPayload]);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = localStorage.getItem('spending-tracker.transaction-queue');
        return stored ? JSON.parse(stored).length : 0;
      }),
    )
    .toBe(1);

  await page.reload();
  await expect(page.getByTestId('transaction-queue')).toBeVisible();
  await page.getByRole('button', { name: 'Retry Groceries' }).click();

  await expect.poll(() => submittedPayloads).toEqual([expectedPayload, expectedPayload]);
  await expect(page.getByTestId('transaction-queue')).toBeHidden();
  await expect(page.getByTestId('transaction-retried-after-reload')).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = localStorage.getItem('spending-tracker.transaction-queue');
        return stored ? JSON.parse(stored).length : 0;
      }),
    )
    .toBe(0);
});

test('uses cached dashboard data while offline and replaces it after retry', async ({ page }) => {
  const cachedReferences = {
    accounts: [{ id: 'cached-account', name: 'Cached Wallet' }],
    categories: [{ id: 'cached-category', name: 'Cached Food' }],
    tags: [{ id: 'cached-tag', name: 'Cached Tag' }],
  };
  const cachedTransaction = {
    ...transaction,
    id: 'cached-transaction',
    account: 'Cached Wallet',
    category: 'Cached Food',
    payee: 'Cached Market',
  };
  const liveTransaction = {
    ...transaction,
    id: 'live-transaction',
    category: 'Home',
    payee: 'Live Merchant',
  };
  let online = false;

  await page.addInitScript(
    ({ cachedItems, cachedRefs }) => {
      localStorage.setItem('spending-tracker.transactions-v1', JSON.stringify(cachedItems));
      localStorage.setItem('spending-tracker.references-v1', JSON.stringify(cachedRefs));
    },
    { cachedItems: [cachedTransaction], cachedRefs: cachedReferences },
  );
  await page.unroute('**/api/references');
  await page.route('**/api/references', (route) =>
    online
      ? route.fulfill({ contentType: 'application/json', body: JSON.stringify(references) })
      : route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Dashboard temporarily unavailable' }),
        }),
  );
  await page.route('**/api/transactions**', (route) =>
    online
      ? route.fulfill({
          contentType: 'application/json',
          body: JSON.stringify({
            transactions: [liveTransaction],
            total: 1,
            page: 1,
            pageSize: 20,
          }),
        })
      : route.fulfill({
          status: 503,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Dashboard temporarily unavailable' }),
        }),
  );

  await page.goto('/');
  await expect(page.getByText('Cached Market')).toBeVisible();
  const retry = page.getByText(/Tap to retry\./);
  await expect(retry).toBeVisible();

  await page.getByRole('button', { name: 'Add transaction' }).click();
  await expect(
    page.getByTestId('category-sheet').getByRole('radio', { name: 'Cached Food' }),
  ).toBeVisible();
  await page.getByTestId('category-sheet').getByRole('radio', { name: 'Cached Food' }).click();
  await page.getByTestId('entry-sheet').getByRole('button', { name: 'Close', exact: true }).click();
  await expect(page.getByTestId('entry-sheet')).toBeHidden();

  online = true;
  await retry.click();
  await expect(page.getByText('Live Merchant')).toBeVisible();
  await expect(page.getByText('Cached Market')).toHaveCount(0);
  await expect(page.getByText(/Tap to retry\./)).toHaveCount(0);

  await page.getByRole('button', { name: 'Add transaction' }).click();
  await expect(
    page.getByTestId('category-sheet').getByRole('radio', { name: 'Home' }),
  ).toBeVisible();
  await expect(
    page.getByTestId('category-sheet').getByRole('radio', { name: 'Cached Food' }),
  ).toHaveCount(0);
});

test('keeps server diagnostics on a queued transaction when synchronization is rejected', async ({
  page,
}) => {
  await page.route('**/api/transactions**', async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 422,
        headers: {
          'x-request-id': 'rejected-request-456',
          'access-control-expose-headers': 'x-request-id',
        },
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Transaction rejected',
          detail: 'The selected category is not available in this budget',
        }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 200 }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByRole('radio', { name: 'Groceries' }).click();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await page.getByLabel('Amount').fill('18');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect(page.getByTestId('entry-sheet')).toHaveCount(0);
  await expect(page.getByTestId('transaction-queue')).toBeVisible();
  await expect(page.getByText(/HTTP 422/)).toBeVisible();
  await expect(page.getByText(/selected category is not available/)).toBeVisible();
  await expect(page.getByText(/Request ID: rejected-request-456/)).toBeVisible();
});

test('dismisses a transaction that was already submitted despite a sync error', async ({
  page,
}) => {
  await page.route('**/api/transactions**', async (route) => {
    if (route.request().method() === 'POST') {
      return route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Could not add transaction to Actual Budget' }),
      });
    }
    return route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({ transactions: [transaction], total: 1, page: 1, pageSize: 200 }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByRole('radio', { name: 'Groceries' }).click();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await page.getByLabel('Amount').fill('17.50');
  await page.getByRole('button', { name: 'Save transaction' }).click();

  await expect(page.getByTestId('transaction-queue')).toBeVisible();
  await page.getByRole('button', { name: 'Remove Groceries from queue' }).click();
  await expect(page.getByTestId('transaction-queue')).toBeHidden();
});
