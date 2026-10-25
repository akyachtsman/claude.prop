// fit.spec.js — S41: every overlay this app opens fits the visible screen and
// scrolls by finger, at each project's OWN size (design.md → iPhone and iPad;
// test.md → UI coverage gates, *Overlays fit and scroll*).
//
// Why a file of its own: property.spec.js and auth.spec.js set a 1440×900,
// no-touch context at file scope, so their DISMISS scenarios never render an
// overlay at phone width, and the kit's generic DISMISS stops after two
// navigation resets (3 of 10 triggers here, none of them an overlay). This file
// sets no viewport, so `iphone` runs it in WebKit at 390×664 with touch, which
// is the case the ruling is about.

import { test, expect } from './lib/fixtures.js';
import { fitProblems } from './lib/fit.js';
import { installSignedIn, seedLocalDealForReconcile } from './_supabase-mock.js';

// One fit check per overlay, allowed to take longer than the kit's 2s cap: a
// check that does not finish here is a failure, not a budget note, because this
// scenario exists only to run it.
const FIT_TIMEOUT = 10_000;

function watchErrors(page) {
  const errors = [];
  page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  return errors;
}

// The modal panel slides in over 0.16s; measure once it has settled.
async function settled(page) {
  await expect.poll(() => page.evaluate(() => document.getAnimations().length)).toBe(0);
}

async function expectFits(page, selector) {
  await expect(page.locator(selector)).toBeVisible();
  await settled(page);
  expect(await fitProblems(page.locator(selector), { timeout: FIT_TIMEOUT }), selector).toEqual([]);
}

// The short screen: an iPhone 12 on its side is 340px tall once Safari's bars
// show (devices['iPhone 12 landscape'] declares 750×340). No project declares
// that height, so the short runs keep each project's width and set it here.
const SHORT_HEIGHT = 340;
async function shortScreen(page) {
  test.info().annotations.push({ type: 'viewport-override', description: `height ${SHORT_HEIGHT}` });
  const vp = page.viewportSize();
  await page.setViewportSize({ width: vp.width, height: SHORT_HEIGHT });
}

// A photo at a real camera size, 1200x800, so the lightbox has to shrink it to fit
// (a 1x1 stub fits anywhere and would leave the lightbox check vacuous).
const PHOTO = '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="800">'
  + '<rect width="1200" height="800" fill="#4a6a8a"/></svg>';

// Opens each overlay in turn and checks it, closing it before the next.
async function walkOverlays(page) {
  await page.route('https://ex.com/**', (route) =>
    route.fulfill({ status: 200, contentType: 'image/svg+xml', body: PHOTO }));
  await installSignedIn(page);
  await page.goto('./', { waitUntil: 'load' });
  await page.click('button:has-text("Load sample deal")');
  await page.waitForSelector('.kpi-strip');

  // ── The dashboard itself stays within the screen's width. Measured against the
  // declared viewport, not innerWidth: mobile Chromium widens its layout viewport
  // to fit an overflowing page, so innerWidth grows with the overflow it should catch.
  const pageWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(pageWidth, 'the dashboard must not scroll sideways').toBeLessThanOrEqual(page.viewportSize().width + 1);

  // ── KPI formula popup (focus, so it opens on a touch screen too)
  await page.locator('.kpi').first().focus();
  await expectFits(page, '.kpi-tip--on');
  await page.locator('.kpi').first().blur();

  // ── Photos gallery, with more photos than its grid shows, so the fit check
  // exercises the scroll and not only the placement.
  await page.click('button[aria-label^="Photos"]');
  const urls = Array.from({ length: 24 }, (_, i) => `https://ex.com/${i}.jpg`).join('\n');
  await page.fill('textarea[aria-label="Add photo URLs"]', urls);
  await page.click('button:has-text("Add photos")');
  await expect(page.locator('.gallery__cell')).toHaveCount(24);
  const grid = page.locator('.gallery__grid');
  expect(await grid.evaluate((g) => g.scrollHeight > g.clientHeight), 'the grid must hold more than it shows').toBe(true);
  await expectFits(page, '.modal__overlay');

  // ── Lightbox, over the gallery. The photo must still be shown at a useful
  // size: shrinking it to nothing would also keep the arrows on screen.
  await page.locator('.gallery__img').first().click();
  await expectFits(page, '.lightbox');
  const vp = page.viewportSize();
  const shown = await page.locator('.lightbox__img').evaluate((img) => {
    const b = img.getBoundingClientRect();
    return { w: b.width, h: b.height };
  });
  expect(Math.max(shown.w / vp.width, shown.h / vp.height), 'the photo fills over half the screen one way').toBeGreaterThan(0.5);
  await page.locator('.lightbox__close').click();
  await page.click('.gallery button:has-text("Done")');
  await expect(page.locator('.gallery')).toHaveCount(0);

  // ── Listing details
  await page.click('button[aria-label="Listing details"]');
  await expectFits(page, '.modal__overlay');
  await page.click('.desc-modal button:has-text("Done")');
  await expect(page.locator('.desc-modal')).toHaveCount(0);

  // ── Import a listing (list view)
  await page.goto('./', { waitUntil: 'load' });
  await page.waitForSelector('.lcard');
  await page.click('button:has-text("Import a listing")');
  await expectFits(page, '.modal__overlay');
  await page.locator('.modal__close').click();
  await expect(page.locator('.modal__overlay')).toHaveCount(0);
}

