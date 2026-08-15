import { getLocales } from 'expo-localization';

import { deviceLocale } from './transactions';

export function nativeDeviceLocale(): string {
  return getLocales()[0]?.languageTag || deviceLocale();
}
