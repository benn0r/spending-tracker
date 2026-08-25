import { expect, test, type Page } from './fixtures';

import {
  fantasyReferences,
  fulfillJson,
  openAndFillExpense,
  openTab,
  routeApi,
  setupFantasyApi,
} from './support';

async function openFantasyApp(page: Page): Promise<void> {
  await page.goto('/');
  await expect(page.getByText('Moonbeam Market')).toBeVisible();
}

test('persists a dismissed settings selection, prefills it, and prevents double submission', async ({
  page,
}) => {
  const submitted: Record<string, unknown>[] = [];
  let releaseSubmission: (() => void) | undefined;
  const submissionMayFinish = new Promise<void>((resolve) => {
    releaseSubmission = resolve;
  });

  await setupFantasyApi(page);
  await routeApi(page, 'POST', '/api/transactions', async (route) => {
    submitted.push(route.request().postDataJSON() as Record<string, unknown>);
    await submissionMayFinish;
    await fulfillJson(route, { id: 'dragon-expense-1', status: 'created' }, { status: 201 });
  });
  await openFantasyApp(page);

  await openTab(page, 'Settings');
  const selector = page.getByRole('button', { name: 'Select default account' });
  await expect(selector).toContainText('Choose an account');
  await selector.click();
  await page.getByRole('radio', { name: 'Dragon Hoard' }).click();
  await expect(selector).toContainText('Dragon Hoard');

  await openTab(page, 'Accounts');
  await expect(page.getByRole('button', { name: 'Select account' })).toContainText('Dragon Hoard');
  await openTab(page, 'Settings');

  await selector.click();
  await expect(page.getByRole('radio', { name: 'Dragon Hoard' })).toBeChecked();
  await page
    .getByRole('button', { name: 'Close account selector' })
    .click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId('account-sheet')).toBeHidden();
  await expect(selector).toContainText('Dragon Hoard');

  await page.reload();
  await page.goto('/');
  await expect(page.getByText('Moonbeam Market')).toBeVisible();
  await openTab(page, 'Settings');
  await expect(page.getByRole('button', { name: 'Select default account' })).toContainText(
    'Dragon Hoard',
  );

  await openTab(page, 'Transactions');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page
    .getByTestId('category-sheet')
    .getByRole('radio', { name: 'Enchanted Groceries' })
    .click();
  const sheet = page.getByTestId('entry-sheet');
  await expect(sheet.getByRole('radio', { name: 'Dragon Hoard' })).toBeChecked();
  await sheet.getByLabel('Amount', { exact: true }).fill('13.40');
  await sheet.getByLabel('Date', { exact: true }).fill('2026-08-10');
  await sheet.getByLabel('Comment', { exact: true }).fill('Stardust provisions');

  const save = sheet.getByRole('button', { name: 'Save transaction' });
  await save.click();
  await expect.poll(() => submitted.length).toBe(1);
  await expect(save).toBeDisabled();
  await save.dispatchEvent('click');
  await expect.poll(() => submitted.length).toBe(1);
  expect(submitted).toEqual([
    {
      account: 'dragon-hoard',
      category: 'enchanted-groceries',
      date: '2026-08-10',
      amount: -13.4,
      notes: 'Stardust provisions',
    },
  ]);

  releaseSubmission?.();
  await expect(sheet).toBeHidden();
});

test('shows empty account settings and keeps an otherwise complete expense disabled', async ({
  page,
}) => {
  await setupFantasyApi(page, {
    references: { ...fantasyReferences, accounts: [] },
    transactions: [],
  });
  await page.goto('/');
  await expect(page.getByText('No transactions yet.')).toBeVisible();

  await openTab(page, 'Settings');
  const selector = page.getByRole('button', { name: 'Select default account' });
  await expect(selector).toContainText('Choose an account');
  await selector.click();
  await expect(page.getByText('No accounts are enabled on the server.')).toBeVisible();
  await page
    .getByRole('button', { name: 'Close account selector' })
    .click({ position: { x: 8, y: 8 } });

  await openTab(page, 'Transactions');
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page
    .getByTestId('category-sheet')
    .getByRole('radio', { name: 'Enchanted Groceries' })
    .click();
  const sheet = page.getByTestId('entry-sheet');
  await sheet.getByLabel('Amount', { exact: true }).fill('12.50');
  await sheet.getByLabel('Date', { exact: true }).fill('2026-08-11');
  await expect(sheet.getByRole('button', { name: 'Save transaction' })).toBeDisabled();
  await expect(sheet.getByRole('radio')).toHaveCount(0);
});

