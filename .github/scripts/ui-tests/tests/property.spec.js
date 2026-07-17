// property.spec.js — project-specific scenarios S5–S22 (+ a delete test) for the
// Property Analytics dashboard (spec.md SC-1..SC-7). Client-side only: no backend,
// so these run fully against the local server. Desktop viewport (laptop-first app).

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { installSignedIn, CLOUD_KEY } from './_supabase-mock.js';

// Laptop-first functional tests: force a desktop, fine-pointer context so the
// one-screen and 44px-touch behaviours are tested in their intended mode.
// (The generic app.spec.js covers the mobile/touch viewports.)
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

// The app is gated behind login: every scenario boots SIGNED IN against a stubbed
// Supabase (no backend). The account starts empty (reconcile suppressed), so a
// signed-in fresh account behaves like the old local first-run — same "Load
// sample deal" / "+ New property" affordances, backed by the stateful mock.
test.beforeEach(async ({ page }) => { await installSignedIn(page); });

// Console-error gate (test.md): fail if any pageerror or console.error fires.
function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

// Read the KPI strip into a { LABEL: valueText } map.
async function kpis(page) {
  return page.evaluate(() => {
    const out = {};
    document.querySelectorAll('.kpi').forEach((k) => {
      const label = k.querySelector('.kpi__label')?.textContent?.trim();
      const val = k.querySelector('.kpi__value')?.textContent?.trim();
      if (label) out[label] = val;
    });
    return out;
  });
}

async function loadSample(page) {
  await page.goto('./', { waitUntil: 'load' });
  await page.click('button:has-text("Load sample deal")');
  await page.waitForSelector('.kpi-strip');
}

// Fields commit on `change` (Enter/blur), not per keystroke — fill then blur to
// commit the edit so the dashboard recomputes.
async function setField(page, selector, value) {
  const loc = page.locator(selector);
  await loc.fill(String(value));
  await loc.blur();
}

// Each test gets a fresh browser context (empty localStorage), so no explicit
// clear is needed — and clearing via addInitScript would wipe the store on the
// reloads that S7/S10 depend on.

test('S5 calc fidelity — sample deal KPIs match the actual-close fixture', async ({ page }) => {
  const errors = watchErrors(page);
  await loadSample(page);
  const k = await kpis(page);
  // 715 Plumas at the price actually paid ($1.3M / $945K loan): a value-add
  // deal that does not yet cash-flow, so several metrics are legitimately
  // negative. Values mirror js/sample.js EXPECTED (computed by js/model.js).
  expect(k['CAP']).toBe('5.13%');
  expect(k['DSCR']).toBe('0.84');
  expect(k['NOI']).toBe('$66,627');
  expect(k['NOI − Debt Svc']).toBe('-$7,757');
  expect(k['NOI − Coll. Loss']).toBe('$62,127');
  expect(k['Cash on Cash']).toBe('-2.18%');
  expect(k['Annual IRR']).toBe('5.29%');
  expect(k['5Y NPV']).toBe('-$29,512'); // negative at the price paid (app-corrected NPV)
  expect(k['5Y Total Return']).toBe('$94,121');
  expect(k['WACC']).toBe('7.34%');
  expect(k['Return on Cost']).toBe('18.77%');
  expect(k['1% Rule']).toBe('-$5,500');
  expect(errors).toEqual([]);
});

test('Header pills include the 5-year NPV verdict after CAP and DSCR', async ({ page }) => {
  await loadSample(page);
  const pills = page.locator('.topbar__pills .pill');
  await expect(pills).toHaveCount(3);
  // order: CAP, DSCR, then 5Y NPV
  await expect(pills.nth(2)).toContainText('5Y NPV');
  await expect(pills.nth(2)).toContainText('-$29,512');   // sample's negative NPV
  await expect(pills.nth(2)).toHaveClass(/pill--fail/);   // negative → fail
});

test('S6 commit recalc — KPIs update when a field commits (Enter/blur), not mid-type', async ({ page }) => {
  await loadSample(page);
  const before = (await kpis(page))['CAP'];              // 5.13%
  const offer = page.locator('.deal-strip input[aria-label="Offer price"]');
  await offer.fill('300000');                            // typing only — must NOT recompute yet
  await page.waitForTimeout(150);
  expect((await kpis(page))['CAP']).toBe(before);
  await offer.blur();                                    // commit → recompute (no calculate button)
  await expect.poll(async () => (await kpis(page))['CAP']).toBe('22.21%');   // NOI $66,627 ÷ 300,000
});

test('S7 persistence — a saved property survives a reload', async ({ page }) => {
  await loadSample(page);        // loadSample saves it via store
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('.lcard__name')).toContainText('715 Plumas St');
});

