import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { classifyImportInput, parseLoopNetHtml } from '../js/importparse.js';

const html = fs.readFileSync(fileURLToPath(new URL('./fixtures/loopnet-1835.html', import.meta.url)), 'utf8');

test('classifyImportInput distinguishes url, html, empty', () => {
  assert.equal(classifyImportInput('https://www.crexi.com/properties/2606773/x'), 'url');
  assert.equal(classifyImportInput('  https://www.loopnet.com/Listing/x/1/  '), 'url');
  assert.equal(classifyImportInput('<!DOCTYPE html><html>…'), 'html');
  assert.equal(classifyImportInput('<section class="x">'), 'html');
  assert.equal(classifyImportInput(''), 'empty');
  assert.equal(classifyImportInput('just some words'), 'unknown');
});

test('parseLoopNetHtml extracts a property from pasted page source', () => {
  const res = parseLoopNetHtml(html);
  assert.equal(res.ok, true);
  const p = res.property;
  assert.equal(p.id, 'loopnet-41097591');
  assert.equal(p.name, '1835 Fulton Ave');
  assert.equal(p.info.propertyType, 'Retail');
  assert.equal(p.info.subtype, 'Storefront Retail/Office');
  assert.equal(p.info.askingPrice, 1050000);
  assert.equal(p.offer.offerPrice, 1050000);
  assert.equal(p.info.rentableSF, 4697);
  assert.equal(p.info.yearBuilt, '1960');
  assert.equal(p.info.zoning, 'SPA LC');
  assert.equal(p.info.lotSize, '0.25 AC');
  assert.equal(p.info.apn, '278-0240-010');
  assert.equal(p.info.appraisedValue, 808746);
  assert.equal(p.info.broker, 'Daniel Mueller & Cameron Freelove — Century 21 Select Real Estate Inc.');
  assert.match(p.info.source, /loopnet\.com\/Listing\/1835-Fulton-Ave-Sacramento-CA\/41097591/);
  assert.equal(p.media.photos.length, 3);
  assert.ok(p.media.photos[0].includes('Building-Photo-1-Large.jpg'));
  // opportunity zone / walk score have no dedicated field → folded into description
  assert.match(p.info.description, /Opportunity Zone: Yes/);
  assert.match(p.info.description, /Walk Score: 70/);
  // taxes seeded from price, insurance from SF (both default-on)
  assert.equal(p.expenses.find((e) => e.key === 'taxes').amount, Math.round(1050000 * 0.012));
  assert.equal(p.expenses.find((e) => e.key === 'insurance').amount, 4697);
});

test('parseLoopNetHtml errors clearly when no listing data is present', () => {
  const res = parseLoopNetHtml('<html><body>no structured data here</body></html>');
  assert.equal(res.ok, false);
  assert.match(res.error, /full page source/i);
});
