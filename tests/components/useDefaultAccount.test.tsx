import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useDefaultAccount } from '../../src/hooks/useDefaultAccount';

const references = {
  accounts: [
    { id: 'moonlight-wallet', name: 'Moonlight Wallet' },
    { id: 'dragon-hoard', name: 'Dragon Hoard' },
  ],
  categories: [],
  tags: [],
};

describe('useDefaultAccount', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('hydrates a saved account and persists a new user choice', async () => {
    await AsyncStorage.setItem('spending-tracker.default-account', 'moonlight-wallet');
    const { result } = renderHook(() => useDefaultAccount());
    await waitFor(() => expect(result.current.defaultAccount).toBe('moonlight-wallet'));

    act(() => result.current.chooseDefaultAccount('dragon-hoard'));
    expect(result.current.defaultAccount).toBe('dragon-hoard');
    await expect(AsyncStorage.getItem('spending-tracker.default-account')).resolves.toBe(
      'dragon-hoard',
    );
  });

  it('clears a hydrated account that is no longer enabled', async () => {
    await AsyncStorage.setItem('spending-tracker.default-account', 'retired-wallet');
    const { result } = renderHook(() => useDefaultAccount());
    await waitFor(() => expect(result.current.defaultAccount).toBe('retired-wallet'));

    act(() => result.current.validateDefaultAccount(references));
    expect(result.current.defaultAccount).toBe('');
    await waitFor(() =>
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('spending-tracker.default-account'),
    );
  });

  it('rejects stale storage when references load before hydration finishes', async () => {
    let resolveStorage: (value: string | null) => void = () => undefined;
    jest.mocked(AsyncStorage.getItem).mockReturnValueOnce(
      new Promise<string | null>((resolve) => {
        resolveStorage = resolve;
      }),
    );
    const { result } = renderHook(() => useDefaultAccount());
    act(() => result.current.validateDefaultAccount(references));
    await act(async () => resolveStorage('retired-wallet'));

    await waitFor(() =>
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith('spending-tracker.default-account'),
    );
    expect(result.current.defaultAccount).toBe('');
  });

  it('ignores storage failures while keeping user selection available', async () => {
    jest.mocked(AsyncStorage.getItem).mockRejectedValueOnce(new Error('Storage unavailable'));
    jest.mocked(AsyncStorage.setItem).mockRejectedValueOnce(new Error('Storage unavailable'));
    const { result } = renderHook(() => useDefaultAccount());
    await waitFor(() => expect(AsyncStorage.getItem).toHaveBeenCalled());

    act(() => result.current.chooseDefaultAccount('moonlight-wallet'));
    expect(result.current.defaultAccount).toBe('moonlight-wallet');
  });
});
