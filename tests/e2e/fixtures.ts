import { expect, test as base } from '@playwright/test';

type Fixtures = {
  apiGuard: void;
};

export const test = base.extend<Fixtures>({
  apiGuard: [
    async ({ page }, use) => {
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
