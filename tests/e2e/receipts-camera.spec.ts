import { expect, test } from './fixtures';

import {
  fantasyReferences,
  fulfillJson,
  makeFantasyReceipt,
  openTab,
  routeApi,
  setupFantasyApi,
} from './support';

const tinyJpeg = Buffer.from(
  '/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAf/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABBQJ//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAwEBPwF//8QAFBEBAAAAAAAAAAAAAAAAAAAAAP/aAAgBAgEBPwF//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQAGPwJ//8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPyF//9oADAMBAAIAAwAAABD/xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAEDAQE/EB//xAAUEQEAAAAAAAAAAAAAAAAAAAAA/9oACAECAQE/EB//xAAUEAEAAAAAAAAAAAAAAAAAAAAA/9oACAEBAAE/EB//2Q==',
  'base64',
);

test('captures a receipt file, uploads its multipart contents, and refreshes the queue', async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem('spending-tracker.default-account', 'dragon-hoard');
  });
  let receipts = [] as ReturnType<typeof makeFantasyReceipt>[];
  const multipart: { body: Buffer | null; contentType: string } = {
    body: null,
    contentType: '',
  };
  let markUploadStarted: () => void = () => {};
  let releaseUpload: () => void = () => {};
  const uploadStarted = new Promise<void>((resolve) => {
    markUploadStarted = resolve;
  });
  const uploadReleased = new Promise<void>((resolve) => {
    releaseUpload = resolve;
  });

  await setupFantasyApi(page, { receipts: () => receipts });
  await routeApi(page, 'POST', '/api/receipts', async (route) => {
    multipart.body = route.request().postDataBuffer();
    multipart.contentType = route.request().headers()['content-type'] ?? '';
    receipts = [
      makeFantasyReceipt({
        id: 20,
        filename: 'starlight-camera.jpg',
        status: 'queued',
        suggestion: null,
        processedAt: null,
      }),
    ];
    markUploadStarted();
    await uploadReleased;
    await fulfillJson(route, { id: 20, status: 'queued' }, { status: 201 });
  });

  await page.goto('/');
  await openTab(page, 'Receipts');

  const scanReceipt = page.getByRole('button', { name: 'Scan receipt' });
  const chooserPromise = page.waitForEvent('filechooser');
  await scanReceipt.click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'starlight-camera.jpg',
    mimeType: 'image/jpeg',
    buffer: tinyJpeg,
  });

  await uploadStarted;
  try {
    await expect(scanReceipt).toBeDisabled();
    await expect(page.getByText('Uploading receipt…')).toBeVisible();
    expect(multipart.contentType).toMatch(/^multipart\/form-data;\s*boundary=/i);
    if (multipart.body === null) throw new Error('Multipart request body was not captured');
    const body = multipart.body;
    const multipartText = body.toString('latin1');
    expect(multipartText).toContain('name="account"');
    expect(multipartText).toContain('dragon-hoard');
    expect(multipartText).toContain('name="receipt"; filename="starlight-camera.jpg"');
    expect(multipartText).toContain('Content-Type: image/jpeg');
    expect(body.indexOf(tinyJpeg)).toBeGreaterThanOrEqual(0);
  } finally {
    releaseUpload();
  }

  await expect(page.getByText('Uploading receipt…')).toHaveCount(0);
  await expect(scanReceipt).toBeEnabled();
  await expect(page.getByTestId('receipt-20')).toContainText('Processing receipt…');
  await expect(page.getByTestId('receipt-tab-badge')).toHaveText('1');
});

test('cancels the web camera chooser without uploading a receipt', async ({ page }) => {
  let uploadRequests = 0;
  await setupFantasyApi(page);
  await routeApi(page, 'POST', '/api/receipts', (route) => {
    uploadRequests += 1;
    return fulfillJson(route, { id: 21, status: 'queued' }, { status: 201 });
  });

  await page.goto('/');
  await openTab(page, 'Receipts');

  const scanReceipt = page.getByRole('button', { name: 'Scan receipt' });
  const chooserPromise = page.waitForEvent('filechooser');
  await scanReceipt.click();
  const chooser = await chooserPromise;
  await chooser.setFiles([]);

  await expect(page.locator('[data-testid="file-input"]')).toHaveCount(0);
  await expect(scanReceipt).toBeEnabled();
  await expect(page.getByText('Uploading receipt…')).toHaveCount(0);
  expect(uploadRequests).toBe(0);
});