test('S8 compare — best/worst highlight and per-column verdict', async ({ page }) => {
  await loadSample(page);
  // add a second, weaker property
  await page.click('#nav-properties');
  await page.click('button:has-text("+ New property")');
  await page.waitForSelector('.kpi-strip');
  await setField(page, 'input[aria-label="Offer price"]', '250000');   // auto-saved on commit
  await page.click('#nav-compare');
  await page.waitForSelector('.compare-table');
  // default layout is the spreadsheet-style table: one row per property
  await expect(page.locator('.compare-table--rows')).toBeVisible();
  await expect(page.locator('.cell--best').first()).toBeVisible();
  await expect(page.locator('.cell--worst').first()).toBeVisible();
  await expect(page.locator('.compare-verdict .pill').first()).toBeVisible();
  // sorting: click the CAP header (3rd column) → ascending first, then toggle
  const capTh = page.locator('.compare-table--rows thead th:nth-child(3)');
  await capTh.locator('.th-sort__btn').click();
  await expect(capTh).toHaveAttribute('aria-sort', 'ascending');
  await expect(page.locator('.compare-table--rows tbody tr').first().locator('.compare-name')).toContainText('New property'); // 0% lowest first
  await capTh.locator('.th-sort__btn').click();
  await expect(capTh).toHaveAttribute('aria-sort', 'descending');
  await expect(page.locator('.compare-table--rows tbody tr').first().locator('.compare-name')).toContainText('715 Plumas');   // 5.13% highest
  // toggle to the side-by-side layout (metrics as rows, properties as columns)
  await page.click('.seg__btn:has-text("Side by side")');
  await expect(page.locator('.compare-table:not(.compare-table--rows)')).toBeVisible();
  await expect(page.locator('.compare-table--rows')).toHaveCount(0);
  await expect(page.locator('.cell--best').first()).toBeVisible();
});

test('New property defaults — Target CAP / DSCR start empty; goal-seek blank', async ({ page }) => {
  await page.goto('./', { waitUntil: 'load' });
  await page.click('button:has-text("Add your first property")');
  await page.waitForSelector('.kpi-strip');
  // Target starts EMPTY — a pre-filled value would read as a target the user set.
  // The pills fall back to the hard-coded 8% / 1.25 benchmark until one is entered.
  await expect(page.locator('.deal-strip input[aria-label="Target CAP"]')).toHaveValue('');
  await expect(page.locator('input[aria-label="Target DSCR"]')).toHaveValue('');
  // The goal-seek inputs are separate and start blank — nothing was solved yet.
  await expect(page.locator('input[aria-label="Solve offer for CAP"]')).toHaveValue('');
  await expect(page.locator('input[aria-label="Solve offer for DSCR"]')).toHaveValue('');
});

test('S9 empty/zero — a zeroed property renders "—", never NaN', async ({ page }) => {
  await page.goto('./', { waitUntil: 'load' });
  await page.click('button:has-text("Add your first property")');
  await page.waitForSelector('.kpi-strip');
  const bodyText = await page.textContent('.kpi-strip');
  expect(bodyText).not.toMatch(/NaN|Infinity|undefined/);
  const k = await kpis(page);
  expect(k['DSCR']).toBe('—');       // zero debt → no-data
  expect(k['Annual IRR']).toBe('—'); // no initial outflow → no real IRR (regression guard for C1)
});

test('S10 export/import round-trip — data restores identically', async ({ page }) => {
  await loadSample(page);
  // Export → capture the downloaded JSON (the real export path, signed in)
  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.click('#btn-export'),
  ]);
  const json = readFileSync(await download.path(), 'utf8');
  expect(json).toContain('715 Plumas St');
  // Import that same JSON back through the file picker → the property is still present
  page.once('filechooser', (fc) => fc.setFiles({ name: 'export.json', mimeType: 'application/json', buffer: Buffer.from(json) }));
  await page.click('#btn-import');
  await expect(page.locator('.lcard__name')).toContainText('715 Plumas St');
});

test('S11 one-screen — dashboard fits 1440×900 with no vertical scroll', async ({ page }) => {
  await loadSample(page);
  const fits = await page.evaluate(() => document.documentElement.scrollHeight <= window.innerHeight);
  expect(fits).toBe(true);
  // all workbook data points present: spot-check a few labels
  const text = await page.textContent('body');
  for (const label of ['Ceiling', 'Lease Options', 'Total yearly mortgage', 'WACC']) {
    expect(text).toContain(label);
  }
});

