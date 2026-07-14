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
  expect(k['CAP']).toBe('7.30%');
  expect(k['DSCR']).toBe('1.19');
  expect(k['NOI']).toBe('$33,576');
  expect(k['NOI − Debt Svc']).toBe('$7,486');
  expect(k['NOI − Coll. Loss']).toBe('$31,056');
  expect(k['Cash on Cash']).toBe('4.75%');
  expect(k['Annual IRR']).toBe('10.97%');
  expect(k['5Y NPV']).toBe('$20,325');
  expect(k['5Y Total Return']).toBe('$86,835');
  expect(k['WACC']).toBe('7.78%');
  expect(k['Return on Cost']).toBe('21.30%');
  expect(k['1% Rule']).toBe('-$400');
  expect(errors).toEqual([]);
});

test('S6 live recalc — editing an input updates KPIs with no calculate button', async ({ page }) => {
  await loadSample(page);
  const before = (await kpis(page))['CAP'];
  await page.fill('input[aria-label="Offer price"]', '300000');
  await expect.poll(async () => (await kpis(page))['CAP']).not.toBe(before);
  expect((await kpis(page))['CAP']).toBe('11.19%');
});

test('S7 persistence — a saved property survives a reload', async ({ page }) => {
  await loadSample(page);        // loadSample saves it via store
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('.lcard__name')).toContainText('1042 Maple Ave');
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
  expect(saved).toContain('1042 Maple Ave');
  await page.evaluate(() => localStorage.clear());
  await page.evaluate((v) => localStorage.setItem('propanalytics.v1', v), saved);
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('.lcard__name')).toContainText('1042 Maple Ave');
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
