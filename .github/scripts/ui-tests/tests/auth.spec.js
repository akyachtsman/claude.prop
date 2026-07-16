// auth.spec.js — S23–S27 account/auth UI with the Supabase client fully STUBBED
// (no real backend; magic-link email isn't CI-automatable). The app is gated
// behind login, so this covers: the full-page sign-in wall (logged out), the
// magic-link send state, the signed-in chrome, offline read-only, and the
// first-sign-in account seed. Desktop context.
import { test, expect } from '@playwright/test';
import { installSignedIn } from './_supabase-mock.js';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// Stub Supabase for the LOGGED-OUT cases (no session injected).
async function stubLoggedOut(page, { otpOk = true } = {}) {
  await page.route('**/auth/v1/otp**', (r) =>
    r.fulfill({ status: otpOk ? 200 : 400, contentType: 'application/json', body: otpOk ? '{}' : '{"error":"bad"}' }));
  await page.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/properties**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' }));
}

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

test('S23 auth gate — logged out shows only the sign-in wall; no app or data leaks', async ({ page }) => {
  const errors = watchErrors(page);
  await stubLoggedOut(page);
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('.authgate__title')).toBeVisible();
  await expect(page.locator('.authgate .input[type="email"]')).toBeVisible();
  // the app + nav + any data must be hidden behind the gate
  await expect(page.locator('.topbar__nav')).toBeHidden();
  await expect(page.locator('.lcard')).toHaveCount(0);
  await expect(page.locator('.kpi-strip')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('S24 magic-link — Send sign-in link shows "check your email"', async ({ page }) => {
  await stubLoggedOut(page, { otpOk: true });
  await page.goto('./', { waitUntil: 'load' });
  await page.locator('.authgate .input[type="email"]').fill('investor@example.com');
  await page.locator('.authgate__send').click();
  await expect(page.locator('.authgate__status--ok')).toContainText('Check your email');
});

test('S25 signed-in — email + Sign out shown; store is on the cloud backend; gate gone', async ({ page }) => {
  const errors = watchErrors(page);
  await installSignedIn(page, { email: 'tester@example.com' });
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('.account__email')).toHaveText('tester@example.com');
  await expect(page.locator('#topbar-account button', { hasText: 'Sign out' })).toBeVisible();
  await expect(page.locator('.authgate__title')).toHaveCount(0);
  const kind = await page.evaluate(async () => (await import('/js/store.js')).backendKind());
  expect(kind).toBe('cloud');
  expect(errors).toEqual([]);
});

test('S26 signed-in + offline — read-only banner appears and body is gated', async ({ page, context }) => {
  await installSignedIn(page);
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('#topbar-account button', { hasText: 'Sign out' })).toBeVisible();
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event('offline')));
  await expect(page.locator('#offline-banner')).toBeVisible();
  await expect(page.locator('body')).toHaveClass(/is-readonly/);
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event('online')));
  await expect(page.locator('#offline-banner')).toBeHidden();
});

test('S27 first-sign-in seed — a fresh account is seeded with the sample + demos', async ({ page }) => {
  // reconcile:true lets the gap-seed run against an empty (stubbed) account
  await installSignedIn(page, { seed: [], reconcile: true });
  await page.goto('./', { waitUntil: 'load' });
  await page.waitForSelector('.lcard');
  await expect(page.locator('.lcard')).toHaveCount(4);   // 715 Plumas sample + 3 demos
  for (const name of ['715 Plumas', '2201 Del Paso', '88 Capitol Mall', '540 N Street']) {
    await expect(page.locator('.lcard__name', { hasText: name })).toHaveCount(1);
  }
});
