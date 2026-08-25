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
