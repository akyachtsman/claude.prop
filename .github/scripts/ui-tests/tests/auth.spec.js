// auth.spec.js — S23–S28 account/auth UI with the Supabase client fully STUBBED
// (no real backend; password-reset email isn't CI-automatable). The app is gated
// behind login (email + password). Covers: the sign-in wall (logged out, no data
// leak), a working password sign-in, the forgot-password send state, the
// signed-in chrome, offline read-only, and the first-sign-in account seed.
import { test, expect } from '@playwright/test';
import { installSignedIn } from './_supabase-mock.js';

test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// Tell a wait's OWN timeout apart from an interruption WITHOUT matching Playwright's
// wording. Previously this was a regex against the message text — a string match on
// phrasing that would break silently, and in the bad direction: a real timeout would
// stop being recognised. Two properties instead, both stable: Playwright rejects a
// timed-out wait with `name === 'TimeoutError'` (verified for both waitForSelector
// and waitForFunction), and a wait's own timeout can only fire once its full budget
// has elapsed. An interruption — the test-wide timeout, a closed browser — either is
// not a TimeoutError or arrives early, so it propagates unchanged. (Measured slack:
// a 600ms budget rejects at 602ms.)
function isOwnTimeout(err, startedAt, budgetMs) {
  return !!err && err.name === 'TimeoutError' && Date.now() - startedAt >= budgetMs - 250;
}

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
  // App-relative, never root-absolute: Pages serves this project under
  // /claude.prop/, so a leading-slash specifier resolves to the domain root
  // and 404s — green against the local server, red against the live site.
  const kind = await page.evaluate(async () =>
    (await import(new URL('js/store.js', document.baseURI).href)).backendKind());
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

test('S29 upload prompt — shows once with local deals and dismisses cleanly (no stacking)', async ({ page }) => {
  const localDeal = {
    id: 'p-local-xyz', schemaVersion: 1, name: 'My Local Deal',
    info: { askingPrice: 500000, rentableSF: 5000, lotSize: '', yearBuilt: '', zoning: '', hvacAge: '', roofAge: '', parking: '', ceilingHeight: '', appraisedValue: 0, apn: '', bedrooms: '', baths: '' },
    targets: { desiredCap: 0.06, desiredDscr: 1.25 },
    offer: { offerPrice: 450000, fees: 0, improvements: 0 },
    loans: [{ ltv: 0.7, rate: 0.065, termYears: 25, maturityYears: 0, type: 'CONV' }, { ltv: 0, rate: 0.065, termYears: 25, maturityYears: 0, type: 'IO' }],
    tenants: [], expenses: [],
    assumptions: { minOppCostEquity: 0.15, taxRate: 0.28, collectionLoss: 0.05, cashflowAppr: 0.02, capitalAppr: 0.02 },
  };
  const second = { ...localDeal, id: 'p-local-2', name: 'Another Local Deal' };
  await page.addInitScript((deals) => { localStorage.setItem('propanalytics.v1', JSON.stringify(deals)); }, [localDeal, second]);
  await installSignedIn(page, { seed: [], reconcile: true });
  await page.goto('./', { waitUntil: 'load' });
  // exactly one prompt — the re-entry guard prevents stacked duplicates
  await expect(page.locator('.modal__overlay')).toHaveCount(1);
  await expect(page.locator('.modal__title', { hasText: 'Move your local deals in?' })).toBeVisible();
  // dismissing it removes it for good (it does not reappear from a second reconcile)
  await page.locator('button', { hasText: 'Move them in' }).click();
  await expect(page.locator('.modal__overlay')).toHaveCount(0);
  await page.waitForSelector('.lcard');
  await expect(page.locator('.lcard__name', { hasText: 'My Local Deal' })).toBeVisible();
});

