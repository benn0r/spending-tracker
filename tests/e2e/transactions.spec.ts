import { expect, test } from '@playwright/test';

const references = {
  accounts: [{ id: 'account-1', name: 'Everyday' }],
  categories: [
    { id: 'food-id', name: 'Groceries' },
    { id: 'home-id', name: 'Home' },
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
};

test.beforeEach(async ({ page }) => {
  await page.route('**/api/references', (route) =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify(references) }),
  );
});

test('loads API transactions and submits a new expense', async ({ page }) => {
  let items = [transaction];
  let submitted: Record<string, unknown> | undefined;
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
  await expect(page.getByText('Green Grocer')).toBeVisible();
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await page.getByLabel('Amount').fill('28.90');
  await page.getByRole('radio', { name: 'Groceries' }).click();
  await page.getByRole('checkbox', { name: 'Weekly' }).click();
  await page.getByLabel('Comment').fill('Book shop');
  await page.getByRole('button', { name: 'Save expense' }).click();
  await expect
    .poll(() => submitted)
    .toEqual({
      account: 'account-1',
      category: 'food-id',
      amount: -28.9,
      date: expect.any(String),
      notes: 'Book shop',
      tags: ['weekly-id'],
    });
  await expect(page.getByText('− CHF 28.90')).toBeVisible();
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
  await page.getByRole('tab', { name: 'Split transaction' }).click();
  await page.getByRole('radio', { name: 'Everyday' }).click();
  await page.getByLabel('Amount').fill('20');
  const categoryChoices = page.getByRole('radio', { name: 'Groceries' });
  await categoryChoices.nth(0).click();
  await categoryChoices.nth(1).click();
  const amounts = page.getByLabel('Split amount');
  await amounts.nth(0).fill('12');
  await amounts.nth(1).fill('8');
  await page.getByRole('button', { name: 'Save expense' }).click();
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