test('S12 deal summary — the band is the single editable source; All-In derives', async ({ page }) => {
  await loadSample(page);
  const summaryOffer = page.locator('.deal-strip input[aria-label="Offer price"]');
  const allIn = page.locator('.deal-cell--accent .deal-cell__val');
  await expect(allIn).toHaveText('$355,030');           // derived, painted into the band
  // Offer price now lives only in the band — not duplicated in the Offer & Debt card
  await expect(page.locator('input[aria-label="Offer price"]')).toHaveCount(1);
  await expect(page.locator('.card[aria-label="Offer & Debt Service"] input[aria-label="Offer price"]')).toHaveCount(0);
  // editing it recomputes the derived All-In (300000 × (1 − 0.7269)) and the card's copy
  await summaryOffer.fill('300000');
  await summaryOffer.blur();                             // commit
  await expect(allIn).toHaveText('$81,930');
  await expect(page.locator('.card[aria-label="Offer & Debt Service"] .facts dd').last()).toHaveText('$81,930');
});

test('S13 KPI formula popup — hovering a metric reveals its formula, clamped to viewport', async ({ page }) => {
  await loadSample(page);
  const tip = page.locator('.kpi-tip');
  await expect(tip).toBeHidden();
  await page.locator('.kpi--info').first().hover();      // CAP
  await expect(tip).toBeVisible();
  await expect(tip).toHaveText('NOI ÷ Offer Price');
  // right-edge metric: the popup must not overflow the viewport
  await page.locator('.kpi--info').last().hover();       // 1% Rule
  await expect(tip).toBeVisible();
  const box = await tip.boundingBox();
  const vw = page.viewportSize().width;
  expect(box.x).toBeGreaterThanOrEqual(0);
  expect(box.x + box.width).toBeLessThanOrEqual(vw + 1);
});

