import { File } from 'expo-file-system';

import type { ApiReceipt, References, TransactionPage, TransactionPayload } from './types';

const apiUrl =
  process.env.EXPO_PUBLIC_SPENDING_TRACKER_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
const apiKey = process.env.EXPO_PUBLIC_SPENDING_TRACKER_API_KEY ?? '';

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
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(typeof init?.body === 'string' ? { 'Content-Type': 'application/json' } : {}),
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...init?.headers,
    },
  });
  const responseText = await response.text();
  let body: unknown = null;
  try {
    body = responseText ? JSON.parse(responseText) : null;
  } catch {
    body = responseText;
  }
  if (!response.ok) {
    const method = init?.method ?? 'GET';
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
    throw new ApiError(diagnostic, response.status, method, path, requestId);
  }
  return body as T;
}

export async function loadDashboard(): Promise<{ references: References; page: TransactionPage }> {
  const [references, page] = await Promise.all([
    request<References>('/api/references'),
    loadTransactionPage(1),
  ]);
  return { references, page };
}

export function loadTransactionPage(
  page: number,
  pageSize = 20,
  account?: string,
): Promise<TransactionPage> {
  const accountQuery = account ? `&account=${encodeURIComponent(account)}` : '';
  return request(`/api/transactions?page=${page}&pageSize=${pageSize}${accountQuery}`);
}

export async function submitTransaction(
  payload: TransactionPayload,
): Promise<{ id: string; status: 'created' }> {
  return request('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
}

export function deleteTransaction(id: string): Promise<void> {
  return request(`/api/transactions/${encodeURIComponent(id)}`, { method: 'DELETE' });
}

export function loadReceipts(): Promise<ApiReceipt[]> {
  return request('/api/receipts');
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

export async function uploadReceipt(
  asset: { uri: string; fileName?: string | null; mimeType?: string | null },
  account: string,
): Promise<{ id: number; status: 'queued' }> {
  const form = new FormData();
  const receipt = new File(asset.uri);
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
