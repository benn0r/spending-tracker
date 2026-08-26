import { expect, test, type Page } from './fixtures';
import {
  fulfillJson,
  makeFantasyReceipt,
  makeFantasyTransaction,
  openTab,
  routeApi,
  setupFantasyApi,
} from './support';

async function expectEveryVisibleControlNamed(page: Page) {
  const unnamed = await page
    .locator(
      'button, input, textarea, [role="button"], [role="tab"], [role="radio"], [role="checkbox"]',
    )
    .evaluateAll((controls) =>
      controls
        .filter((control) => {
          const element = control as HTMLElement;
          if (!element.offsetParent) return false;
          return !(
            element.getAttribute('aria-label')?.trim() ||
            element.getAttribute('aria-labelledby')?.trim() ||
            element.textContent?.trim() ||
            (element as HTMLInputElement).placeholder?.trim()
          );
        })
        .map((control) => control.outerHTML.slice(0, 180)),
    );
  expect(unnamed).toEqual([]);
}

test('all app pages, drawers, buttons, and inputs are reachable and accessibly named', async ({
  page,
}) => {
  const receipt = makeFantasyReceipt({
    id: 21,
    filename: 'controls-audit.pdf',
    mimeType: 'application/pdf',
  });
  await setupFantasyApi(page, { transactions: [makeFantasyTransaction()], receipts: [receipt] });
  await routeApi(page, 'GET', '/api/splits', (route) =>
    fulfillJson(route, {
      splits: [
        {
          id: 7,
          title: 'Household',
          splitCount: 2,
          transactionCount: 1,
          totalAmount: 42,
          balance: 21,
        },
      ],
    }),
  );
  await routeApi(page, 'GET', '/api/splits/7', (route) =>
    fulfillJson(route, {
      id: 7,
      title: 'Household',
      splitCount: 2,
      transactionCount: 1,
      totalAmount: 42,
      balance: 21,
      entries: [
        {
          id: 1,
          kind: 'transaction',
          transactionId: 'moonbeam-transaction-1',
          description: 'Moonbeam Market',
          amount: 42,
          date: '2026-08-09',
          wallet: 'Moonlight Wallet',
          categoryName: 'Enchanted Groceries',
        },
      ],
      settlements: [],
    }),
  );

  await page.goto('/');
  await expectEveryVisibleControlNamed(page);

  await page.getByRole('button', { name: 'View details for Moonbeam Market' }).click();
  await expectEveryVisibleControlNamed(page);
  await page
    .getByRole('button', { name: 'Close transaction details' })
    .click({ position: { x: 8, y: 8 } });

  await page.getByRole('button', { name: 'Add transaction' }).click();
  await expectEveryVisibleControlNamed(page);
  await page
    .getByRole('button', { name: 'Close category picker' })
    .click({ position: { x: 8, y: 8 } });
  const entry = page.getByTestId('entry-sheet');
  await entry.getByRole('button', { name: 'Search tags' }).click();
  await expectEveryVisibleControlNamed(page);
  await page.getByRole('button', { name: 'Close tag search' }).click({ position: { x: 8, y: 8 } });
  await entry.getByRole('button', { name: 'Cancel transaction' }).click();

  await openTab(page, 'Accounts');
  await expectEveryVisibleControlNamed(page);
  await page.getByRole('button', { name: 'Select account' }).click();
  await expectEveryVisibleControlNamed(page);
  await page.getByRole('radio', { name: 'Dragon Hoard' }).click();

  await page.getByRole('link', { name: 'More' }).click();
  await expectEveryVisibleControlNamed(page);
  await page.getByRole('button', { name: 'Shared expenses' }).click();
  await page.getByRole('button', { name: 'View shared expense Household' }).click();
  await expect(page.getByText('Your balance')).toBeVisible();
  await expectEveryVisibleControlNamed(page);
  await page.getByRole('button', { name: 'Close shared expense details' }).last().click();
  await page.getByRole('button', { name: 'Back to More' }).click();

  await page.getByRole('button', { name: 'Receipts' }).click();
  await page.getByRole('button', { name: 'View details for Moonbeam Market' }).click();
  await expectEveryVisibleControlNamed(page);
  await page
    .getByRole('button', { name: 'View Moonbeam Market' })
    .evaluate((button: HTMLElement) => button.click());
  await expect(page.getByTestId('receipt-preview')).toBeVisible();
  await expectEveryVisibleControlNamed(page);
  await page
    .getByRole('button', { name: 'Close receipt photo' })
    .last()
    .click({ position: { x: 8, y: 8 } });
  await expect(page.getByTestId('receipt-preview')).toHaveCount(0);

  await openTab(page, 'Settings');
  await expectEveryVisibleControlNamed(page);
  await page.getByRole('button', { name: 'Edit server connection' }).click();
  await expect(page.getByLabel('Server URL')).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'API token', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Show API token' }).click();
  await expectEveryVisibleControlNamed(page);
  await page.getByRole('button', { name: 'Close server connection settings' }).last().click();
});