test('chooses a receipt from the photo library and uploads it', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('spending-tracker.default-account', 'moonlight-wallet');
  });
  let uploaded = false;
  await setupFantasyApi(page);
  await routeApi(page, 'POST', '/api/receipts', async (route) => {
    const body = route.request().postDataBuffer();
    expect(body?.toString('latin1')).toContain('filename="starlight-library.jpg"');
    uploaded = true;
    await fulfillJson(route, { id: 22, status: 'queued' }, { status: 201 });
  });

  await page.goto('/');
  await openTab(page, 'Receipts');

  const chooserPromise = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Choose receipt photo' }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles({
    name: 'starlight-library.jpg',
    mimeType: 'image/jpeg',
    buffer: tinyJpeg,
  });

  await expect.poll(() => uploaded).toBe(true);
  await expect(page.getByText('Uploading receipt…')).toHaveCount(0);
});

test('does not open the camera when no account is enabled', async ({ page }) => {
  let uploadRequests = 0;
  await setupFantasyApi(page, {
    references: { ...fantasyReferences, accounts: [] },
  });
  await routeApi(page, 'POST', '/api/receipts', (route) => {
    uploadRequests += 1;
    return fulfillJson(route, { id: 22, status: 'queued' }, { status: 201 });
  });

  await page.goto('/');
  await openTab(page, 'Receipts');
  await page.getByRole('button', { name: 'Scan receipt' }).click();

  await expect(page.getByText('Enable an account before scanning a receipt.')).toBeVisible();
  await expect(page.locator('[data-testid="file-input"]')).toHaveCount(0);
  expect(uploadRequests).toBe(0);
});

test('polls a queued receipt until its processed suggestion is actionable', async ({ page }) => {
  const queuedReceipt = makeFantasyReceipt({
    id: 30,
    filename: 'starlight-bakery.jpg',
    status: 'queued',
    suggestion: null,
    processedAt: null,
  });
  const suggestion = makeFantasyReceipt().suggestion;
  if (!suggestion) throw new Error('Fantasy receipt must have a suggestion');
  const processedReceipt = makeFantasyReceipt({
    id: 30,
    filename: 'starlight-bakery.jpg',
    suggestion: { ...suggestion, merchant: 'Starlight Bakery', amount: 16.5 },
  });
  let processed = false;
  let receiptReads = 0;

  await setupFantasyApi(page, {
    receipts: () => {
      receiptReads += 1;
      return [processed ? processedReceipt : queuedReceipt];
    },
  });

  await page.goto('/');
  await openTab(page, 'Receipts');
  await expect(page.getByTestId('receipt-30')).toContainText('Processing receipt…');
  await expect(page.getByRole('button', { name: 'Add receipt' })).toHaveCount(0);

  processed = true;
  await expect.poll(() => receiptReads, { timeout: 6_000 }).toBeGreaterThanOrEqual(2);
  await expect(page.getByTestId('receipt-30')).toContainText('Starlight Bakery');
  await expect(page.getByTestId('receipt-30')).toContainText('CHF 16.5');
  await page.getByRole('button', { name: 'View details for Starlight Bakery' }).click();
  await page.getByRole('button', { name: 'Add Starlight Bakery' }).click();

  // The receipt Modal must finish closing before the transaction Modal opens.
  // Mounting both at once freezes native input handling on iOS.
  await expect(page.getByTestId('entry-sheet')).toHaveCount(0);
  await expect(page.getByTestId('receipt-details-sheet')).toHaveCount(0);
  await expect(page.getByTestId('entry-sheet')).toBeVisible();
  await expect(page.getByLabel('Amount', { exact: true })).toHaveValue('16.5');
});