test('resets the form after both close and cancel', async ({ page }) => {
  await setupFantasyApi(page);
  await openFantasyApp(page);

  let sheet = await openAndFillExpense(page, {
    account: 'Dragon Hoard',
    category: 'Skyship Travel',
    amount: '88.20',
    date: '2026-08-12',
    comment: 'Airship passage',
    tags: ['Guild Shared'],
  });
  await page
    .getByRole('button', { name: 'Close transaction form' })
    .click({ position: { x: 8, y: 8 } });
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page
    .getByRole('button', { name: 'Close category picker' })
    .click({ position: { x: 8, y: 8 } });
  sheet = page.getByTestId('entry-sheet');
  await expect(sheet.getByLabel('Amount', { exact: true })).toHaveValue('');
  await expect(sheet.getByLabel('Comment', { exact: true })).toHaveValue('');
  await expect(sheet.getByRole('button', { name: 'Select category' })).toContainText(
    'Choose a category',
  );
  await expect(sheet.getByRole('radio', { name: 'Dragon Hoard' })).not.toBeChecked();

  await sheet.getByRole('button', { name: 'Select category' }).click();
  await page
    .getByTestId('category-sheet')
    .getByRole('radio', { name: 'Enchanted Groceries' })
    .click();
  await sheet.getByRole('radio', { name: 'Moonlight Wallet' }).click();
  await sheet.getByLabel('Amount', { exact: true }).fill('7');
  await sheet.getByText('Cancel', { exact: true }).click();
  await expect(sheet).toBeHidden();

  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page
    .getByRole('button', { name: 'Close category picker' })
    .click({ position: { x: 8, y: 8 } });
  sheet = page.getByTestId('entry-sheet');
  await expect(sheet.getByLabel('Amount', { exact: true })).toHaveValue('');
  await expect(sheet.getByRole('button', { name: 'Select category' })).toContainText(
    'Choose a category',
  );
  await expect(sheet.getByRole('radio', { name: 'Moonlight Wallet' })).not.toBeChecked();
  await page.getByLabel('Close transaction form').click({ position: { x: 8, y: 8 } });
  await expect(sheet).toBeHidden();
});

test('rejects an invalid local date and submits the corrected exact date', async ({ page }) => {
  const submitted: Record<string, unknown>[] = [];
  await setupFantasyApi(page);
  await routeApi(page, 'POST', '/api/transactions', (route) => {
    submitted.push(route.request().postDataJSON() as Record<string, unknown>);
    return fulfillJson(route, { id: 'leap-day-expense', status: 'created' }, { status: 201 });
  });
  await openFantasyApp(page);

  const sheet = await openAndFillExpense(page, {
    account: 'Moonlight Wallet',
    category: 'Enchanted Groceries',
    amount: '19.95',
    date: '2026-02-29',
  });
  const save = sheet.getByRole('button', { name: 'Save transaction' });
  await expect(save).toBeDisabled();

  await sheet.getByLabel('Date', { exact: true }).fill('2028-02-29');
  await expect(save).toBeEnabled();
  await save.click();
  await expect(sheet).toBeHidden();
  expect(submitted).toEqual([
    {
      account: 'moonlight-wallet',
      category: 'enchanted-groceries',
      date: '2028-02-29',
      amount: -19.95,
    },
  ]);
});