test('every application action can be pressed through its real screen or drawer', async ({
  page,
}) => {
  test.setTimeout(60_000);
  const receipt = makeFantasyReceipt({ id: 31, filename: 'complete-controls.jpg' });
  await setupFantasyApi(page, { transactions: [makeFantasyTransaction()], receipts: [receipt] });
  await routeApi(page, 'GET', '/api/splits', (route) =>
    fulfillJson(route, {
      splits: [
        {
          id: 7,
          title: 'Household',
          splitCount: 2,
          transactionCount: 1,
          totalAmount: 42,
          balance: 21,
        },
      ],
    }),
  );

  await page.goto('/');

  // Transaction detail actions and confirmation branches.
  await page.getByRole('button', { name: 'View details for Moonbeam Market' }).click();
  await page.getByRole('button', { name: 'Delete transaction' }).click();
  await page.getByRole('button', { name: 'Cancel delete' }).click();
  await page.getByRole('button', { name: 'Edit transaction' }).click();
  await page.getByRole('button', { name: 'Cancel transaction' }).click();

  // Every transaction-form mode, nested drawer, selector, and input.
  await page.getByRole('button', { name: 'Add transaction' }).click();
  await page
    .getByRole('button', { name: 'Close category picker' })
    .click({ position: { x: 8, y: 8 } });
  const entry = page.getByTestId('entry-sheet');
  await entry.getByRole('button', { name: 'Select category' }).click();
  await page.getByRole('radio', { name: 'Enchanted Groceries' }).click();
  await entry.getByRole('radio', { name: 'Dragon Hoard' }).click();
  await entry.getByRole('tab', { name: 'Income' }).click();
  await entry.getByRole('tab', { name: 'Expense' }).click();
  await entry.getByLabel('Amount', { exact: true }).fill('24.50');
  await entry.getByLabel('Date', { exact: true }).fill('2026-08-20');
  await entry.getByLabel('Comment', { exact: true }).fill('Complete action audit');

  await entry.getByRole('button', { name: 'Search tags' }).click();
  await page.getByRole('button', { name: 'Close tag search' }).click({ position: { x: 8, y: 8 } });
  await entry.getByRole('button', { name: 'Search tags' }).click();
  const tagSearch = page.getByTestId('tag-search-sheet');
  await tagSearch.getByLabel('Search tags').fill('Weekly');
  await tagSearch.getByRole('checkbox', { name: 'Weekly Quest' }).click();
  await page.getByRole('button', { name: 'Done selecting tags' }).click();

  await entry.getByRole('checkbox', { name: 'Add to shared expenses' }).click();
  await page
    .getByRole('button', { name: 'Close shared expenses' })
    .click({ position: { x: 8, y: 8 } });
  await entry.getByRole('button', { name: 'Shared expense' }).click();
  await page.getByRole('radio', { name: 'Create shared expense' }).click();
  await entry.getByLabel('Split name').fill('Action audit split');
  await entry.getByLabel('Number of people').fill('3');

  await entry.getByRole('tab', { name: 'Split transaction' }).click();
  await entry.getByRole('button', { name: 'Select category for Split 1' }).click();
  await page.getByRole('radio', { name: 'Enchanted Groceries' }).click();
  await entry.getByRole('button', { name: 'Select category for Split 2' }).click();
  await page.getByRole('radio', { name: 'Skyship Travel' }).click();
  await entry.getByRole('tab', { name: 'Transaction', exact: true }).click();
  await entry.getByRole('button', { name: 'Cancel transaction' }).click();

  // Account drawer close and selection paths.
  await openTab(page, 'Accounts');
  await page.getByRole('button', { name: 'Select account' }).click();
  await page
    .getByRole('button', { name: 'Close account selector' })
    .click({ position: { x: 8, y: 8 } });
  await page.getByRole('button', { name: 'Select account' }).click();
  await page.getByRole('radio', { name: 'Dragon Hoard' }).click();

  // Both More destinations, receipt preview, and receipt-to-transaction action.
  await page.getByRole('link', { name: 'More' }).click();
  await page.getByRole('button', { name: 'Shared expenses' }).click();
  await page.getByRole('button', { name: 'Back to More' }).click();
  await page.getByRole('button', { name: 'Receipts' }).click();
  await page.getByRole('button', { name: 'View details for Moonbeam Market' }).click();
  await page
    .getByRole('button', { name: 'View Moonbeam Market' })
    .evaluate((button: HTMLElement) => button.click());
  await expect(page.getByTestId('receipt-preview')).toBeVisible();
  await page
    .getByRole('button', { name: 'Close receipt photo' })
    .last()
    .click({ position: { x: 8, y: 8 } });
  await page.getByRole('button', { name: 'View details for Moonbeam Market' }).click();
  await page.getByRole('button', { name: 'Add Moonbeam Market' }).click();
  await page.getByRole('button', { name: 'Cancel transaction' }).click();

  // Settings account and connection drawers, token visibility, save, and close.
  await openTab(page, 'Settings');
  await page.getByRole('button', { name: 'Select default account' }).click();
  await page.getByRole('radio', { name: 'Moonlight Wallet' }).click();
  await page.getByRole('button', { name: 'Edit server connection' }).click();
  await page.getByRole('button', { name: 'Show API token' }).click();
  await page.getByRole('button', { name: 'Hide API token' }).click();
  await page.getByRole('button', { name: 'Save connection' }).click();
  await page.getByRole('button', { name: 'Edit server connection' }).click();
  await page
    .getByRole('button', { name: 'Close server connection settings' })
    .click({ position: { x: 8, y: 8 } });
});
