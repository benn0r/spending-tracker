import { expect, test, type Locator, type Page } from './fixtures';

import {
  fantasyReferences,
  fulfillJson,
  makeFantasyTransaction,
  openTab,
  routeApi,
  setupFantasyApi,
} from './support';

async function scrollListToEnd(list: Locator): Promise<void> {
  await list.evaluate((element) => {
    const candidates = [element, ...element.querySelectorAll<HTMLElement>('*')];
    const scroller = candidates.find(
      (candidate) =>
        candidate.scrollHeight > candidate.clientHeight &&
        ['auto', 'scroll'].includes(getComputedStyle(candidate).overflowY),
    );
    if (!scroller) throw new Error('Scrollable list element not found');
    scroller.scrollTop = scroller.scrollHeight;
    scroller.dispatchEvent(new Event('scroll', { bubbles: true }));
  });
}

async function revealDeleteAction(page: Page, row: Locator): Promise<void> {
  const bounds = await row.boundingBox();
  if (!bounds) throw new Error('Transaction row has no bounds');
  const y = bounds.y + bounds.height / 2;
  await page.mouse.move(bounds.x + bounds.width * 0.9, y);
  await page.mouse.down();
  await page.mouse.move(bounds.x + bounds.width * 0.3, y, { steps: 12 });
  await page.mouse.up();
}

async function waitForUiCommit(page: Page): Promise<void> {
  await page.evaluate(
    () =>
      new Promise<void>((resolve) =>
        requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
      ),
  );
}

