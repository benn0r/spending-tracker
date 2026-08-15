import { nativeDeviceLocale } from '../../src/device-locale';

jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageTag: 'de-CH' }],
}));

test('uses the native device locale instead of the JavaScript runtime locale', () => {
  expect(nativeDeviceLocale()).toBe('de-CH');
});
