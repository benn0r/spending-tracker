import { getLocales } from 'expo-localization';

import { deviceLocale } from './transactions';

export function nativeDeviceLocale(): string {
  const locale = getLocales()[0];
  if (!locale) return deviceLocale();
  if (locale.languageCode && locale.regionCode) {
    return `${locale.languageCode}-${locale.regionCode}`;
  }
  return locale.languageTag || deviceLocale();
}
