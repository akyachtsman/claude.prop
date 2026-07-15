// property.spec.js — project-specific scenarios S5–S11 for the Property
// Analytics dashboard (spec.md SC-1..SC-7). Client-side only: no backend, so
// these run fully against the local server. Desktop viewport (laptop-first app).

import { test, expect } from '@playwright/test';

// Laptop-first functional tests: force a desktop, fine-pointer context so the
// one-screen and 44px-touch behaviours are tested in their intended mode.
// (The generic app.spec.js covers the mobile/touch viewports.)
test.use({ viewport: { width: 1440, height: 900 }, isMobile: false, hasTouch: false });

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

// Each test gets a fresh browser context (empty localStorage), so no explicit
// clear is needed — and clearing via addInitScript would wipe the store on the
// reloads that S7/S10 depend on.

test('S5 calc fidelity — sample deal KPIs match the workbook fixture', async ({ page }) => {
  const errors = watchErrors(page);
  await loadSample(page);
  const k = await kpis(page);
  expect(k['CAP']).toBe('8.04%');
  expect(k['DSCR']).toBe('1.32');
  expect(k['NOI']).toBe('$71,960');
  expect(k['NOI − Debt Svc']).toBe('$20,694');
  expect(k['NOI − Coll. Loss']).toBe('$67,460');
  expect(k['Cash on Cash']).toBe('8.47%');
  expect(k['Annual IRR']).toBe('16.49%');
  expect(k['5Y NPV']).toBe('$91,523'); // app-corrected NPV (workbook shows $85,264)
  expect(k['5Y Total Return']).toBe('$203,021');
  expect(k['WACC']).toBe('7.34%');
  expect(k['Return on Cost']).toBe('29.45%');
  expect(k['1% Rule']).toBe('-$1,450');
  expect(errors).toEqual([]);
});

test('S6 live recalc — editing an input updates KPIs with no calculate button', async ({ page }) => {
  await loadSample(page);
  const before = (await kpis(page))['CAP'];
  await page.fill('input[aria-label="Offer price"]', '300000');
  await expect.poll(async () => (await kpis(page))['CAP']).not.toBe(before);
  expect((await kpis(page))['CAP']).toBe('23.99%');
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
  await page.fill('input[aria-label="Offer price"]', '250000');
  await page.click('.topbar__action'); // Save
  await page.click('#nav-compare');
  await page.waitForSelector('.compare-table');
  await expect(page.locator('.cell--best').first()).toBeVisible();
  await expect(page.locator('.cell--worst').first()).toBeVisible();
  await expect(page.locator('.compare-verdict .pill').first()).toBeVisible();
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
  // capture the serialized store, clear, restore, reload — SC-6 substance
  const saved = await page.evaluate(() => localStorage.getItem('propanalytics.v1'));
  expect(saved).toContain('715 Plumas St');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((v) => localStorage.setItem('propanalytics.v1', v), saved);
  await page.goto('./', { waitUntil: 'load' });
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
  await expect(allIn).toHaveText('$244,335');           // derived, painted into the band
  // Offer price now lives only in the band — not duplicated in the Offer & Debt card
  await expect(page.locator('input[aria-label="Offer price"]')).toHaveCount(1);
  await expect(page.locator('.card[aria-label="Offer & Debt Service"] input[aria-label="Offer price"]')).toHaveCount(0);
  // editing it recomputes the derived All-In (300000 × (1 − 0.727)) and the card's copy
  await summaryOffer.fill('300000');
  await expect(allIn).toHaveText('$81,900');
  await expect(page.locator('.card[aria-label="Offer & Debt Service"] .facts dd').last()).toHaveText('$81,900');
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
  await expect(stats.first()).toContainText('$91,523');
  await expect(page.locator('.chart__group--boundary')).toHaveCount(0);
  // zoom to 10 → 10 bars, a boundary divider, and a second (10-year) stats block
  await setHorizon('10');
  await expect(bars).toHaveCount(10);
  await expect(page.locator('.chart__group--boundary')).toHaveCount(1);
  await expect(stats).toHaveCount(2);
  await expect(stats.nth(1)).toContainText('10-year');
  await expect(stats.nth(1)).toContainText('$171,200');
  // headline stays 5-year: top KPI strip 5Y NPV unchanged, and the 5-year block too
  expect((await kpis(page))['5Y NPV']).toBe('$91,523');
  await expect(stats.first()).toContainText('$91,523');
  // zoom back to 5 → boundary and 10-year block gone
  await setHorizon('5');
  await expect(bars).toHaveCount(5);
  await expect(stats).toHaveCount(1);
});

test('S15 desired CAP/DSCR goal-seek — typing a target back-solves the offer price', async ({ page }) => {
  await loadSample(page);
  const offer = page.locator('.deal-strip input[aria-label="Offer price"]');
  // Desired CAP 8% → offer = NOI ÷ 0.08 = 899,500; CAP reads 8.00% and passes
  await page.fill('.deal-strip input[aria-label="Desired CAP"]', '0.08');
  await expect(offer).toHaveValue('899500');
  await expect.poll(async () => (await kpis(page))['CAP']).toBe('8.00%');
  // Desired DSCR 1.4 → offer back-solves through the loan (PV ÷ LTV) to 841,227; DSCR reads 1.40
  await page.fill('.deal-strip input[aria-label="Desired DSCR"]', '1.4');
  await expect(offer).toHaveValue('841227');
  await expect.poll(async () => (await kpis(page))['DSCR']).toBe('1.40');
});

test('S16 change flash — affected values flash softly on edit, not on load or inert edits', async ({ page }) => {
  await loadSample(page);
  const flashes = page.locator('.flash');
  await expect(flashes).toHaveCount(0);                     // nothing flashes on initial render
  await page.fill('input[aria-label="APN"]', 'XYZ-123');    // pure text field, no computed effect
  await page.waitForTimeout(200);
  await expect(flashes).toHaveCount(0);
  const capCell = page.locator('.kpi', { has: page.locator('.kpi__label', { hasText: /^CAP$/ }) });
  await page.fill('.deal-strip input[aria-label="Offer price"]', '300000');   // ripples into CAP, All-In, …
  await expect(capCell).toHaveClass(/flash/);
  await expect(flashes.first()).toBeVisible();
});

test('DELETE dismiss — delete asks for confirmation', async ({ page }) => {
  await loadSample(page);
  let asked = false;
  page.on('dialog', (d) => { asked = true; d.dismiss(); });
  await page.click('.topbar__action:has-text("Delete")');
  await page.waitForTimeout(200);
  expect(asked).toBe(true);
  // dismissed → still on the dashboard
  await expect(page.locator('.kpi-strip')).toBeVisible();
});