test('recovers from a cold dashboard error when the user retries', async ({ page }) => {
  const restoredTransaction = makeFantasyTransaction({
    id: 'restored-starlight-purchase',
    payee: 'Starlight Stationery',
  });
  let referenceAttempts = 0;

  await setupFantasyApi(page, { transactions: [restoredTransaction] });
  await routeApi(page, 'GET', '/api/references', async (route) => {
    referenceAttempts += 1;
    if (referenceAttempts === 1) {
      await fulfillJson(
        route,
        { error: 'Moon gate unavailable', detail: 'The ledger could not be opened.' },
        { status: 503 },
      );
      return;
    }
    await fulfillJson(route, fantasyReferences);
  });

  await page.goto('/');

  await expect(page.getByText('Couldn’t load your budget', { exact: true })).toBeVisible();
  await expect(page.getByText(/Moon gate unavailable/)).toBeVisible();
  await expect(page.getByText(/HTTP 503/)).toBeVisible();
  await expect(page.getByText('Starlight Stationery', { exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Retry loading transactions' }).click();

  await expect(page.getByText('Starlight Stationery', { exact: true })).toBeVisible();
  await expect(page.getByText('Couldn’t load your budget', { exact: true })).toHaveCount(0);
  expect(referenceAttempts).toBe(2);
});

test('shows an empty dashboard without treating it as an error', async ({ page }) => {
  await setupFantasyApi(page, { transactions: [] });

  await page.goto('/');

  await expect(page.getByText('No transactions yet.', { exact: true })).toBeVisible();
  await expect(page.getByText('0 loaded', { exact: true })).toBeVisible();
  await expect(page.getByText('CHF 0.00', { exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Add transaction' })).toBeVisible();
  await expect(page.getByText('Couldn’t load your budget', { exact: true })).toHaveCount(0);
});

test('explains that no wallets are available when references contain no accounts', async ({
  page,
}) => {
  const referencesWithoutAccounts = { ...fantasyReferences, accounts: [] };
  await setupFantasyApi(page, { references: referencesWithoutAccounts, transactions: [] });

  await page.goto('/');
  await expect(page.getByText('No transactions yet.', { exact: true })).toBeVisible();
  await openTab(page, 'Wallets');

  await expect(page.getByText('No wallets are enabled.', { exact: true })).toBeVisible();
  await expect(page.getByText('0 loaded', { exact: true })).toBeVisible();
  const selector = page.getByRole('button', { name: 'Select wallet' });
  await expect(selector).toContainText('Choose an account');
  await selector.click();
  await expect(
    page.getByText('No accounts are enabled on the server.', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Close account selector' }).click();
  await expect(page.getByTestId('account-sheet')).toHaveCount(0);
});

test('shows the selected wallet empty state independently of dashboard transactions', async ({
  page,
}) => {
  const dragonPurchase = makeFantasyTransaction({
    id: 'dragon-hoard-only',
    account: 'Dragon Hoard',
    payee: 'Cloud Castle Curios',
  });
  await setupFantasyApi(page, { transactions: [dragonPurchase] });

  await page.goto('/');
  await expect(page.getByText('Cloud Castle Curios', { exact: true })).toBeVisible();
  await openTab(page, 'Wallets');

  await expect(page.getByRole('button', { name: 'Select wallet' })).toContainText(
    'Moonlight Wallet',
  );
  await expect(page.getByText('No transactions in this wallet.', { exact: true })).toBeVisible();
  await expect(page.getByText('0 loaded', { exact: true })).toBeVisible();
  await expect(page.getByText('Cloud Castle Curios', { exact: true })).toHaveCount(0);
});

test('clears a wallet error and recovers when another wallet is selected', async ({ page }) => {
  const dashboardTransaction = makeFantasyTransaction({
    id: 'dashboard-moonlight-purchase',
    payee: 'Comet Tailor',
  });
  const dragonTransaction = makeFantasyTransaction({
    id: 'recovered-dragon-purchase',
    account: 'Dragon Hoard',
    payee: 'Phoenix Feather Forge',
  });

  await setupFantasyApi(page, { transactions: [dashboardTransaction, dragonTransaction] });
  await routeApi(page, 'GET', '/api/transactions', async (route) => {
    const url = new URL(route.request().url());
    const account = url.searchParams.get('account');
    if (account === 'moonlight-wallet') {
      await fulfillJson(
        route,
        { error: 'Moonlight ledger sealed', detail: 'Try another enchanted wallet.' },
        { status: 503 },
      );
      return;
    }
    if (account === 'dragon-hoard') {
      await fulfillJson(route, {
        transactions: [dragonTransaction],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      return;
    }
    await fulfillJson(route, {
      transactions: [dashboardTransaction, dragonTransaction],
      total: 2,
      page: 1,
      pageSize: 20,
    });
  });

  await page.goto('/');
  await expect(page.getByText('Comet Tailor', { exact: true })).toBeVisible();
  await openTab(page, 'Wallets');

  await expect(page.getByText(/Moonlight ledger sealed/)).toBeVisible();
  await expect(page.getByText(/HTTP 503/)).toBeVisible();
  await page.getByRole('button', { name: 'Select wallet' }).click();
  await page
    .getByTestId('account-sheet')
    .getByRole('radio')
    .filter({ hasText: 'Dragon Hoard' })
    .click();

  await expect(page.getByText('Phoenix Feather Forge', { exact: true })).toBeVisible();
  await expect(page.getByText(/Moonlight ledger sealed/)).toHaveCount(0);
  await expect(page.getByText('1 loaded', { exact: true })).toBeVisible();
});

test('loads additional wallet pages with the selected account filter', async ({ page }) => {
  const transactions = Array.from({ length: 45 }, (_, index) =>
    makeFantasyTransaction({
      id: `moonlight-page-${index}`,
      payee: `Astral Merchant ${index}`,
      account: 'Moonlight Wallet',
    }),
  );
  const walletRequests: { account: string | null; page: string | null; pageSize: string | null }[] =
    [];
  page.on('request', (request) => {
    const url = new URL(request.url());
    if (request.method() !== 'GET' || url.pathname !== '/api/transactions') return;
    if (!url.searchParams.has('account')) return;
    walletRequests.push({
      account: url.searchParams.get('account'),
      page: url.searchParams.get('page'),
      pageSize: url.searchParams.get('pageSize'),
    });
  });
  await setupFantasyApi(page, { transactions });

  await page.goto('/');
  await openTab(page, 'Wallets');
  await expect(page.getByText('20 loaded', { exact: true })).toBeVisible();
  expect(walletRequests[0]).toEqual({
    account: 'moonlight-wallet',
    page: '1',
    pageSize: '20',
  });

  const list = page.getByTestId('wallets-list');
  await scrollListToEnd(list);
  await expect.poll(() => walletRequests.some((request) => request.page === '2')).toBe(true);
  await expect
    .poll(async () => {
      const text = await page.getByText(/\d+ loaded/).textContent();
      return Number.parseInt(text ?? '0', 10);
    })
    .toBeGreaterThanOrEqual(40);
  await scrollListToEnd(list);

  await expect(page.getByText('Astral Merchant 39', { exact: true })).toBeVisible();
  expect(walletRequests.find((request) => request.page === '2')).toEqual({
    account: 'moonlight-wallet',
    page: '2',
    pageSize: '20',
  });
});

test('ignores a stale wallet response after a rapid wallet switch', async ({ page }) => {
  const staleTransaction = makeFantasyTransaction({
    id: 'stale-moonlight-response',
    payee: 'Outdated Observatory Shop',
  });
  const currentTransaction = makeFantasyTransaction({
    id: 'current-dragon-response',
    account: 'Dragon Hoard',
    payee: 'Current Griffin Grocer',
  });
  let moonlightRequestStarted = false;
  let releaseMoonlightRequest: () => void = () => undefined;
  const moonlightResponseReady = new Promise<void>((resolve) => {
    releaseMoonlightRequest = resolve;
  });

  await routeApi(page, 'GET', '/api/references', (route) => fulfillJson(route, fantasyReferences));
  await routeApi(page, 'GET', '/api/receipts', (route) => fulfillJson(route, []));
  await routeApi(page, 'GET', '/api/transactions', async (route) => {
    const account = new URL(route.request().url()).searchParams.get('account');
    if (account === 'moonlight-wallet') {
      moonlightRequestStarted = true;
      await moonlightResponseReady;
      await fulfillJson(route, {
        transactions: [staleTransaction],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      return;
    }
    if (account === 'dragon-hoard') {
      await fulfillJson(route, {
        transactions: [currentTransaction],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      return;
    }
    await fulfillJson(route, { transactions: [], total: 0, page: 1, pageSize: 20 });
  });

  await page.goto('/');
  await expect(page.getByText('No transactions yet.', { exact: true })).toBeVisible();
  await openTab(page, 'Wallets');
  await expect.poll(() => moonlightRequestStarted).toBe(true);

  await page.getByRole('button', { name: 'Select wallet' }).click();
  await page
    .getByTestId('account-sheet')
    .getByRole('radio')
    .filter({ hasText: 'Dragon Hoard' })
    .click();
  await expect(page.getByText('Current Griffin Grocer', { exact: true })).toBeVisible();

  const staleResponse = page.waitForResponse((response) => {
    const url = new URL(response.url());
    return (
      response.request().method() === 'GET' &&
      url.pathname === '/api/transactions' &&
      url.searchParams.get('account') === 'moonlight-wallet'
    );
  });
  releaseMoonlightRequest();
  await staleResponse;
  await waitForUiCommit(page);

  await expect(page.getByRole('button', { name: 'Select wallet' })).toContainText('Dragon Hoard');
  await expect(page.getByText('Current Griffin Grocer', { exact: true })).toBeVisible();
  await expect(page.getByText('Outdated Observatory Shop', { exact: true })).toHaveCount(0);
});

test('restores a wallet transaction when its optimistic delete fails', async ({ page }) => {
  const transaction = makeFantasyTransaction({
    id: 'nebula-noodles-purchase',
    payee: 'Nebula Noodles',
  });
  let deleteStarted = false;
  let releaseDelete: () => void = () => undefined;
  const deleteResponseReady = new Promise<void>((resolve) => {
    releaseDelete = resolve;
  });

  await setupFantasyApi(page, { transactions: [transaction] });
  await routeApi(page, 'DELETE', `/api/transactions/${transaction.id}`, async (route) => {
    deleteStarted = true;
    await deleteResponseReady;
    await fulfillJson(route, { error: 'The deletion charm fizzled.' }, { status: 503 });
  });

  await page.goto('/');
  await openTab(page, 'Wallets');
  const row = page.getByTestId(`transaction-${transaction.id}`);
  await expect(row).toBeVisible();
  await revealDeleteAction(page, row);
  await page.getByRole('button', { name: 'Delete Nebula Noodles', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm delete Nebula Noodles' }).click();

  await expect.poll(() => deleteStarted).toBe(true);
  await expect(row).toHaveCount(0);
  releaseDelete();

  await expect(row).toBeVisible();
  await expect(page.getByText('Nebula Noodles', { exact: true })).toBeVisible();
  await expect(page.getByText('1 loaded', { exact: true })).toBeVisible();
});
