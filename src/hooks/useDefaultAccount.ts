import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useRef, useState } from 'react';

import { defaultAccountStorageKey } from '../app-model';
import type { References } from '../types';

export type UseDefaultAccountResult = {
  defaultAccount: string;
  chooseDefaultAccount: (account: string) => void;
  validateDefaultAccount: (references: References) => void;
};

export function useDefaultAccount(): UseDefaultAccountResult {
  const [defaultAccount, setDefaultAccount] = useState('');
  const enabledAccountIds = useRef<Set<string> | null>(null);

  useEffect(() => {
    let cancelled = false;
    void AsyncStorage.getItem(defaultAccountStorageKey)
      .then((stored) => {
        if (cancelled || !stored) return;
        if (enabledAccountIds.current && !enabledAccountIds.current.has(stored)) {
          void AsyncStorage.removeItem(defaultAccountStorageKey);
          return;
        }
        setDefaultAccount(stored);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const chooseDefaultAccount = useCallback((account: string) => {
    setDefaultAccount(account);
    void AsyncStorage.setItem(defaultAccountStorageKey, account);
  }, []);

  const validateDefaultAccount = useCallback((references: References) => {
    enabledAccountIds.current = new Set(references.accounts.map(({ id }) => id));
    setDefaultAccount((current) => {
      if (current && !enabledAccountIds.current?.has(current)) {
        void AsyncStorage.removeItem(defaultAccountStorageKey);
        return '';
      }
      return current;
    });
  }, []);

  return { defaultAccount, chooseDefaultAccount, validateDefaultAccount };
}