test('renders successful, failed, and non-image receipt previews', async ({ page }) => {
  const baseSuggestion = makeFantasyReceipt().suggestion;
  if (!baseSuggestion) throw new Error('Fantasy receipt must have a suggestion');
  const imageReceipt = makeFantasyReceipt({
    id: 31,
    filename: 'prism-pastries.jpg',
    suggestion: { ...baseSuggestion, merchant: 'Prism Pastries' },
  });
  const brokenReceipt = makeFantasyReceipt({
    id: 32,
    filename: 'broken-moon-map.jpg',
    suggestion: { ...baseSuggestion, merchant: 'Broken Moon Map' },
  });
  const documentReceipt = makeFantasyReceipt({
    id: 33,
    filename: 'guild-invoice.pdf',
    mimeType: 'application/pdf',
    suggestion: { ...baseSuggestion, merchant: 'Guild Invoice' },
  });
  let successfulImageRequests = 0;
  let successfulImageAuthorization = '';
  let brokenImageRequests = 0;
  let documentFileRequests = 0;

  await setupFantasyApi(page, { receipts: [imageReceipt, brokenReceipt, documentReceipt] });
  await routeApi(page, 'GET', '/api/receipts/31/file', async (route) => {
    successfulImageRequests += 1;
    successfulImageAuthorization = route.request().headers().authorization ?? '';
    await route.fulfill({ status: 200, contentType: 'image/jpeg', body: tinyJpeg });
  });
  await routeApi(page, 'GET', '/api/receipts/32/file', async (route) => {
    brokenImageRequests += 1;
    await route.fulfill({ status: 404, contentType: 'text/plain', body: 'Image unavailable' });
  });
  await routeApi(page, 'GET', '/api/receipts/33/file', async (route) => {
    documentFileRequests += 1;
    await route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.4' });
  });

  await page.goto('/');
  await openTab(page, 'Receipts');

  await page.getByRole('button', { name: 'View details for Prism Pastries' }).click();
  await page.getByRole('button', { name: 'View Prism Pastries' }).click();
  await expect(page.getByTestId('receipt-preview')).toBeVisible();
  await expect
    .poll(async () => {
      const image = page.locator('img[alt="Receipt photo prism-pastries.jpg"]');
      return (await image.count())
        ? image.evaluate((element) => (element as HTMLImageElement).naturalWidth)
        : 0;
    })
    .toBeGreaterThan(0);
  expect(successfulImageRequests).toBeGreaterThan(0);
  expect(successfulImageAuthorization).toBe('Bearer e2e-api-key');
  await expect(page.getByText('Could not load this receipt photo.')).toHaveCount(0);
  await page
    .getByRole('button', { name: 'Close receipt photo' })
    .last()
    .click({ position: { x: 8, y: 8 } });

  await page.getByRole('button', { name: 'View details for Broken Moon Map' }).click();
  await page.getByRole('button', { name: 'View Broken Moon Map' }).click();
  await expect(page.getByText('Could not load this receipt photo.')).toBeVisible();
  expect(brokenImageRequests).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Close receipt photo' }).last().click();

  await page.getByRole('button', { name: 'View details for Guild Invoice' }).click();
  await page.getByRole('button', { name: 'View Guild Invoice' }).click();
  await expect(page.getByText('Photo preview is unavailable for this file.')).toBeVisible();
  await expect(page.getByLabel('Receipt photo guild-invoice.pdf')).toHaveCount(0);
  expect(documentFileRequests).toBe(0);
  await page.getByRole('button', { name: 'Close receipt photo' }).last().click();
});

test('persists a failed receipt submission in the offline queue with its receipt link', async ({
  page,
}) => {
  const receipt = makeFantasyReceipt({ id: 40, filename: 'comet-cafe.jpg' });
  let receiptSubmissions = 0;
  let transactionSubmissions = 0;

  await setupFantasyApi(page, { receipts: [receipt] });
  await routeApi(page, 'POST', '/api/receipts/40/submit', (route) => {
    receiptSubmissions += 1;
    return fulfillJson(
      route,
      {
        error: 'Receipt could not be confirmed',
        detail: 'The moon ledger is temporarily unavailable',
      },
      { status: 503, headers: { 'x-request-id': 'fantasy-request-40' } },
    );
  });
  await routeApi(page, 'POST', '/api/transactions', (route) => {
    transactionSubmissions += 1;
    return fulfillJson(route, { id: 'unexpected-transaction', status: 'created' }, { status: 201 });
  });

  await page.goto('/');
  await openTab(page, 'Receipts');
  await page.getByRole('button', { name: 'View details for Moonbeam Market' }).click();
  await page.getByRole('button', { name: 'Add Moonbeam Market' }).click();

  const sheet = page.getByTestId('entry-sheet');
  await expect(sheet).toBeVisible();
  await sheet.getByRole('button', { name: 'Save changes' }).click();

  await expect(sheet).toHaveCount(0);
  await page.getByRole('link', { name: 'Transactions' }).click();
  await expect(page.getByTestId('transaction-queue')).toBeVisible();
  await expect(page.getByText(/moon ledger is temporarily unavailable/)).toBeVisible();
  expect(receiptSubmissions).toBe(1);
  expect(transactionSubmissions).toBe(0);
  await expect
    .poll(() =>
      page.evaluate(() => {
        const stored = localStorage.getItem('spending-tracker.transaction-queue');
        return stored ? JSON.parse(stored)[0]?.receiptId : null;
      }),
    )
    .toBe(40);
});
