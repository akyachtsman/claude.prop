// Playwright configuration for this static HTML app.
// Live URL comes from the APP_URL repo variable in CI; the fallback below
// is this project's GitHub Pages URL.

import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  retries: 1,
  reporter: [['list'], ['json', { outputFile: '../../../.agent-reports/playwright-results.json' }]],
  use: {
    // Extra HTML entry points (admin/vendor consoles): set APP_PAGES to a
    // comma-separated list of paths relative to APP_URL — the ENTRY scenario
    // load-gates each one (test.md → UI coverage gates).
    baseURL: (process.env.APP_URL || 'https://akyachtsman.github.io/claude.prop/').replace(/\/?$/, '/'),
    headless: true,
    screenshot: 'only-on-failure',
    video: 'off',
    trace: 'on-first-retry',
    // Local-only escape hatch: point at a preinstalled browser when the runner
    // can't fetch Playwright's pinned build (offline sandbox). Unset in CI, so
    // CI uses the browser installed by `npx playwright install`.
    launchOptions: process.env.PW_EXECUTABLE ? { executablePath: process.env.PW_EXECUTABLE } : undefined,
  },
  outputDir: '../../../.agent-reports/screenshots',
  projects: [
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 5'] },
    },
    {
      name: 'iphone',
      use: { ...devices['iPhone 12'] },
    },
  ],
});
