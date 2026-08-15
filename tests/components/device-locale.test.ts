import { nativeDeviceLocale } from '../../src/device-locale';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'en-US', languageCode: 'en', regionCode: 'CH' }],
}));

test('combines the native language and region instead of using the runtime locale', () => {
  expect(nativeDeviceLocale()).toBe('en-CH');
});