test('S28 first-sign-in seed — a fresh account is seeded with the sample + demos', async ({ page }) => {
  // reconcile:true lets the app's first-sign-in gap-seed run (js/account.js seeds
  // the real fixtures via the browser's own imports). It upserts 4 rows into the
  // stateful mock; a reload then reads that persisted account, so the assertion
  // is independent of first-paint timing across engines (chromium/webkit).
  // The default 30s test budget cannot hold a 15s seed poll, a reload AND a card
  // wait long enough for the card wait's OWN timeout to fire — the test-wide
  // timeout would win and overwrite the diagnosis below with "Test timeout of
  // 30000ms exceeded", which is the swallow again in a third costume. The seed
  // budget itself is unchanged at 15s; this only buys room to report (Codex, #108).
  test.setTimeout(45_000);
  await installSignedIn(page, { seed: [], reconcile: true });
  await page.goto('./', { waitUntil: 'load' });
  const SEED_WAIT_MS = 15_000;
  const CARD_WAIT_MS = 10_000;

  // How many rows the store holds, read through the page.
  //
  // `page.evaluate` DOES await an async page function. `page.waitForFunction` does
  // NOT: its poller tests the returned value for truthiness, and a Promise is always
  // truthy, so an `async` callback resolves the wait on the very first tick. Measured
  // against this Playwright build: `waitForFunction(async () => false)` given a
  // 1500ms budget resolved in 27ms. The 15s seed poll this replaces was written that
  // way, so it never polled — it returned immediately on every run, and the test has
  // in fact been racing the seed against a bare reload the whole time. Same family as
  // the `.catch(() => {})` this PR opened against: a check that reads as verification
  // and verifies nothing.
  //
  // So poll from Node, where the await is real. A shortfall is returned as data
  // rather than thrown — the reload below is a retry and must still happen.
  const storeRows = () => page.evaluate(async () => {
    // Only "the module is not up yet" is caught here — a legitimate not-ready
    // signal, reported as -1 so the caller keeps waiting. Every other rejection
    // (context destroyed, browser closed) propagates out of page.evaluate.
    try { return (await import(new URL('js/store.js', document.baseURI).href)).list().length; }
    catch (e) { return -1; }
  });
  const pollRows = async (want, budgetMs) => {
    const deadline = Date.now() + budgetMs;
    let n = await storeRows();
    while (n < want && Date.now() < deadline) {
      await page.waitForTimeout(200);
      n = await storeRows();
    }
    return n;
  };

  const seedRows = await pollRows(4, SEED_WAIT_MS);
  const seedTimedOut = seedRows < 4;
  // DO NOT throw before this reload. It is an implicit RETRY, not a rendering
  // step: reconcile()'s `reconciledUids` guard is in-memory and a reload builds a
  // new module realm, while its localStorage RECON_KEY is written only AFTER the
  // seed completes — so a slow first pass legitimately gets a second chance here.
  // Throwing above turned recoverable runs into failures (Codex, #108).
  await page.reload({ waitUntil: 'load' });

  const cardStart = Date.now();
  await page.waitForSelector('.lcard', { timeout: CARD_WAIT_MS }).catch(async (e) => {
    if (!isOwnTimeout(e, cardStart, CARD_WAIT_MS)) throw e;
    // `seedTimedOut` describes the PRE-reload attempt only, and the reload is a
    // retry — so a timed-out poll followed by a successful retry and a rendering
    // failure would be misreported as "seed never landed". Ask the store what it
    // holds NOW rather than naming a cause from a stale flag (Codex, #108).
    // Only here is a read failure absorbed: this is the diagnostic path, and
    // "unreadable" is reported in the message rather than replacing it.
    const rows = await storeRows().catch(() => -1);
    const held = rows < 0 ? 'an unreadable store' : rows + ' row(s)';
    throw new Error(rows >= 4
      ? 'the seed landed (store.list() holds ' + held + ') but no .lcard rendered within '
        + CARD_WAIT_MS + 'ms — this is a rendering failure, not a seed failure.'
      : 'first-sign-in seed never landed: store.list() holds ' + held + ' after the post-reload '
        + 'retry (the pre-reload ' + SEED_WAIT_MS + 'ms poll '
        + (seedTimedOut ? 'stopped at ' + seedRows : 'had reached ' + seedRows) + ' row(s)).');
  });
  await expect(page.locator('.lcard')).toHaveCount(4);   // 715 Plumas sample + 3 demos
  for (const name of ['715 Plumas', '2201 Del Paso', '88 Capitol Mall', '540 N Street']) {
    await expect(page.locator('.lcard__name', { hasText: name })).toHaveCount(1);
  }
});
