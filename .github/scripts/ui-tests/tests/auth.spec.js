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
  // The config's 30s budget cannot hold a REAL 15s persistence wait plus a reload
  // plus a 10s card poll — the test-wide timeout would kill the run before either
  // poll could report what it saw, and "Test timeout of 30000ms exceeded" says
  // nothing about the seed. Neither budget below is widened; this only makes room
  // for the two of them to actually run and report.
  test.setTimeout(45_000);
  const { rows } = await installSignedIn(page, { seed: [], reconcile: true });
  await page.goto('./', { waitUntil: 'load' });
  const SEED_WAIT_MS = 15_000;
  const CARD_WAIT_MS = 10_000;

  // Wait for the seed to be PERSISTED, not merely cached.
  //
  // The cloud store's save() writes its browser cache synchronously and only then
  // fires an UNAWAITED ops.upsert() (js/store.js:162-167), and store.list() reads
  // that cache — so polling the page reports 4 rows while the POSTs are still in
  // flight, and the reload below can abort writes that never reached the route
  // handler. That leaves in place the bare-reload race this test keeps losing. The
  // mock's Node-side `rows` map is the persisted truth, and is exactly what the
  // post-reload GET reads, so gate the reload on that instead (Codex, #108).
  //
  // Polling from Node also removes the previous version's whole error-shape
  // problem: these helpers return counts rather than throwing, so nothing has to
  // tell a wait's own timeout apart from an interruption. A real infrastructure
  // failure propagates out of the Playwright call unchanged.
  const pollPersisted = async (want, budgetMs) => {
    const deadline = Date.now() + budgetMs;
    while (rows.size < want && Date.now() < deadline) await page.waitForTimeout(150);
    return rows.size;
  };
  const pollCards = async (budgetMs) => {
    const deadline = Date.now() + budgetMs;
    let n = await page.locator('.lcard').count();
    while (n === 0 && Date.now() < deadline) {
      await page.waitForTimeout(150);
      n = await page.locator('.lcard').count();
    }
    return n;
  };

  const seedRows = await pollPersisted(4, SEED_WAIT_MS);
  // DO NOT throw on a shortfall here. This reload is an implicit RETRY, not a
  // rendering step: reconcile()'s `reconciledUids` guard is in-memory and a reload
  // builds a new module realm, while its localStorage RECON_KEY is written only
  // AFTER the seed completes — so a slow first pass legitimately gets a second
  // chance. Throwing above turned recoverable runs into failures (Codex, #108).
  await page.reload({ waitUntil: 'load' });

  if (await pollCards(CARD_WAIT_MS) === 0) {
    // Read the account's state NOW rather than from the pre-reload count: the
    // reload is a retry, so a slow first pass followed by a successful second one
    // and then a rendering failure must not be reported as a seed failure.
    throw new Error(rows.size >= 4
      ? 'the seed persisted (' + rows.size + ' rows in the account) but no .lcard rendered '
        + 'within ' + CARD_WAIT_MS + 'ms — this is a rendering failure, not a seed failure.'
      : 'first-sign-in seed never landed: the account holds ' + rows.size + ' row(s) after the '
        + 'post-reload retry (the pre-reload ' + SEED_WAIT_MS + 'ms wait saw ' + seedRows + ').');
  }
  await expect(page.locator('.lcard')).toHaveCount(4);   // 715 Plumas sample + 3 demos
  for (const name of ['715 Plumas', '2201 Del Paso', '88 Capitol Mall', '540 N Street']) {
    await expect(page.locator('.lcard__name', { hasText: name })).toHaveCount(1);
  }
});