test('commits tag search choices only with Done and submits exact tag IDs', async ({ page }) => {
  const submitted: Record<string, unknown>[] = [];
  await setupFantasyApi(page);
  await routeApi(page, 'POST', '/api/transactions', (route) => {
    submitted.push(route.request().postDataJSON() as Record<string, unknown>);
    return fulfillJson(route, { id: 'tagged-expense', status: 'created' }, { status: 201 });
  });
  await openFantasyApp(page);

  const sheet = await openAndFillExpense(page, {
    account: 'Moonlight Wallet',
    category: 'Skyship Travel',
    amount: '24',
    date: '2026-08-13',
    comment: 'Shared navigation charts',
    tags: ['Weekly Quest'],
  });
  const guildTag = sheet.getByRole('checkbox', { name: 'Guild Shared' });
  await expect(guildTag).not.toBeChecked();

  await sheet.getByRole('button', { name: 'Search tags' }).click();
  let tagSearch = page.getByTestId('tag-search-sheet');
  await tagSearch.getByRole('textbox', { name: 'Search tags' }).fill('guild');
  await tagSearch.getByRole('checkbox', { name: 'Guild Shared' }).click();
  await page.getByLabel('Close tag search').click({ position: { x: 8, y: 8 } });
  await expect(tagSearch).toBeHidden();
  await expect(guildTag).not.toBeChecked();
  await expect(sheet.getByRole('checkbox', { name: 'Weekly Quest' })).toBeChecked();

  await sheet.getByRole('button', { name: 'Search tags' }).click();
  tagSearch = page.getByTestId('tag-search-sheet');
  await expect(tagSearch.getByRole('textbox', { name: 'Search tags' })).toHaveValue('');
  await tagSearch.getByRole('textbox', { name: 'Search tags' }).fill('guild');
  await tagSearch.getByRole('checkbox', { name: 'Guild Shared' }).click();
  await tagSearch.getByRole('button', { name: 'Done selecting tags' }).click();
  await expect(guildTag).toBeChecked();

  await sheet.getByRole('button', { name: 'Save transaction' }).click();
  await expect(sheet).toBeHidden();
  expect(submitted).toEqual([
    {
      account: 'moonlight-wallet',
      category: 'skyship-travel',
      date: '2026-08-13',
      amount: -24,
      notes: 'Shared navigation charts',
      tags: ['weekly-quest', 'guild-shared'],
    },
  ]);
});

test('creates a missing Actual Budget tag and submits its returned ID', async ({ page }) => {
  const submitted: Record<string, unknown>[] = [];
  const createdTags: string[] = [];
  await setupFantasyApi(page);
  await routeApi(page, 'POST', '/api/references/tags', (route) => {
    const { name } = route.request().postDataJSON() as { name: string };
    createdTags.push(name);
    return fulfillJson(route, { id: 'starlight-id', name }, { status: 201 });
  });
  await routeApi(page, 'POST', '/api/transactions', (route) => {
    submitted.push(route.request().postDataJSON() as Record<string, unknown>);
    return fulfillJson(route, { id: 'new-tag-expense', status: 'created' }, { status: 201 });
  });
  await openFantasyApp(page);

  const sheet = await openAndFillExpense(page, {
    account: 'Moonlight Wallet',
    category: 'Skyship Travel',
    amount: '18',
    date: '2026-08-13',
    comment: 'Starlight map',
  });
  await sheet.getByRole('button', { name: 'Search tags' }).click();
  const tagSearch = page.getByTestId('tag-search-sheet');
  await tagSearch.getByRole('textbox', { name: 'Search tags' }).fill('starlight');
  const createTag = tagSearch.getByRole('button', { name: 'Create tag starlight' });
  const noMatches = tagSearch.getByText('No matching tags.');
  await expect(createTag).toBeVisible();
  await expect(noMatches).toBeVisible();
  expect(
    await createTag.evaluate(
      (createButton, emptyMessage) => {
        if (!(emptyMessage instanceof Node)) return false;
        return Boolean(
          createButton.compareDocumentPosition(emptyMessage) & Node.DOCUMENT_POSITION_FOLLOWING,
        );
      },
      await noMatches.elementHandle(),
    ),
  ).toBe(true);
  await createTag.click();
  await expect(tagSearch.getByRole('textbox', { name: 'Search tags' })).toHaveValue('');
  await tagSearch.getByRole('button', { name: 'Done selecting tags' }).click();
  await sheet.getByRole('button', { name: 'Save transaction' }).click();
  await expect(sheet).toBeHidden();

  expect(createdTags).toEqual(['starlight']);
  expect(submitted[0]?.tags).toEqual(['starlight-id']);
});
