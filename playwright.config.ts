import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  workers: process.env.CI ? 1 : undefined,
  use: {
    baseURL: 'http://127.0.0.1:4173',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'npm run build && npx serve -s dist -l tcp://127.0.0.1:4173',
    env: {
      EXPO_PUBLIC_SPENDING_TRACKER_API_KEY: 'e2e-api-key',
      EXPO_PUBLIC_SPENDING_TRACKER_API_URL: 'http://127.0.0.1:4173',
    },
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [{ name: 'mobile-chromium', use: { ...devices['Pixel 7'] } }],
});
