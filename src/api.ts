import type { References, TransactionPage, TransactionPayload } from './types';

const apiUrl =
  process.env.EXPO_PUBLIC_SPENDING_TRACKER_API_URL?.replace(/\/$/, '') ?? 'http://localhost:3000';
const apiKey = process.env.EXPO_PUBLIC_SPENDING_TRACKER_API_KEY ?? '';

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
      ...init?.headers,
    },
  });
  const body = (await response.json().catch(() => null)) as {
    error?: string;
    detail?: string;
  } | null;
  if (!response.ok)
    throw new ApiError(
      body?.detail ?? body?.error ?? `Request failed (${response.status})`,
      response.status,
    );
  return body as T;
}

export async function loadDashboard(): Promise<{ references: References; page: TransactionPage }> {
  const [references, page] = await Promise.all([
    request<References>('/api/references'),
    request<TransactionPage>('/api/transactions?page=1&pageSize=200'),
  ]);
  return { references, page };
}

export async function submitTransaction(
  payload: TransactionPayload,
): Promise<{ id: string; status: 'created' }> {
  return request('/api/transactions', { method: 'POST', body: JSON.stringify(payload) });
}
