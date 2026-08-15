import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { useReceipts } from '../../src/hooks/useReceipts';
import type { ApiReceipt } from '../../src/types';

const mockLoadReceipts = jest.fn();
const mockDeleteReceipt = jest.fn();
const mockGetPermissions = jest.fn().mockResolvedValue({ ios: { allowsBadge: true } });
const mockRequestPermissions = jest.fn().mockResolvedValue({ ios: { allowsBadge: true } });
const mockSetBadgeCount = jest.fn().mockResolvedValue(undefined);

jest.mock('../../src/api', () => ({
  loadReceipts: () => mockLoadReceipts(),
  deleteReceipt: (id: number) => mockDeleteReceipt(id),
}));
jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPermissions(),
  requestPermissionsAsync: (...args: unknown[]) => mockRequestPermissions(...args),
  setBadgeCountAsync: (count: number) => mockSetBadgeCount(count),
}));

function receipt(overrides: Partial<ApiReceipt> = {}): ApiReceipt {
  return {
    id: 1,
    filename: 'moon-market.jpg',
    account: 'moonlight-wallet',
    mimeType: 'image/jpeg',
    status: 'queued',
    suggestion: null,
    error: null,
    submitted: false,
    actualId: null,
    createdAt: '2026-08-12',
    processedAt: null,
    submittedAt: null,
    ...overrides,
  };
}

async function startInitialLoad(): Promise<void> {
  await act(async () => {
    jest.advanceTimersByTime(0);
    await Promise.resolve();
  });
}

describe('useReceipts', () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    await AsyncStorage.clear();
    mockGetPermissions.mockResolvedValue({ ios: { allowsBadge: true } });
    mockRequestPermissions.mockResolvedValue({ ios: { allowsBadge: true } });
    mockSetBadgeCount.mockResolvedValue(undefined);
  });

  afterEach(() => jest.useRealTimers());

  it('loads receipts and counts only actionable statuses', async () => {
    const receipts = [
      receipt({ id: 1, status: 'queued' }),
      receipt({ id: 2, status: 'processing' }),
      receipt({ id: 3, status: 'processed', submitted: false }),
      receipt({ id: 4, status: 'processed', submitted: true }),
      receipt({ id: 5, status: 'failed' }),
    ];
    mockLoadReceipts.mockResolvedValue(receipts);
    const { result } = renderHook(() => useReceipts());
    await startInitialLoad();

    await waitFor(() => expect(result.current.receipts).toEqual(receipts));
    expect(result.current.receiptsLoading).toBe(false);
    expect(result.current.receiptCount).toBe(3);
  });

  it('shows cached receipts before the server responds', async () => {
    const cached = receipt({ id: 44, filename: 'cached-moon-market.jpg' });
    await AsyncStorage.setItem('spending-tracker.receipts-v1', JSON.stringify([cached]));
    mockLoadReceipts.mockReturnValue(new Promise(() => undefined));
    const { result } = renderHook(() => useReceipts());

    await waitFor(() => expect(result.current.receipts).toEqual([cached]));
    expect(result.current.receiptCount).toBe(1);
  });

  it('polls queued receipts and stops after they become submitted', async () => {
    mockLoadReceipts
      .mockResolvedValueOnce([receipt()])
      .mockResolvedValueOnce([receipt({ status: 'processed', submitted: true })]);
    const { result } = renderHook(() => useReceipts());
    await startInitialLoad();
    await waitFor(() => expect(result.current.receiptCount).toBe(1));

    await act(async () => {
      jest.advanceTimersByTime(2_500);
      await Promise.resolve();
    });
    await waitFor(() => expect(mockLoadReceipts).toHaveBeenCalledTimes(2));
    expect(result.current.receiptCount).toBe(0);

    await act(async () => jest.advanceTimersByTime(2_500));
    expect(mockLoadReceipts).toHaveBeenCalledTimes(2);
  });

  it('removes receipts optimistically and restores them after delete failure', async () => {
    const existing = receipt({ status: 'failed' });
    mockLoadReceipts.mockResolvedValue([existing]);
    mockDeleteReceipt.mockRejectedValue(new Error('Delete failed'));
    const { result } = renderHook(() => useReceipts());
    await startInitialLoad();
    await waitFor(() => expect(result.current.receipts).toEqual([existing]));

    act(() => result.current.removeReceipt(existing));
    expect(result.current.receipts).toEqual([]);
    expect(mockDeleteReceipt).toHaveBeenCalledWith(existing.id);
    await waitFor(() => expect(mockLoadReceipts).toHaveBeenCalledTimes(2));
    expect(result.current.receipts).toEqual([existing]);
  });
});
