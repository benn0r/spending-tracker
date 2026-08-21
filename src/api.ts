import { File as ExpoFile } from 'expo-file-system';

import type {
  ApiReceipt,
  CashFlow,
  ExpenseSplitSummary,
  ExpenseSplitDetail,
  References,
  TransactionPage,
  TransactionPayload,
} from './types';
import { sortCategoryReferences } from './app-model';

let apiUrl =
  process.env.EXPO_PUBLIC_SPENDING_TRACKER_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
let apiKey = process.env.EXPO_PUBLIC_SPENDING_TRACKER_API_KEY ?? '';

export type ApiConfiguration = { serverUrl: string; apiToken: string };

export function configureApi({ serverUrl, apiToken }: ApiConfiguration): void {
  apiUrl = serverUrl.trim().replace(/\/+$/, '');
  apiKey = apiToken.trim();
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly method?: string,
    readonly path?: string,
    readonly requestId?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

function valueShape(value: unknown): string {
  if (Array.isArray(value)) return `array(${value.length})`;
  if (value && typeof value === 'object')
    return `object(${Object.keys(value as Record<string, unknown>)
      .sort()
      .join(',')})`;
  return value === null ? 'null' : typeof value;
}

function contractError(path: string, expected: string, received: unknown): ApiError {
  const shape = valueShape(received);
  console.error('Spending Tracker API response mismatch', { path, expected, received: shape });
  return new ApiError(
    `${path} returned incompatible data\nExpected: ${expected}\nReceived: ${shape}`,
  );
}

function responseDetail(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  const value = body as Record<string, unknown>;
  const parts = [value.error, value.detail]
    .filter((part): part is string => typeof part === 'string' && part.trim().length > 0)
    .map((part) => part.trim());
  return parts.length ? [...new Set(parts)].join('\n') : null;
}

export function describeSubmissionError(cause: unknown): string {
  if (cause instanceof ApiError) return cause.message;
  const reason = cause instanceof Error ? cause.message : String(cause);
  return ['POST /api/transactions failed', 'Network request did not receive a response.', reason]
    .filter(Boolean)
    .join('\n');
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetchResponse(path, init);
  const responseText = await response.text();
  let body: unknown = null;
  try {
    body = responseText ? JSON.parse(responseText) : null;
  } catch {
    body = responseText;
  }
  return body as T;
}

async function fetchResponse(
  path: string,
  init?: RequestInit,
  accept = 'application/json',
): Promise<Response> {
  const method = init?.method ?? 'GET';
  let response: Response;
  try {
    response = await fetch(`${apiUrl}${path}`, {
      ...init,
      headers: {
        Accept: accept,
        ...(typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
        ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
        ...init?.headers,
      },
    });
  } catch (cause) {
    const reason = cause instanceof Error ? cause.message : String(cause);
    console.error('Spending Tracker API network failure', {
      method,
      path,
      serverUrl: apiUrl,
      reason,
    });
    throw new ApiError(
      [`${method} ${path} failed`, 'Network request did not receive a response.', reason].join(
        '\n',
      ),
      undefined,
      method,
      path,
    );
  }
  if (!response.ok) {
    const responseText = await response.text();
    let body: unknown = null;
    try {
      body = responseText ? JSON.parse(responseText) : null;
    } catch {
      body = responseText;
    }
    const requestId = response.headers.get('x-request-id') ?? undefined;
    const detail = responseDetail(body) ?? (typeof body === 'string' ? body.trim() : null);
    const diagnostic = [
      `${method} ${path} failed`,
      `HTTP ${response.status} ${response.statusText || 'Unknown error'}`,
      detail ? `Server response: ${detail}` : 'Server returned no error details.',
      requestId ? `Request ID: ${requestId}` : null,
    ]
      .filter(Boolean)
      .join('\n');
    console.error('Spending Tracker API request failed', {
      method,
      path,
      status: response.status,
      requestId,
      detail,
    });
    throw new ApiError(diagnostic, response.status, method, path, requestId);
  }
  return response;
}

export async function loadDashboard(): Promise<{
  references: References;
  page: TransactionPage;
  cashFlow: CashFlow;
}> {
  const [references, page, cashFlow] = await Promise.all([
    request<References>('/api/references'),
    loadTransactionPage(1),
    request<CashFlow>('/api/cash-flow'),
  ]);
  return {
    references: {
      ...references,
      categories: sortCategoryReferences(references.categories),
    },
    page,
    cashFlow,
  };
}

export function loadTransactionPage(
  page: number,
  pageSize = 20,
  accountId?: string,
  accountName?: string,
): Promise<TransactionPage> {
  const accountQuery = accountId ? `&account=${encodeURIComponent(accountId)}` : '';
  const walletQuery = accountName ? `&wallet=${encodeURIComponent(accountName)}` : '';
  return request(
    `/api/transactions?page=${page}&pageSize=${pageSize}${accountQuery}${walletQuery}`,
  );
}

export function loadCashFlow(accountId?: string): Promise<CashFlow> {
  const accountQuery = accountId ? `?account=${encodeURIComponent(accountId)}` : '';
  return request(`/api/cash-flow${accountQuery}`);
}

export async function loadExpenseSplits(): Promise<ExpenseSplitSummary[]> {
  const payload = await request<{ splits?: ExpenseSplitSummary[] }>('/api/splits');
  return Array.isArray(payload.splits) ? payload.splits : [];
}

export function loadExpenseSplit(id: number): Promise<ExpenseSplitDetail> {
  return request(`/api/splits/${id}`);
}

export async function submitTransaction(
  payload: TransactionPayload,
): Promise<{ id: string; status: 'created' }> {
  return request('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
}

export function deleteTransaction(id: string): Promise<void> {
  return request(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function updateTransaction(
  id: string,
  payload: TransactionPayload,
): Promise<{ id: string; status: 'updated' }> {
  return request(`/api/transactions/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

function normalizeReceipt(value: unknown): ApiReceipt | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const receipt = value as Record<string, unknown>;
  const status = receipt.status;
  if (
    typeof receipt.id !== 'number' ||
    typeof receipt.filename !== 'string' ||
    typeof receipt.mimeType !== 'string' ||
    (status !== 'queued' &&
      status !== 'processing' &&
      status !== 'processed' &&
      status !== 'failed') ||
    typeof receipt.submitted !== 'boolean'
  )
    return null;
  const nullableString = (field: unknown) => (typeof field === 'string' ? field : null);
  return {
    id: receipt.id,
    filename: receipt.filename,
    account: nullableString(receipt.account ?? receipt.accountId),
    mimeType: receipt.mimeType,
    status,
    suggestion:
      receipt.suggestion && typeof receipt.suggestion === 'object'
        ? (receipt.suggestion as ApiReceipt['suggestion'])
        : null,
    error: nullableString(receipt.error),
    submitted: receipt.submitted,
    actualId: nullableString(receipt.actualId ?? receipt.actualTransactionId),
    createdAt: nullableString(receipt.createdAt) ?? '',
    processedAt: nullableString(receipt.processedAt),
    submittedAt: nullableString(receipt.submittedAt),
  };
}

export async function loadReceipts(): Promise<ApiReceipt[]> {
  const payload = await request<unknown>('/api/receipts');
  const records = Array.isArray(payload)
    ? payload
    : payload &&
        typeof payload === 'object' &&
        Array.isArray((payload as { receipts?: unknown }).receipts)
      ? (payload as { receipts: unknown[] }).receipts
      : null;
  if (!records) throw contractError('/api/receipts', 'an array or { receipts: array }', payload);
  const receipts = records.map(normalizeReceipt);
  if (receipts.some((receipt) => receipt === null))
    throw contractError('/api/receipts', 'valid receipt records', records);
  return receipts as ApiReceipt[];
}

export function deleteReceipt(id: number): Promise<void> {
  return request(`/api/receipts/${id}`, { method: 'DELETE' });
}

export function receiptFileSource(id: number): { uri: string; headers?: Record<string, string> } {
  return {
    uri: `${apiUrl}/api/receipts/${id}/file`,
    ...(apiKey ? { headers: { Authorization: `Bearer ${apiKey}` } } : {}),
  };
}

export async function loadReceiptFile(id: number): Promise<Blob> {
  const response = await fetchResponse(`/api/receipts/${id}/file`, undefined, '*/*');
  return response.blob();
}

export async function uploadReceipt(
  asset: {
    uri: string;
    fileName?: string | null;
    mimeType?: string | null;
    file?: globalThis.File;
  },
  account: string,
): Promise<{ id: number; status: 'queued' }> {
  const form = new FormData();
  const receipt = asset.file ?? new ExpoFile(asset.uri);
  form.append('account', account);
  form.append('receipt', receipt, asset.fileName ?? receipt.name);
  return request('/api/receipts', { method: 'POST', body: form });
}

export function submitReceiptTransaction(
  receiptId: number,
  payload: TransactionPayload,
): Promise<{ id: string; status: 'created' }> {
  return request(`/api/receipts/${receiptId}/submit`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
