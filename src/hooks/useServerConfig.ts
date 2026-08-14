import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { configureApi, type ApiConfiguration } from '../api';

export const serverConfigStorageKey = 'spending-tracker.server-config.v2';

export function useServerConfig() {
  const [configuration, setConfiguration] = useState<ApiConfiguration | null>(null);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    void AsyncStorage.getItem(serverConfigStorageKey)
      .then((stored) => {
        if (!stored) return;
        const value = JSON.parse(stored) as Partial<ApiConfiguration>;
        if (typeof value.serverUrl !== 'string' || typeof value.apiToken !== 'string') return;
        const restored = { serverUrl: value.serverUrl, apiToken: value.apiToken };
        configureApi(restored);
        setConfiguration(restored);
      })
      .catch(() => undefined)
      .finally(() => setHydrated(true));
  }, []);

  const saveConfiguration = useCallback((next: ApiConfiguration) => {
    const normalized = {
      serverUrl: next.serverUrl.trim().replace(/\/+$/, ''),
      apiToken: next.apiToken.trim(),
    };
    configureApi(normalized);
    setConfiguration(normalized);
    void AsyncStorage.setItem(serverConfigStorageKey, JSON.stringify(normalized)).catch(
      () => undefined,
    );
  }, []);

  return { configuration, hydrated, saveConfiguration };
}
