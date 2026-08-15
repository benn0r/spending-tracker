const mockExpoFile = jest.fn().mockImplementation((uri: string) => ({
  uri,
  name: uri.split('/').pop() || 'receipt.jpg',
}));

jest.mock('expo-file-system', () => ({ File: mockExpoFile }));

type ApiModule = typeof import('../../src/api');

function response(
  body: unknown,
  options: {
    ok?: boolean;
    status?: number;
    statusText?: string;
    requestId?: string;
    raw?: boolean;
    blob?: Blob;
  } = {},
): Response {
  return {
    ok: options.ok ?? true,
    status: options.status ?? 200,
    statusText: options.statusText ?? 'OK',
    text: jest
      .fn()
      .mockResolvedValue(options.raw ? String(body) : body === null ? '' : JSON.stringify(body)),
    headers: { get: jest.fn(() => options.requestId ?? null) },
    blob: jest.fn().mockResolvedValue(options.blob ?? new Blob()),
  } as unknown as Response;
}

describe('API client', () => {
  let api: ApiModule;
  let fetchMock: jest.MockedFunction<typeof fetch>;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();
    process.env.EXPO_PUBLIC_SPENDING_TRACKER_API_URL = 'https://api.example.test/';
    process.env.EXPO_PUBLIC_SPENDING_TRACKER_API_KEY = 'test-api-key';
    fetchMock = jest.fn();
    global.fetch = fetchMock;
    api = jest.requireActual<ApiModule>('../../src/api');
  });

  afterAll(() => {
    delete process.env.EXPO_PUBLIC_SPENDING_TRACKER_API_URL;
    delete process.env.EXPO_PUBLIC_SPENDING_TRACKER_API_KEY;
  });

  it('loads dashboard endpoints and encodes paginated account filters', async () => {
    fetchMock
      .mockResolvedValueOnce(
        response({
          accounts: [],
          categories: [
            { id: 'bills', name: 'Bills' },
            { id: 'food', name: 'Food', sortOrder: 1 },
          ],
          tags: [],
        }),
      )
      .mockResolvedValueOnce(response({ transactions: [], total: 0, page: 1, pageSize: 20 }))
      .mockResolvedValueOnce(response({ currency: 'CHF', currentMonth: '2026-08', months: [] }));
    const dashboard = await api.loadDashboard();
    expect(dashboard.references.categories.map(({ id }) => id)).toEqual(['food', 'bills']);
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/references',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer test-api-key' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/transactions?page=1&pageSize=20',
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api.example.test/api/cash-flow',
      expect.any(Object),
    );

    fetchMock.mockResolvedValueOnce(
      response({ transactions: [], total: 0, page: 3, pageSize: 25 }),
    );
    await api.loadTransactionPage(3, 25, 'wallet / one', 'Moonlight Wallet');
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.example.test/api/transactions?page=3&pageSize=25&account=wallet%20%2F%20one&wallet=Moonlight%20Wallet',
      expect.any(Object),
    );
  });

  it('normalizes the new Spendee receipt envelope and field names', async () => {
    fetchMock.mockResolvedValueOnce(
      response({
        receipts: [
          {
            id: 7,
            filename: 'receipt.jpg',
            accountId: 'wallet-id',
            accountName: 'Moonlight Wallet',
            mimeType: 'image/jpeg',
            status: 'processed',
            suggestion: null,
            error: null,
            submitted: true,
            actualTransactionId: 'actual-id',
            createdAt: '2026-08-14T10:00:00Z',
            processedAt: '2026-08-14T10:00:01Z',
            submittedAt: '2026-08-14T10:00:02Z',
          },
        ],
      }),
    );

    await expect(api.loadReceipts()).resolves.toEqual([
      expect.objectContaining({
        id: 7,
        account: 'wallet-id',
        actualId: 'actual-id',
      }),
    ]);
  });

  it('rejects incompatible successful responses with a safe contract diagnostic', async () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    fetchMock.mockResolvedValueOnce(response({ unexpected: [] }));

    await expect(api.loadReceipts()).rejects.toThrow('Expected: an array or { receipts: array }');
    expect(consoleError).toHaveBeenCalledWith(
      'Spending Tracker API response mismatch',
      expect.objectContaining({ received: 'object(unexpected)' }),
    );
    consoleError.mockRestore();
  });

  it('uses a saved runtime server configuration for future requests', async () => {
    api.configureApi({ serverUrl: 'https://saved.example.test/', apiToken: 'saved-token' });
    fetchMock.mockResolvedValueOnce(response([]));

    await api.loadReceipts();

    expect(fetchMock).toHaveBeenCalledWith(
      'https://saved.example.test/api/receipts',
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer saved-token' }),
      }),
    );
  });

  it('uses the correct methods, JSON bodies, and resource paths', async () => {
    fetchMock
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response([]))
      .mockResolvedValueOnce(response(null))
      .mockResolvedValueOnce(response(null));
    const payload = {
      account: 'wallet',
      category: 'food',
      date: '2026-08-12',
      amount: -8,
    };

    await api.submitTransaction(payload);
    await api.deleteTransaction('id / with spaces');
    await api.loadReceipts();
    await api.deleteReceipt(9);
    await api.submitReceiptTransaction(7, payload);

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/api/transactions',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify(payload),
        headers: expect.objectContaining({ 'Content-Type': 'application/json' }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/api/transactions/id%20%2F%20with%20spaces',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      3,
      'https://api.example.test/api/receipts',
      expect.any(Object),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      4,
      'https://api.example.test/api/receipts/9',
      expect.objectContaining({ method: 'DELETE' }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      5,
      'https://api.example.test/api/receipts/7/submit',
      expect.objectContaining({ method: 'POST', body: JSON.stringify(payload) }),
    );
  });

  it('builds actionable diagnostics from JSON, plain text, and empty errors', async () => {
    fetchMock.mockResolvedValueOnce(
      response(
        { error: 'Rejected expense', detail: 'Rejected expense' },
        { ok: false, status: 422, statusText: 'Unprocessable', requestId: 'request-42' },
      ),
    );
    await expect(
      api.submitTransaction({
        account: 'wallet',
        category: 'food',
        date: '2026-08-12',
        amount: -8,
      }),
    ).rejects.toMatchObject({
      name: 'ApiError',
      status: 422,
      method: 'POST',
      path: '/api/transactions',
      requestId: 'request-42',
      message: expect.stringContaining('Server response: Rejected expense'),
    });

    fetchMock.mockResolvedValueOnce(
      response('Gateway unavailable', { ok: false, status: 502, raw: true }),
    );
    await expect(api.loadReceipts()).rejects.toThrow('Server response: Gateway unavailable');

    fetchMock.mockResolvedValueOnce(response(null, { ok: false, status: 500 }));
    await expect(api.loadReceipts()).rejects.toThrow('Server returned no error details.');
  });

  it('describes API and network submission failures without losing their cause', () => {
    const diagnostic = new api.ApiError('POST failed', 503);
    expect(api.describeSubmissionError(diagnostic)).toBe('POST failed');
    expect(api.describeSubmissionError(new Error('socket closed'))).toContain('socket closed');
    expect(api.describeSubmissionError('offline')).toContain('offline');
  });

  it('provides authenticated native sources and loads web receipt blobs', async () => {
    expect(api.receiptFileSource(12)).toEqual({
      uri: 'https://api.example.test/api/receipts/12/file',
      headers: { Authorization: 'Bearer test-api-key' },
    });
    const blob = new Blob(['receipt'], { type: 'image/jpeg' });
    fetchMock.mockResolvedValueOnce(response(null, { blob }));
    await expect(api.loadReceiptFile(12)).resolves.toBe(blob);
    expect(fetchMock).toHaveBeenLastCalledWith(
      'https://api.example.test/api/receipts/12/file',
      expect.objectContaining({
        headers: expect.objectContaining({
          Accept: '*/*',
          Authorization: 'Bearer test-api-key',
        }),
      }),
    );
  });

  it('uploads the browser File directly and falls back to an Expo File for native URIs', async () => {
    const append = jest.fn();
    const OriginalFormData = global.FormData;
    global.FormData = jest.fn(() => ({ append })) as unknown as typeof FormData;
    fetchMock.mockResolvedValue(response({ id: 1, status: 'queued' }));
    const browserFile = { name: 'browser.jpg', type: 'image/jpeg' } as globalThis.File;

    await api.uploadReceipt(
      { uri: 'blob:browser', fileName: 'browser.jpg', mimeType: 'image/jpeg', file: browserFile },
      'dragon-hoard',
    );
    expect(mockExpoFile).not.toHaveBeenCalled();
    expect(append).toHaveBeenCalledWith('account', 'dragon-hoard');
    expect(append).toHaveBeenCalledWith('receipt', browserFile, 'browser.jpg');

    append.mockClear();
    await api.uploadReceipt({ uri: 'file:///native.jpg' }, 'moonlight-wallet');
    expect(mockExpoFile).toHaveBeenCalledWith('file:///native.jpg');
    expect(append).toHaveBeenCalledWith(
      'receipt',
      expect.objectContaining({ name: 'native.jpg' }),
      'native.jpg',
    );
    global.FormData = OriginalFormData;
  });
});
