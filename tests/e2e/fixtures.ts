import { expect, test as base } from '@playwright/test';

type Fixtures = {
  apiGuard: void;
};

export const test = base.extend<Fixtures>({
  apiGuard: [
    async ({ page }, use) => {
      await page.addInitScript(() => {
        if (window.location.search.includes('setup=1')) {
          window.localStorage.removeItem('spending-tracker.server-config.v2');
          return;
        }
        window.localStorage.setItem(
          'spending-tracker.server-config.v2',
          JSON.stringify({ serverUrl: window.location.origin, apiToken: 'e2e-api-key' }),
        );
      });
      await page.route(
        (url) => url.pathname.startsWith('/api/'),
        (route) => route.abort('blockedbyclient'),
      );
      await use();
    },
    { auto: true },
  ],
});

export { expect };
export type { Locator, Page } from '@playwright/test';
