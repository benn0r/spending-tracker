import { createContext, type ReactNode, useContext } from 'react';

export type AppScreenName = 'transactions' | 'accounts' | 'more' | 'settings';

const AppScreenContext = createContext<Record<AppScreenName, ReactNode> | null>(null);

export const AppScreenProvider = AppScreenContext.Provider;

export function useAppScreen(name: AppScreenName) {
  const screens = useContext(AppScreenContext);
  if (!screens) throw new Error('App screens must be rendered inside AppScreenProvider.');
  return screens[name];
}