// BUDGET for each walk: five overlays, each one open, one settle and one fit
// check (capped at 10s, usually a few frames), plus 24 photo stubs. WebKit on CI
// runs this project's scenarios ~1.5-1.7x slower than tablet (property.spec.js
// S40's note); 120s leaves room for every check to hit its cap.
test('S41 overlays fit — gallery, lightbox, Listing details, Import and the KPI formula popup fit the screen and scroll', async ({ page, renderWitness }) => {
  renderWitness();
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await walkOverlays(page);
  expect(errors).toEqual([]);
});

test('S41 overlays fit — the same overlays on a short screen (an iPhone on its side)', async ({ page }) => {
  test.setTimeout(120_000);
  const errors = watchErrors(page);
  await shortScreen(page);
  await walkOverlays(page);
  expect(errors).toEqual([]);
});

// The first-sign-in account prompt needs reconcile on, which the scenario above
// suppresses, so it gets its own boot (as in auth.spec.js).
test('S41 overlays fit — the "Move your local deals in?" prompt fits the screen', async ({ page, renderWitness }) => {
  renderWitness();
  test.setTimeout(60_000);
  const errors = watchErrors(page);
  await seedLocalDealForReconcile(page);
  await installSignedIn(page, { seed: [], reconcile: true });
  await page.goto('./', { waitUntil: 'load' });
  await expect(page.locator('.modal__title', { hasText: 'Move your local deals in?' })).toBeVisible();
  await expectFits(page, '.modal__overlay');
  await page.locator('button', { hasText: 'Not now' }).click();
  await expect(page.locator('.modal__overlay')).toHaveCount(0);
  expect(errors).toEqual([]);
});

// The dashboard's top bar: every control is on screen and is what a tap at its
// centre lands on. A sideways-scroll check cannot see this case: between 961 and
// about 1290px the switcher, pills and undo/redo used to paint over the nav
// without widening the page, so a tap on Restore hit Redo. Checked at the
// project's own width, then at 1024 (iPad landscape) and 1280 (a small laptop).
async function topbarProblems(page) {
  return page.evaluate(() => {
    const problems = [];
    const controls = document.querySelectorAll('.topbar button, .topbar a, .topbar .legacy-pill, .topbar .account > *');
    for (const c of controls) {
      const b = c.getBoundingClientRect();
      if (!b.width || !b.height) continue;
      const name = (c.getAttribute('aria-label') || c.textContent || c.className).trim().slice(0, 30);
      if (b.left < 0 || b.right > innerWidth + 1 || b.top < 0) { problems.push(`OFF SCREEN: ${name}`); continue; }
      const hit = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
      if (!hit || !(c === hit || c.contains(hit))) problems.push(`COVERED: ${name} (a tap lands on ${hit ? hit.className || hit.tagName : 'nothing'})`);
    }
    return problems;
  });
}

test('S41 top bar fits — every dashboard top-bar control is on screen and tappable', async ({ page, renderWitness }) => {
  renderWitness();
  test.setTimeout(60_000);
  const errors = watchErrors(page);
  await installSignedIn(page);
  await page.goto('./', { waitUntil: 'load' });
  await page.click('button:has-text("Load sample deal")');
  await page.waitForSelector('.kpi-strip');
  // Reload and reopen from the list, so no "Sample deal loaded." toast sits over the bar.
  await page.goto('./#/', { waitUntil: 'load' });
  await page.reload({ waitUntil: 'load' });
  await page.locator('.lcard__name').first().click();
  await page.waitForSelector('.kpi-strip');
  await page.mouse.move(1, page.viewportSize().height - 1);
  expect(await topbarProblems(page), `at ${page.viewportSize().width}px`).toEqual([]);

  test.info().annotations.push({ type: 'viewport-override', description: 'widths 1024 and 1280' });
  for (const width of [1024, 1280]) {
    await page.setViewportSize({ width, height: page.viewportSize().height });
    expect(await topbarProblems(page), `at ${width}px`).toEqual([]);
  }
  expect(errors).toEqual([]);
});