test('S14 pro-forma horizon — slider extends to 10 years with a boundary and 10-yr stats', async ({ page }) => {
  await loadSample(page);
  const bars = page.locator('.card[aria-label="Pro-Forma"] .chart__group');
  const stats = page.locator('.pf-stat');
  const setHorizon = (v) => page.locator('.pf-slider').evaluate((el, val) => {
    el.value = val; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
  // default: 5 years, one (5-year) stats block, no 5↔10 boundary
  await expect(bars).toHaveCount(5);
  await expect(stats).toHaveCount(1);
  await expect(stats.first()).toContainText('5-year');
  await expect(stats.first()).toContainText('-$29,512');
  await expect(page.locator('.chart__group--boundary')).toHaveCount(0);
  // zoom to 10 → 10 bars, a boundary divider, and a second (10-year) stats block
  await setHorizon('10');
  await expect(bars).toHaveCount(10);
  await expect(page.locator('.chart__group--boundary')).toHaveCount(1);
  await expect(stats).toHaveCount(2);
  await expect(stats.nth(1)).toContainText('10-year');
  await expect(stats.nth(1)).toContainText('-$45,941');
  // headline stays 5-year: top KPI strip 5Y NPV unchanged, and the 5-year block too
  expect((await kpis(page))['5Y NPV']).toBe('-$29,512');
  await expect(stats.first()).toContainText('-$29,512');
  // zoom back to 5 → boundary and 10-year block gone
  await setHorizon('5');
  await expect(bars).toHaveCount(5);
  await expect(stats).toHaveCount(1);
});

test('S15 goal-seek — the blank solve inputs back-solve the offer without touching the Target benchmark', async ({ page }) => {
  await loadSample(page);
  const offer = page.locator('.deal-strip input[aria-label="Offer price"]');
  const targetCap = page.locator('.deal-strip input[aria-label="Target CAP"]');
  const solveCap = page.locator('input[aria-label="Solve offer for CAP"]');
  // Solve CAP entered as a percent (6 = 6%) → offer = NOI ÷ 0.06 = 1,110,450; CAP reads 6.00%
  await setField(page, 'input[aria-label="Solve offer for CAP"]', '6');
  await expect(offer).toHaveValue('1110450');
  await expect.poll(async () => (await kpis(page))['CAP']).toBe('6.00%');
  // The solve input is one-shot: it clears back to blank, and the Target field
  // (an optional override) stays empty — the goal-seek never sets a benchmark.
  await expect(solveCap).toHaveValue('');
  await expect(targetCap).toHaveValue('');
  // Solve DSCR 1.4 → offer back-solves through the loan (PV ÷ LTV) to 775,560; DSCR reads 1.40
  await setField(page, 'input[aria-label="Solve offer for DSCR"]', '1.4');
  await expect(offer).toHaveValue('775560');
  await expect.poll(async () => (await kpis(page))['DSCR']).toBe('1.40');
  await expect(page.locator('input[aria-label="Solve offer for DSCR"]')).toHaveValue('');
});

test('Asking price seeds the offer — editing Asking Price sets Offer Price to it (workbook parity)', async ({ page }) => {
  await loadSample(page);
  const offer = page.locator('.deal-strip input[aria-label="Offer price"]');
  const targetCap = page.locator('.deal-strip input[aria-label="Target CAP"]');
  // Editing Asking Price (Property Info) seeds the Offer Price to the same value…
  await setField(page, 'input[aria-label="Asking"]', '1450000');
  await expect(offer).toHaveValue('1450000');
  // …the CAP recomputes off the new offer, and the Target override stays empty.
  await expect.poll(async () => (await kpis(page))['CAP']).not.toBe('—');
  await expect(targetCap).toHaveValue('');
});

test('Verdict benchmark is hard-coded 8% / 1.25 with the Target empty; a Target overrides it', async ({ page }) => {
  await loadSample(page);
  // Target field empty, yet the CAP pill still checks against the hard-coded 8.00%.
  await expect(page.locator('.deal-strip input[aria-label="Target CAP"]')).toHaveValue('');
  const capPill = page.locator('.topbar__pills .pill').nth(0);
  await expect(capPill).toContainText('< 8.00%');          // sample CAP 5.13% < 8% benchmark
  await expect(capPill).toHaveClass(/pill--fail/);
  // Setting a Target overrides the benchmark: a 5% target makes the 5.13% CAP pass.
  await setField(page, '.deal-strip input[aria-label="Target CAP"]', '5');
  await expect(capPill).toContainText('≥ 5.00%');
  await expect(capPill).toHaveClass(/pill--pass/);
});

test('A Target equal to the benchmark reads as unset — renders empty on reload (legacy 8%/1.25 deals)', async ({ page }) => {
  await loadSample(page);
  const targetCap = page.locator('.deal-strip input[aria-label="Target CAP"]');
  // Type a Target equal to the default benchmark and commit (mirrors a legacy deal
  // that stored the old 8% default). It shows while the input stays mounted…
  await setField(page, '.deal-strip input[aria-label="Target CAP"]', '8');
  await expect(targetCap).toHaveValue('8');
  // …but on reload it re-renders from the stored value (0.08 === benchmark) as blank,
  // so it never reads as a target the user set — while the pill still checks 8.00%.
  await page.reload();
  await page.waitForSelector('.kpi-strip');
  await expect(page.locator('.deal-strip input[aria-label="Target CAP"]')).toHaveValue('');
  await expect(page.locator('.topbar__pills .pill').nth(0)).toContainText('8.00%');
});

test('S16 change marker — affected values get a corner marker on edit, not on load or inert edits', async ({ page }) => {
  await loadSample(page);
  const marked = page.locator('.flash');                   // .flash renders the corner-fold marker
  await expect(marked).toHaveCount(0);                     // nothing marked on initial render
  await setField(page, 'input[aria-label="APN"]', 'XYZ-123');   // pure text field, no computed effect
  await page.waitForTimeout(200);
  await expect(marked).toHaveCount(0);
  const capCell = page.locator('.kpi', { has: page.locator('.kpi__label', { hasText: /^CAP$/ }) });
  await setField(page, '.deal-strip input[aria-label="Offer price"]', '300000');   // ripples into CAP, All-In, …
  await expect(capCell).toHaveClass(/flash/);
  await expect(marked.first()).toBeVisible();
  // the marker persists and the next edit clears + re-marks — never accumulates
  const n = await marked.count();
  await page.waitForTimeout(400);
  await expect(marked).toHaveCount(n);                     // still marked after a beat
  await setField(page, '.deal-strip input[aria-label="Offer price"]', '400000');   // next change
  await expect.poll(async () => marked.count()).toBe(n);   // prior markers cleared, new ones set
  // the tiny inline "% share of NOI" labels must never carry the corner-fold
  // marker — the 12px fold overlaps their 10px text. Editing an expense amount
  // recomputes every share, yet no .pct gets flashed.
  await setField(page, 'input[aria-label="Insurance amount"]', '20000');
  await page.waitForTimeout(200);
  await expect(page.locator('.pct.flash')).toHaveCount(0);
});

test('S17 generated shade — computed fields share the generated-shade fill', async ({ page }) => {
  await loadSample(page);
  const shade = 'rgb(226, 233, 242)';   // --gen-shade #E2E9F2
  const kpiBg = await page.locator('.kpi').first().evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(kpiBg).toBe(shade);
  const allInBg = await page.locator('.deal-cell--accent .deal-cell__val').evaluate((el) => getComputedStyle(el).backgroundColor);
  expect(allInBg).toBe(shade);
});

test('S18 auto-save — edits persist without Save, and switching never prompts', async ({ page }) => {
  let asked = false;
  page.on('dialog', (d) => { asked = true; d.dismiss(); });
  await loadSample(page);
  await setField(page, '.deal-strip input[aria-label="Offer price"]', '777000');   // fill + blur commits
  await page.waitForTimeout(600);                          // let the auto-save debounce fire
  await page.click('button[aria-label="Next property"]');  // must NOT show an unsaved-changes prompt
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.kpi-strip');
  await expect(page.locator('.deal-strip input[aria-label="Offer price"]')).toHaveValue('777000');
  expect(asked).toBe(false);
});

test('S19 amortization vs. maturity — a balloon is reported without changing DSCR', async ({ page }) => {
  await loadSample(page);
  const card = page.locator('.card[aria-label="Offer & Debt Service"]');
  // sample loan: 25-yr amortization, 10-yr maturity → balloon due at yr 10
  await expect(card).toContainText('Balloon due');
  await expect(card).toContainText('$725,708 · yr 10');
  // the maturity does NOT change the payment/DSCR (payment is sized off the
  // amortization term; a refinance at maturity is cash-neutral)
  const dscrBefore = (await kpis(page))['DSCR'];
  expect(dscrBefore).toBe('0.84');
  // clearing the maturity removes the balloon and leaves DSCR untouched
  await setField(page, 'input[aria-label="Loan 1 maturity years"]', '0');
  await expect(card).not.toContainText('$725,708');
  expect((await kpis(page))['DSCR']).toBe(dscrBefore);
});

// (S20 stale-sample auto-refresh removed: it exercised the LOCAL built-in-sample
//  migration, which the login gate retires — a signed-in account's sample is
//  authoritative and updates via normal upsert, not a boot-time local refresh.)

test('S21 undo/redo — a committed edit can be reverted and replayed; typing alone is not undoable', async ({ page }) => {
  await loadSample(page);
  const undoBtn = page.locator('button[aria-label="Undo last change"]');
  const redoBtn = page.locator('button[aria-label="Redo change"]');
  const offer = page.locator('.deal-strip input[aria-label="Offer price"]');
  await expect(undoBtn).toBeDisabled();                 // nothing to undo/redo on initial load
  await expect(redoBtn).toBeDisabled();
  // typing without committing neither recomputes nor creates an undo step
  await offer.fill('300000');
  await page.waitForTimeout(150);
  expect((await kpis(page))['CAP']).toBe('5.13%');
  await expect(undoBtn).toBeDisabled();
  // committing (blur) recomputes and arms Undo (Redo stays empty)
  await offer.blur();
  await expect.poll(async () => (await kpis(page))['CAP']).toBe('22.21%');
  await expect(undoBtn).toBeEnabled();
  await expect(redoBtn).toBeDisabled();
  // Undo restores the prior offer and KPIs, and arms Redo
  await undoBtn.click();
  await expect(page.locator('.deal-strip input[aria-label="Offer price"]')).toHaveValue('1300000');
  await expect.poll(async () => (await kpis(page))['CAP']).toBe('5.13%');
  await expect(page.locator('button[aria-label="Undo last change"]')).toBeDisabled();
  await expect(page.locator('button[aria-label="Redo change"]')).toBeEnabled();
  // Redo replays the committed edit
  await page.locator('button[aria-label="Redo change"]').click();
  await expect(page.locator('.deal-strip input[aria-label="Offer price"]')).toHaveValue('300000');
  await expect.poll(async () => (await kpis(page))['CAP']).toBe('22.21%');
});

test('DELETE — a property is removed from its Properties-list card, with confirmation', async ({ page }) => {
  await loadSample(page);
  await page.goto('./', { waitUntil: 'load' });          // Delete now lives on the list card
  await page.waitForSelector('.lcard');
  let asked = false;
  page.on('dialog', (d) => { asked = true; d.accept(); });
  await page.locator('.lcard__del').first().click();
  await page.waitForTimeout(200);
  expect(asked).toBe(true);
  await expect(page.locator('.lcard')).toHaveCount(0);   // deleted → empty list
});

// (S22 demo-seed removed here: the demo deals now seed per-account via the
//  first-sign-in reconcile (js/account.js) rather than a local boot seed. That
//  gap-seed + "a deleted deal stays gone" behaviour is covered by the Node unit
//  test tests/reconcile.test.mjs and the fresh-account seed check in auth.spec.js.)
