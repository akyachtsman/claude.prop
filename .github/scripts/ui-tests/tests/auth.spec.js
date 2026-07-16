// auth.spec.js — S23–S28 account/auth UI with the Supabase client fully STUBBED
// (no real backend; password-reset email isn't CI-automatable). The app is gated
// behind login (email + password). Covers: the sign-in wall (logged out, no data
// leak), a working password sign-in, the forgot-password send state, the
// signed-in chrome, offline read-only, and the first-sign-in account seed.
import { test, expect } from '@playwright/test';
import { installSignedIn } from './_supabase-mock.js';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// Stub Supabase for LOGGED-OUT cases (no session injected). Register the
// catch-all FIRST and specifics LAST — Playwright's last-registered route wins.
async function stubLoggedOut(page, { signInOk = true, resetOk = true } = {}) {
  await page.route('**/rest/v1/properties**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' }));
  await page.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/auth/v1/recover**', (r) =>
    r.fulfill({ status: resetOk ? 200 : 400, contentType: 'application/json', body: resetOk ? '{}' : '{"error":"bad"}' }));
  await page.route('**/auth/v1/token**', (r) => {
    if (!signInOk) return r.fulfill({ status: 400, contentType: 'application/json', body: '{"error":"invalid_grant","error_description":"Invalid login credentials"}' });
    const future = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
    r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({
      access_token: 'a', refresh_token: 'b', token_type: 'bearer', expires_in: 31536000, expires_at: future,
      user: { id: '00000000-0000-0000-0000-000000000001', email: 'me@example.com', aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
    }) });
  });
}

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

test('S23 auth gate — logged out shows only the sign-in wall (email+password); no data leaks', async ({ page }) => {
  const errors = watchErrors(page);
  await stubLoggedOut(page);
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('.authgate__title')).toBeVisible();
  await expect(page.locator('.authgate .input[type="email"]')).toBeVisible();
  await expect(page.locator('.authgate .input[type="password"]')).toBeVisible();
  await expect(page.locator('.authgate__link', { hasText: 'Forgot password?' })).toBeVisible();
  await expect(page.locator('.authgate__link', { hasText: 'Create an account' })).toBeVisible();
  // the app + nav + any data must be hidden behind the gate
  await expect(page.locator('.topbar__nav')).toBeHidden();
  await expect(page.locator('.lcard')).toHaveCount(0);
  await expect(page.locator('.kpi-strip')).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('S24 password sign-in — valid credentials sign in and reveal the app', async ({ page }) => {
  const errors = watchErrors(page);
  await stubLoggedOut(page, { signInOk: true });
  await page.goto('./', { waitUntil: 'load' });
  await page.locator('.authgate .input[type="email"]').fill('me@example.com');
  await page.locator('.authgate .input[type="password"]').fill('secret123');
  await page.locator('.authgate__send', { hasText: 'Sign in' }).click();
  await expect(page.locator('.account__email')).toHaveText('me@example.com');
  await expect(page.locator('.authgate__title')).toHaveCount(0);
  await expect(page.locator('.topbar__nav')).toBeVisible();
  expect(errors).toEqual([]);
});

test('S25 forgot password — "Send reset link" shows the check-your-email state', async ({ page }) => {
  await stubLoggedOut(page, { resetOk: true });
  await page.goto('./', { waitUntil: 'load' });
  await page.locator('.authgate__link', { hasText: 'Forgot password?' }).click();
  await expect(page.locator('.authgate__title')).toHaveText('Reset your password');
  await expect(page.locator('.authgate .input[type="password"]')).toBeHidden();
  await page.locator('.authgate .input[type="email"]').fill('me@example.com');
  await page.locator('.authgate__send', { hasText: 'Send reset link' }).click();
  await expect(page.locator('.authgate__status--ok')).toContainText('Check your email');
});

test('S26 signed-in — email + Sign out shown; store is on the cloud backend; gate gone', async ({ page }) => {
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

test('S27 signed-in + offline — read-only banner appears and body is gated', async ({ page, context }) => {
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

test('S28 first-sign-in seed — a fresh account is seeded with the sample + demos', async ({ page }) => {
  // reconcile:true lets the app's first-sign-in gap-seed run (js/account.js seeds
  // the real fixtures via the browser's own imports). It upserts 4 rows into the
  // stateful mock; a reload then reads that persisted account, so the assertion
  // is independent of first-paint timing across engines (chromium/webkit).
  await installSignedIn(page, { seed: [], reconcile: true });
  await page.goto('./', { waitUntil: 'load' });
  await page.waitForFunction(async () => {
    try { return (await import('/js/store.js')).list().length >= 4; } catch (e) { return false; }
  }, null, { timeout: 15000 }).catch(() => {});
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.lcard');
  await expect(page.locator('.lcard')).toHaveCount(4);   // 715 Plumas sample + 3 demos
  for (const name of ['715 Plumas', '2201 Del Paso', '88 Capitol Mall', '540 N Street']) {
    await expect(page.locator('.lcard__name', { hasText: name })).toHaveCount(1);
  }
});
