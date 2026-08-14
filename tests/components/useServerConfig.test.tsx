import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';

import { useServerConfig } from '../../src/hooks/useServerConfig';

describe('useServerConfig', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await AsyncStorage.clear();
  });

  it('requires setup when no saved configuration exists', async () => {
    const { result } = renderHook(() => useServerConfig());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    expect(result.current.configuration).toBeNull();
  });

  it('restores and persists server configuration', async () => {
    await AsyncStorage.setItem(
      'spending-tracker.server-config.v2',
      JSON.stringify({ serverUrl: 'https://old.example.test', apiToken: 'old-token' }),
    );
    const { result } = renderHook(() => useServerConfig());
    await waitFor(() => expect(result.current.configuration?.apiToken).toBe('old-token'));

    act(() =>
      result.current.saveConfiguration({
        serverUrl: 'https://new.example.test/',
        apiToken: ' new-token ',
      }),
    );
    expect(result.current.configuration).toEqual({
      serverUrl: 'https://new.example.test',
      apiToken: 'new-token',
    });
    await expect(AsyncStorage.getItem('spending-tracker.server-config.v2')).resolves.toBe(
      JSON.stringify({ serverUrl: 'https://new.example.test', apiToken: 'new-token' }),
    );
  });
});
