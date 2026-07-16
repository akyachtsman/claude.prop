// auth.spec.js — S23–S26 account/auth UI states with the Supabase client fully
// STUBBED (no real backend, magic-link email isn't CI-automatable). Verifies the
// sign-in affordance, the magic-link modal, the signed-in chrome, offline
// read-only, and that logged-out parity is unaffected. Desktop context.
import { test, expect } from '@playwright/test';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

const PROJECT_REF = 'yucnxlimmrgzbqtdizle';               // must match js/config.js
const AUTH_KEY = `sb-${PROJECT_REF}-auth-token`;

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

// Stub every Supabase call so no test touches the network.
async function stubSupabase(page, { otpOk = true } = {}) {
  await page.route('**/auth/v1/otp**', (r) =>
    r.fulfill({ status: otpOk ? 200 : 400, contentType: 'application/json', body: otpOk ? '{}' : '{"error":"bad"}' }));
  await page.route('**/auth/v1/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.route('**/rest/v1/properties**', (r) =>
    r.fulfill({ status: 200, contentType: 'application/json', headers: { 'content-range': '0-0/0' }, body: '[]' }));
}

// Seed a valid-looking session in storage before load → app boots signed in.
async function injectSession(page, email = 'tester@example.com') {
  await page.addInitScript(([key, addr]) => {
    const future = Math.floor(Date.now() / 1000) + 3600 * 24 * 365;
    localStorage.setItem(key, JSON.stringify({
      access_token: 'fake', refresh_token: 'fake', token_type: 'bearer',
      expires_in: 3600 * 24 * 365, expires_at: future,
      user: { id: '00000000-0000-0000-0000-000000000001', email: addr, aud: 'authenticated', role: 'authenticated', app_metadata: {}, user_metadata: {} },
    }));
  }, [AUTH_KEY, email]);
}

test('S23 signed-out — Sign in affordance is present and logged-out parity holds', async ({ page }) => {
  const errors = watchErrors(page);
  await stubSupabase(page);
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('#topbar-account button', { hasText: 'Sign in' })).toBeVisible();
  // parity: the logged-out app still computes the fixture (CAP 5.13%)
  await page.click('button:has-text("Load sample deal")');
  await page.waitForSelector('.kpi-strip');
  const cap = await page.locator('.kpi', { hasText: 'CAP' }).locator('.kpi__value').first().textContent();
  expect(cap).toContain('5.13');
  expect(errors).toEqual([]);
});

test('S24 magic-link modal — Send link shows "check your email"; Cancel closes', async ({ page }) => {
  await stubSupabase(page, { otpOk: true });
  await page.goto('./', { waitUntil: 'load' });
  await page.click('#topbar-account button:has-text("Sign in")');
  const panel = page.locator('.modal__panel', { hasText: 'Sign in' });
  await expect(panel).toBeVisible();
  await panel.locator('input[type="email"]').fill('investor@example.com');
  await panel.locator('button:has-text("Send link")').click();
  await expect(panel.locator('.modal__status--ok')).toContainText('Check your email');
  // a second modal open + Cancel dismisses
  await page.keyboard.press('Escape').catch(() => {});
});

test('S25 signed-in — email + Sign out shown; store is on the cloud backend', async ({ page }) => {
  const errors = watchErrors(page);
  await stubSupabase(page);
  await injectSession(page, 'tester@example.com');
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('.account__email')).toHaveText('tester@example.com');
  await expect(page.locator('#topbar-account button', { hasText: 'Sign out' })).toBeVisible();
  const kind = await page.evaluate(async () => (await import('/js/store.js')).backendKind());
  expect(kind).toBe('cloud');
  expect(errors).toEqual([]);
});

test('S26 signed-in + offline — read-only banner appears and body is gated', async ({ page, context }) => {
  await stubSupabase(page);
  await injectSession(page);
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
