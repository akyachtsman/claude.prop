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
  // order: CAP, DSCR, then 5Y NPV — with the explicit "> $0" benchmark shown.
  await expect(pills.nth(2)).toContainText('5Y NPV');
  await expect(pills.nth(2)).toContainText('-$29,512');   // sample's negative NPV
  await expect(pills.nth(2)).toContainText('≤ $0');       // fails the > $0 benchmark
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
  // Compare lives in the header action bar (list-type views only), so return to
  // the list first, then open Compare from the header.
  await page.click('#nav-properties');
  await page.waitForSelector('.lcard');
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

test('New property defaults — Target CAP / DSCR start empty', async ({ page }) => {
  await page.goto('./', { waitUntil: 'load' });
  await page.click('button:has-text("Add your first property")');
  await page.waitForSelector('.kpi-strip');
  // Target starts EMPTY — a pre-filled value would read as a target the user set.
  // Target is a goal-seek (moves the offer); the pills check the fixed 8% / 1.25.
  await expect(page.locator('.deal-strip input[aria-label="Target CAP"]')).toHaveValue('');
  await expect(page.locator('input[aria-label="Target DSCR"]')).toHaveValue('');
});

test('Property name/address — editable in the header, renames the deal and persists', async ({ page }) => {
  await page.goto('./', { waitUntil: 'load' });
  await page.click('button:has-text("Add your first property")');
  await page.waitForSelector('.kpi-strip');
  const nameInput = page.locator('.switcher__name');
  await expect(nameInput).toHaveValue('New property');     // editable name field is present in the header
  await nameInput.fill('123 Market St — Retail');
  await nameInput.blur();                                    // commit on blur
  // the new name flows to the Properties list card and survives a reload (auto-saved)
  await page.goto('./', { waitUntil: 'load' });
  await page.waitForSelector('.lcard');
  await expect(page.locator('.lcard__name')).toContainText('123 Market St — Retail');
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

test('S14b table drag-to-scroll — clicking and dragging the pro-forma table pans it (overlay scrollbars auto-hide)', async ({ page }) => {
  await loadSample(page);
  await page.locator('.pf-slider').evaluate((el) => { el.value = '10'; el.dispatchEvent(new Event('input', { bubbles: true })); });
  const wrap = page.locator('.card[aria-label="Pro-Forma"] .table-wrap');
  await expect.poll(() => wrap.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);   // genuinely overflows
  const before = await wrap.evaluate((el) => el.scrollLeft);
  const box = await wrap.boundingBox();
  await page.mouse.move(box.x + box.width - 30, box.y + 30);
  await page.mouse.down();
  await page.mouse.move(box.x + 30, box.y + 30, { steps: 10 });
  await page.mouse.up();
  const after = await wrap.evaluate((el) => el.scrollLeft);
  expect(after).toBeGreaterThan(before);
  // pointer capture is released and the drag state clears once the mouse is up
  await expect(wrap).not.toHaveClass(/is-dragging/);
});

test('S15 goal-seek — typing Target CAP/DSCR back-solves the offer so the ACTUAL metric hits it', async ({ page }) => {
  await loadSample(page);
  const offer = page.locator('.deal-strip input[aria-label="Offer price"]');
  // Target CAP 6% → offer = NOI ÷ 0.06 = 1,110,450; the ACTUAL CAP becomes 6.00%.
  await setField(page, '.deal-strip input[aria-label="Target CAP"]', '6');
  await expect(offer).toHaveValue('1110450');
  await expect.poll(async () => (await kpis(page))['CAP']).toBe('6.00%');
  // Target DSCR 1.4 → offer back-solves through the loan (PV ÷ LTV) to 775,560; DSCR reads 1.40.
  await setField(page, '.deal-strip input[aria-label="Target DSCR"]', '1.4');
  await expect(offer).toHaveValue('775560');
  await expect.poll(async () => (await kpis(page))['DSCR']).toBe('1.40');
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

test('Use-default toggle — tax = offer×0.012, insurance = SF × property-type rate; checked fills the formula, cleared zeroes, typed value locks', async ({ page }) => {
  await page.goto('./', { waitUntil: 'load' });
  await page.click('button:has-text("Add your first property")');
  await page.waitForSelector('.kpi-strip');
  const ins = page.locator('input[aria-label="Insurance amount"]');
  const tax = page.locator('input[aria-label="Property taxes amount"]');
  const insCell = page.locator('.exp-cell', { has: page.locator('input[aria-label="Insurance amount"]') });
  const insDefault = insCell.locator('input[aria-label="Use default Insurance"]');
  const insFormula = insCell.locator('.exp-default__formula');
  // A fresh property opts into the default: the toggle is checked and the formula
  // shows in a tiny font.
  await expect(insDefault).toBeChecked();
  // Insurance scales with the building. Entering SF at the default Commercial (0.80)
  // fills $8,000; the formula text reflects the live rate.
  await setField(page, 'input[aria-label="Rentable SF"]', '10000');
  await expect(ins).toHaveValue('8000');
  await expect(insFormula).toHaveText('= SF × $0.80/SF');
  // Changing the type RECOMPUTES the still-default estimate and its formula text.
  await page.selectOption('select[aria-label="Type"]', 'Warehouse');   // 10000 × 0.30
  await expect(ins).toHaveValue('3000');
  await expect(insFormula).toHaveText('= SF × $0.30/SF');
  // Tax is a separate default keyed to price: setting the offer fills tax only,
  // never disturbing the insurance estimate.
  await setField(page, 'input[aria-label="Asking"]', '1000000');
  await expect(tax).toHaveValue('12000');
  await expect(ins).toHaveValue('3000');                               // untouched by the offer edit
  // Clearing the toggle zeroes the field…
  await insDefault.uncheck();
  await expect(ins).toHaveValue('0');
  await expect(insFormula).toHaveText('');
  // …and re-checking refills it from the live formula (Warehouse 0.30 × 10000).
  await insDefault.check();
  await expect(ins).toHaveValue('3000');
  // A typed figure is the user's own actual: it clears the toggle and a later type
  // change never overwrites it.
  await setField(page, 'input[aria-label="Insurance amount"]', '4444');
  await expect(insDefault).not.toBeChecked();
  await page.selectOption('select[aria-label="Type"]', 'Office');
  await expect(ins).toHaveValue('4444');
});

test('Formula entry — an arithmetic expression in a numeric field evaluates on commit (Excel-style)', async ({ page }) => {
  await loadSample(page);
  const offer = page.locator('.deal-strip input[aria-label="Offer price"]');
  const tax = page.locator('input[aria-label="Property taxes amount"]');
  const rate = page.locator('input[aria-label="Loan 1 rate"]');
  // A dollar field: the expression is replaced by its result and drives the model.
  await setField(page, '.deal-strip input[aria-label="Offer price"]', '1300000/2');
  await expect(offer).toHaveValue('650000');
  await expect.poll(async () => (await kpis(page))['CAP']).not.toContain('NaN');
  await setField(page, 'input[aria-label="Property taxes amount"]', '2+2');
  await expect(tax).toHaveValue('4');
  // A percent field evaluates in percent terms (5 + 0.5 → 5.5%).
  await setField(page, 'input[aria-label="Loan 1 rate"]', '5+0.5');
  await expect(rate).toHaveValue('5.5');
  // Plain numbers still commit unchanged.
  await setField(page, '.deal-strip input[aria-label="Offer price"]', '1300000');
  await expect(offer).toHaveValue('1300000');
});

test('Photos gallery — add image URLs (deduped + sanitized), view in a lightbox, remove, and persist', async ({ page }) => {
  await loadSample(page);
  const btn = page.locator('button[aria-label^="Photos"]');
  await expect(btn).toContainText('0');
  await btn.click();
  await expect(page.locator('.gallery')).toBeVisible();
  // paste four lines: two good URLs, a javascript: URL (dropped), and a duplicate
  await page.fill('textarea[aria-label="Add photo URLs"]',
    'https://ex.com/1.jpg\nhttps://ex.com/2.jpg\njavascript:alert(1)\nhttps://ex.com/1.jpg');
  await page.click('button:has-text("Add photos")');
  await expect(page.locator('.gallery__cell')).toHaveCount(2);   // deduped + junk dropped
  await expect(btn).toContainText('2');
  // full-size lightbox + keyboard nav
  await page.locator('.gallery__img').first().click();
  await expect(page.locator('.lightbox__cap')).toHaveText('1 / 2');
  await page.locator('.lightbox__nav[aria-label="Next photo"]').click();
  await expect(page.locator('.lightbox__cap')).toHaveText('2 / 2');
  await page.keyboard.press('Escape');
  await expect(page.locator('.lightbox')).toHaveCount(0);
  await expect(page.locator('.gallery')).toBeVisible();          // gallery survives the lightbox's Escape
  // remove one, close, and confirm it survives a reload (auto-saved)
  await page.locator('.gallery__del').first().click();
  await expect(page.locator('.gallery__cell')).toHaveCount(1);
  await page.click('button:has-text("Done")');
  await page.waitForTimeout(600);
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.kpi-strip');
  await expect(page.locator('button[aria-label^="Photos"]')).toContainText('1');
});

test('S31 import — one box takes a Crexi URL (server) or LoopNet page source (parsed in-browser)', async ({ page }) => {
  await loadSample(page);                 // boots the signed-in app
  const box = 'textarea[aria-label="Listing URL or page source"]';
  const openImport = async () => { await page.goto('./#/', { waitUntil: 'load' }); await page.waitForSelector('.lcard'); await page.click('button:has-text("Import a listing")'); await expect(page.locator('.import-modal')).toBeVisible(); };

  // (a) unsupported input surfaces an error, no navigation
  await openImport();
  await page.fill(box, 'just some words');
  await page.click('.modal__actions button:has-text("Import")');
  await expect(page.locator('.modal__status')).toContainText(/doesn.t look like/i);

  // (b) a LoopNet URL is refused with a hint to paste the source instead
  await page.fill(box, 'https://www.loopnet.com/Listing/x/41097591/');
  await page.click('.modal__actions button:has-text("Import")');
  await expect(page.locator('.modal__status')).toContainText(/page source/i);

  // (c) a Crexi URL imports via the (stubbed) Edge Function and opens the property
  await page.fill(box, 'https://www.crexi.com/properties/2606773/california-3091-marysville-boulevard');
  await page.click('.modal__actions button:has-text("Import")');
  await expect(page.locator('.modal__status--ok')).toContainText(/import successful/i);   // confirmed before the detail screen
  await page.waitForSelector('.kpi-strip');
  await expect(page.locator('button[aria-label^="Photos"]')).toContainText('2');
  await page.click('button[aria-label="Listing details"]');
  await expect(page.locator('input[aria-label="Subtype"]')).toHaveValue('Auto Shop');
  await expect(page.locator('input[aria-label="Source"]')).toHaveValue(/crexi\.com/);
  await page.keyboard.press('Escape');   // close the Listing-details modal before reopening Import

  // (d) pasted LoopNet page source is parsed in-browser (no network) into a property
  await openImport();
  const ld = JSON.stringify({ '@type': ['RealEstateListing', 'Product'], '@id': 'https://www.loopnet.com/Listing/1835-Fulton-Ave/41097591/#listing', name: '1835 Fulton Ave', url: 'https://www.loopnet.com/Listing/1835-Fulton-Ave/41097591/', offers: [{ price: 1050000, '@type': 'Offer' }], additionalProperty: [{ name: 'Property Type', value: ['Retail'] }, { name: 'Property Subtype', value: ['Storefront Retail/Office'] }, { name: 'Gross Leasable Area', value: ['4,697 SF'] }, { name: 'Year Built', value: ['1960'] }] });
  const source = `<!DOCTYPE html><html><body><img src="https://images1.loopnet.com/i2/H/110/1835-Fulton-Ave-Sacramento-CA-Building-Photo-1-Large.jpg"><script type="application/ld+json">${ld}</script></body></html>`;
  await page.fill(box, source);
  await page.click('.modal__actions button:has-text("Import")');
  await page.waitForSelector('.kpi-strip');
  await page.click('button[aria-label="Listing details"]');
  await expect(page.locator('input[aria-label="Subtype"]')).toHaveValue('Storefront Retail/Office');
  await expect(page.locator('input[aria-label="Source"]')).toHaveValue(/loopnet\.com/);
});

test('Pills check the FIXED 8% / 1.25 benchmark — a Target goal-seek moves actual CAP but not the bar', async ({ page }) => {
  await loadSample(page);
  const capPill = page.locator('.topbar__pills .pill').nth(0);
  // Sample CAP 5.13% vs the fixed 8% benchmark → fail.
  await expect(capPill).toContainText('< 8.00%');
  await expect(capPill).toHaveClass(/pill--fail/);
  // Target CAP is a goal-seek: 5% moves the ACTUAL CAP to 5.00%, but the pill still
  // checks the fixed 8.00% benchmark (not the Target) — so it stays fail at 5% < 8%.
  await setField(page, '.deal-strip input[aria-label="Target CAP"]', '5');
  await expect.poll(async () => (await kpis(page))['CAP']).toBe('5.00%');
  await expect(capPill).toContainText('CAP 5.00% < 8.00%');
  await expect(capPill).toHaveClass(/pill--fail/);
});

test('Target is a transient goal-seek — always renders empty on reload, never a stored default', async ({ page }) => {
  await loadSample(page);
  await expect(page.locator('.deal-strip input[aria-label="Target CAP"]')).toHaveValue('');   // empty on load
  // Goal-seeking to 9% moves the ACTUAL CAP, but the field is never a saved setting…
  await setField(page, '.deal-strip input[aria-label="Target CAP"]', '9');
  await expect.poll(async () => (await kpis(page))['CAP']).toBe('9.00%');
  // …so after a reload it renders empty again — no value ever reads as a default.
  await page.reload();
  await page.waitForSelector('.kpi-strip');
  await expect(page.locator('.deal-strip input[aria-label="Target CAP"]')).toHaveValue('');
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

test('S33 Loan 2 secondary financing — every deal gets an editable second loan slot, wired into the totals', async ({ page }) => {
  await loadSample(page);   // the sample was saved with only ONE loan — normalizeLoans() backfills a 2nd
  await expect(page.locator('input[aria-label="Loan 2 LTV"]')).toBeVisible();
  // a fresh, unfilled Loan 2 (0% LTV) is a pure no-op on every KPI (S5 fidelity)
  expect((await kpis(page))['CAP']).toBe('5.13%');
  expect((await kpis(page))['DSCR']).toBe('0.84');
  // filling in Loan 2 as a real secondary loan adds real debt service, so it's
  // genuinely wired into compute() — not just decorative fields
  await setField(page, 'input[aria-label="Loan 2 LTV"]', '10');
  await setField(page, 'input[aria-label="Loan 2 rate"]', '7');
  await setField(page, 'input[aria-label="Loan 2 amortization years"]', '25');
  await expect.poll(async () => (await kpis(page))['DSCR']).not.toBe('0.84');
  // persists across reload like any other field (auto-saved)
  await page.reload({ waitUntil: 'load' });
  await page.waitForSelector('.kpi-strip');
  await expect(page.locator('input[aria-label="Loan 2 LTV"]')).toHaveValue('10');
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

test('DELETE — deleting happens from the Archive rows (archive first), with confirmation', async ({ page }) => {
  await loadSample(page);
  await page.goto('./', { waitUntil: 'load' });
  await page.waitForSelector('.lcard');
  // Cards no longer carry Delete — only Archive.
  await expect(page.locator('.lcard .lcard__del')).toHaveCount(0);
  // Archive the sample, then delete it from the Archive view (confirmed).
  await page.click('button[aria-label^="Archive 715 Plumas"]');
  await expect(page.locator('.lcard')).toHaveCount(0);
  await page.click('#nav-archive');
  await page.waitForSelector('.archive-table');
  let asked = false;
  page.on('dialog', (d) => { asked = true; d.accept(); });
  await page.locator('.archive-del').first().click();
  await page.waitForTimeout(300);
  expect(asked).toBe(true);
  await expect(page.locator('.empty')).toContainText('No archived properties');   // deleted → archive empty
});

// (S22 demo-seed removed here: the demo deals now seed per-account via the
//  first-sign-in reconcile (js/account.js) rather than a local boot seed. That
//  gap-seed + "a deleted deal stays gone" behaviour is covered by the Node unit
//  test tests/reconcile.test.mjs and the fresh-account seed check in auth.spec.js.)

test('S32 archive — archived deals leave Properties/Compare and show as compare-style rows; restore returns them', async ({ page }) => {
  const errors = watchErrors(page);
  await loadSample(page);                                   // 715 Plumas (active)
  await page.goto('./', { waitUntil: 'load' });
  await page.click('button:has-text("+ New property")');    // a 2nd active deal
  await page.waitForSelector('.kpi-strip');
  await page.goto('./', { waitUntil: 'load' });
  await page.waitForSelector('.lcard');
  await expect(page.locator('.lcard')).toHaveCount(2);

  // Archive the "New property" card via its footer Archive button → it leaves the list.
  await page.click('button[aria-label="Archive New property"]');
  await expect(page.locator('.lcard')).toHaveCount(1);
  await expect(page.locator('.lcard__name')).toContainText('715 Plumas');
  await expect(page.locator('#nav-archive')).toContainText('Archive (1)');   // header count updates

  // Archived deals are excluded from Compare (1 active left → the needs-2+ state).
  await page.click('#nav-compare');
  await expect(page.locator('.empty')).toContainText('Compare needs 2+');

  // Archive view: the action bar lives on the list, so return there, then open
  // Archive. The archived deal is a row in a compare-style rows table.
  await page.click('button:has-text("Back to properties")');
  await page.waitForSelector('.lcard');
  await page.click('#nav-archive');
  await page.waitForSelector('.archive-table');
  await expect(page.locator('.archive-table.compare-table--rows')).toBeVisible();
  await expect(page.locator('.archive-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.archive-name')).toContainText('New property');

  // Restore → the row leaves the archive (now empty); it's active again on Properties.
  await page.click('.archive-table .archive-restore');
  await expect(page.locator('.empty')).toContainText('No archived properties');
  await page.click('#nav-properties');
  await page.waitForSelector('.lcard');
  await expect(page.locator('.lcard')).toHaveCount(2);
  await expect(page.locator('#nav-archive')).toHaveText('Archive');   // count gone (0 archived)
  expect(errors).toEqual([]);
});

test('S32b archive persists across reload — an archived deal stays out of the list', async ({ page }) => {
  await loadSample(page);
  await page.goto('./', { waitUntil: 'load' });
  await page.waitForSelector('.lcard');
  await page.click('button[aria-label^="Archive 715 Plumas"]');
  await expect(page.locator('.lcard')).toHaveCount(0);       // only deal archived → empty list
  await page.reload({ waitUntil: 'load' });
  // Still archived after reload (auto-saved): the list is empty, the header Archive
  // entry keeps its count.
  await expect(page.locator('.lcard')).toHaveCount(0);
  await expect(page.locator('#nav-archive')).toContainText('Archive (1)');
});
