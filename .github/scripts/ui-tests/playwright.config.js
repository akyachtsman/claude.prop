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
    // Desktop first: global.md requires laptop + tablet + phone coverage, and
    // test.md → Layered UI mandates before/during/after screenshots at
    // 1440x900 — neither is reachable from a device-emulated project, whose
    // viewport is fixed. Its presence is also what makes S4's explicit
    // setViewportSize(390) a real narrowing rather than a no-op.
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } },
    },
    {
      // Tablet is its own class, not an interpolation between the two: global.md
      // requires laptop, tablet AND phone, and Pixel 5 + iPhone 12 are both phone
      // profiles, so a tablet-only breakpoint regression was invisible.
      // PORTRAIT (810 wide), not landscape (1080). Upstream switched to portrait
      // because a conventional tablet band is max-width: 1023px, which 1080
      // CLEARS — rendering the DESKTOP layout under a tablet name, a project that
      // tests nothing while looking like coverage (measured in apfp.claude,
      // 2026-08-23). Upstream says to check this against your own breakpoints,
      // so it was checked: this project's bands are 1100/760, not 1023/1024, and
      // BOTH 810 and 1080 land inside 761-1100 — verified by rendering the app at
      // six widths and reading matchMedia. So landscape was not dead here. 810 is
      // taken anyway: it sits mid-band with margin on both sides, where 1080 sits
      // 20px under the edge and would silently become desktop coverage the day
      // anyone moves that breakpoint to the conventional 1024.
      name: 'tablet',
      use: { ...devices['iPad (gen 7)'] },
    },
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
