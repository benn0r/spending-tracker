import { expect, test } from './fixtures';

test('requires and saves server connection details on first launch', async ({ page }) => {
  await page.goto('/?setup=1');

  await expect(page.getByRole('heading', { name: 'Connect your server' })).toBeVisible();
  await page.getByRole('button', { name: 'Save connection' }).click();
  await expect(page.getByText(/complete server URL/)).toBeVisible();
  await page.getByLabel('Server URL').fill('not a url');
  await page.getByRole('button', { name: 'Save connection' }).click();
  await expect(page.getByText(/complete server URL/)).toBeVisible();
  await page.getByLabel('Server URL').fill('https://spending.example.test/');
  await page.getByRole('button', { name: 'Save connection' }).click();
  await expect(page.getByText(/Enter the API token/)).toBeVisible();
  await page.getByRole('textbox', { name: 'API token', exact: true }).fill('e2e-token');
  await page.getByRole('button', { name: 'Show API token' }).click();
  await expect(page.getByRole('button', { name: 'Hide API token' })).toBeVisible();
  await page.getByRole('button', { name: 'Hide API token' }).click();
  await page.getByRole('button', { name: 'Save connection' }).click();

  await expect(page.getByRole('link', { name: 'Transactions' })).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(() => window.localStorage.getItem('spending-tracker.server-config.v2')),
    )
    .toBe(JSON.stringify({ serverUrl: 'https://spending.example.test', apiToken: 'e2e-token' }));
});
