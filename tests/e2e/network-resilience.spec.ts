import { expect, test } from './fixtures';
import {
  fantasyCashFlow,
  fantasyReferences,
  fulfillJson,
  makeFantasyTransaction,
  routeApi,
} from './support';

test('keeps loading controls responsive on a slow connection and renders delayed data', async ({
  page,
}) => {
  const delayed = makeFantasyTransaction({ payee: 'Delayed Dragon Bakery' });
  await routeApi(page, 'GET', '/api/references', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 900));
    await fulfillJson(route, fantasyReferences);
  });
  await routeApi(page, 'GET', '/api/transactions', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1_100));
    await fulfillJson(route, { transactions: [delayed], total: 1, page: 1, pageSize: 20 });
  });
  await routeApi(page, 'GET', '/api/cash-flow', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await fulfillJson(route, fantasyCashFlow);
  });
  await routeApi(page, 'GET', '/api/receipts', (route) => fulfillJson(route, []));
  await routeApi(page, 'GET', '/api/splits', (route) => fulfillJson(route, { splits: [] }));

  await page.goto('/');
  await expect(page.getByRole('tab', { name: 'Settings' })).toBeVisible();
  await page.getByRole('tab', { name: 'Settings' }).click();
  await expect(page.getByText('Server connection')).toBeVisible();
  await page.getByRole('tab', { name: 'Transactions' }).click();
  await expect(page.getByText('Delayed Dragon Bakery')).toBeVisible();
});

test('surfaces an unreachable server and successfully retries after connectivity returns', async ({
  page,
}) => {
  let online = false;
  for (const endpoint of ['/api/references', '/api/transactions', '/api/cash-flow'] as const) {
    await routeApi(page, 'GET', endpoint, async (route) => {
      if (!online) {
        await route.abort('connectionrefused');
        return;
      }
      if (endpoint === '/api/references') await fulfillJson(route, fantasyReferences);
      else if (endpoint === '/api/cash-flow') await fulfillJson(route, fantasyCashFlow);
      else
        await fulfillJson(route, {
          transactions: [makeFantasyTransaction()],
          total: 1,
          page: 1,
          pageSize: 20,
        });
    });
  }
  await routeApi(page, 'GET', '/api/receipts', (route) => fulfillJson(route, []));
  await routeApi(page, 'GET', '/api/splits', (route) => fulfillJson(route, { splits: [] }));

  await page.goto('/');
  await expect(page.getByText('Couldn’t load your budget')).toBeVisible();
  await expect(page.getByText(/Network request did not receive a response/)).toBeVisible();
  online = true;
  await page.getByRole('button', { name: 'Retry loading transactions' }).click();
  await expect(page.getByText('Moonbeam Market')).toBeVisible();
});
