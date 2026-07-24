// views/dashboard.js — the one-screen property dashboard: editable inputs,
// live recompute, KPI strip, 5yr pro-forma, expense toggles, methodology.
// Inputs stay mounted (focus preserved); only output nodes refresh on edit.

import { el, clear, render, toast, dragScroll } from '../dom.js';
import * as fmt from '../format.js';
import { compute, capVerdict, dscrVerdict, onePctVerdict, BENCHMARK_CAP, BENCHMARK_DSCR } from '../model.js';
import { NOTES } from '../notes.js';
import { commitNumericInput } from '../mathinput.js';
import { parsePhotoUrls, normalizeMedia, safeImageUrl } from '../media.js';

const DEBOUNCE = 120;

// ── small field builders ───────────────────────────────────────────────
function fieldNum(value, onChange, opts = {}) {
  // `type=text` (not `number`) so an arithmetic expression can be typed — the
  // browser's number input would reject "2+2" outright. `inputmode=decimal`
  // keeps the numeric keypad on touch.
  const input = el('input', {
    class: 'input' + (opts.estimate ? ' input--estimate' : ''),
    type: 'text', inputmode: 'decimal', autocomplete: 'off',
    value: value ?? '', 'aria-label': opts.label || '',
  });
  // Commit on `change` (fires on Enter or blur), not on every keystroke, so the
  // dashboard recomputes once the field is finished — and each edit is one
  // atomic, undoable step. An expression is evaluated and the field shows the
  // result (Excel-style), so what's stored and what's displayed always match.
  input.addEventListener('change', () => {
    const { value: v, display } = commitNumericInput(input.value);
    input.value = display;
    onChange(v);
  });
  return input;
}
function fieldText(value, onChange, opts = {}) {
  const input = el('input', { class: 'input', type: 'text', value: value ?? '', 'aria-label': opts.label || '' });
  input.addEventListener('change', () => onChange(input.value));
  return input;
}
// Percentage entry: the model stores a decimal (0.09) but the user types/reads
// percent (9). onChange still receives the decimal.
function fieldPercent(value, onChange, opts = {}) {
  const shown = fmt.percentInput(value);
  const wrap = el('span', { class: 'input-pct' }, [
    el('input', {
      class: 'input', type: 'text', inputmode: 'decimal', autocomplete: 'off',
      value: shown, 'aria-label': opts.label || '',
    }),
    el('span', { class: 'input-pct__sign', text: '%' }),
  ]);
  const input = wrap.firstChild;
  // The user types/reads percent; an expression evaluates in percent terms
  // (e.g. `5+0.5` → 5.5%) before the decimal is stored.
  input.addEventListener('change', () => {
    const { value: v, display } = commitNumericInput(input.value);
    input.value = display;
    onChange(display === '' ? 0 : v / 100);
  });
  return wrap;
}
function fieldDate(value, onChange, opts = {}) {
  const input = el('input', { class: 'input', type: 'date', value: value ?? '', 'aria-label': opts.label || '' });
  input.addEventListener('change', () => onChange(input.value));
  return input;
}
function fieldSelect(value, options, onChange, label) {
  const sel = el('select', { class: 'input', 'aria-label': label || '' },
    options.map((o) => el('option', { value: o, selected: o === value ? true : null, text: o })));
  sel.addEventListener('change', () => onChange(sel.value));
  return sel;
}

// ── main render ─────────────────────────────────────────────────────────
export function renderDashboard(container, ctx) {
  const prop = ctx.property;               // working copy (mutable)
  prop.media = normalizeMedia(prop.media); // photos: string[] of validated image URLs (default [])
  const out = {};                          // output nodes we refresh
  let timer = null;
  let firstPaint = true;                   // suppress change-flash on initial render

  // Soft "this value just changed" cue: the values changed by the latest edit
  // keep a faint highlight until the next edit, which clears them and marks the
  // newly-changed ones. Suppressed on the initial render.
  const flashed = [];
  function clearFlashes() { flashed.forEach((n) => n.classList.remove('flash')); flashed.length = 0; }
  function flash(node) {
    if (!node) return;
    node.classList.add('flash');
    flashed.push(node);
  }
  function setText(node, value, noFlash) {
    const s = String(value);
    if (node.textContent === s) return;
    node.textContent = s;
    // noFlash: skip the corner-fold change marker for tiny inline annotations
    // (e.g. the "% share of NOI" labels), where the 12px fold overlaps the text.
    if (!firstPaint && !noFlash) flash(node);
  }

  function refresh() {
    const m = compute(prop);
    ctx.setHeaderVerdicts(m, prop);        // topbar pills
    if (!firstPaint) clearFlashes();       // drop the prior edit's highlights before marking new ones
    paintKPIs(m);
    paintDerived(m);
    paintTargetRows(m);                    // Target CAP/DSCR sliders + readouts track the live actual value
  }
  function onEdit() {
    if (ctx.onCommit) ctx.onCommit();   // snapshot the pre-edit state for undo (one call per committed edit)
    clearTimeout(timer); timer = setTimeout(refresh, DEBOUNCE);
  }

  // Offer inputs appear twice (the deal-summary strip atop Property Info and
  // the Offer & Debt card); offerField keeps every input bound to the same
  // field in sync so editing either one updates the other live. All-In Cost
  // is derived and painted into every registered cell (out.allInCells).
  const offerInputs = { offerPrice: [], fees: [], improvements: [] };
  out.allInCells = [];
  function offerField(key, label) {
    const input = fieldNum(prop.offer[key], (v) => {
      prop.offer[key] = v;
      offerInputs[key].forEach((n) => { if (n !== input) n.value = input.value; });
      if (key === 'offerPrice') seedFormulaExpenses(['taxes']);   // offer drives the tax estimate only
      onEdit();
    }, { label });
    offerInputs[key].push(input);
    return input;
  }

  // Estimated expense defaults. Tax scales with price (offer × 0.012); insurance
  // scales with the building — rentableSF × a $/SF rate keyed to the Property Type
  // (a rough pre-quote ballpark). Each defaultable row (tax, insurance) has a
  // "use default" toggle: when it's on (e.useDefault), seedFormulaExpenses(keys)
  // recomputes that row when its driver just changed (offer/Asking → taxes;
  // SF/type → insurance), so an SF edit never disturbs a goal-sought offer's taxes.
  // A row with the toggle off holds whatever the user typed (or a fixture's real
  // figure) and is never touched. Goal-seek moves the offer WITHOUT calling this
  // (sets the input value directly, firing no change event), so it stays exact.
  const INSURANCE_RATE = {        // $/SF/yr by property type
    Office: 0.65, Retail: 1.00, Industrial: 0.70, Warehouse: 0.30,
    Multifamily: 1.00, Residential: 1.00, Commercial: 0.80,
  };
  function estimateExpense(key) {
    if (key === 'taxes') return Math.round((Number(prop.offer.offerPrice) || 0) * 0.012);
    if (key === 'insurance') {
      const rate = INSURANCE_RATE[prop.info.propertyType] ?? INSURANCE_RATE.Commercial;
      return Math.round((Number(prop.info.rentableSF) || 0) * rate);
    }
    return 0;
  }
  const expAmountNodes = [];
  function seedFormulaExpenses(keys) {
    // Recompute only the rows whose "use default" toggle is on and whose driver
    // just changed — a typed actual (useDefault false) is never touched.
    expAmountNodes.forEach(({ e, input, sync }) => {
      if (!keys.includes(e.key) || !e.useDefault) return;
      e.amount = estimateExpense(e.key); e.seeded = true; input.value = String(e.amount);
      if (sync) sync();   // insurance formula text tracks the live property-type rate
    });
  }
  function dealCell(label, control, accent) {
    return el('div', { class: 'deal-cell' + (accent ? ' deal-cell--accent' : '') }, [
      el('span', { class: 'deal-cell__label', text: label }), control,
    ]);
  }
  // Goal-seek: typing a Desired CAP or DSCR back-solves the Offer Price that
  // achieves it (mirrors the workbook's Apps Script) and updates the offer
  // input in place; the verdict pills still compare actual ≥ desired. Flooring
  // keeps the resulting metric at/above target so the pill reads as met.
  // Desired ≤ 0 (or cleared) leaves the offer untouched.
  function pvAnnuity(rate, nper, pmt) {   // present value of a level payment stream
    if (rate === 0) return -(pmt * nper);
    return -(pmt * (1 - Math.pow(1 + rate, -nper)) / rate);
  }
  // Pure solve: the Offer Price that achieves a target CAP or DSCR against
  // metrics `m` — no mutation, so both the committed goal-seek below and the
  // ephemeral sweep in refresh() share this one formula.
  function solveOfferForTarget(kind, target, m) {
    if (kind === 'cap') {
      if (target > 0 && m.noi > 0) return m.noi / target;               // CAP = NOI ÷ offer
      return null;
    }
    const ln = prop.loans[0] || {};
    const rate = Number(ln.rate) || 0, term = Number(ln.termYears) || 0, ltv = Number(ln.ltv) || 0;
    if (target > 0 && term > 0 && ltv > 0 && Number.isFinite(m.noiLessCollection)) {
      const loan = pvAnnuity(rate / 12, term * 12, -(m.noiLessCollection / (target * 12)));
      return loan / ltv;                                                // gross the supported loan up by LTV
    }
    return null;
  }
  function goalSeekOffer(kind, target) {
    const offer = solveOfferForTarget(kind, target, compute(prop));
    if (Number.isFinite(offer) && offer > 0) {
      const v = Math.floor(offer);
      prop.offer.offerPrice = v;
      offerInputs.offerPrice.forEach((n) => { n.value = String(v); });
    }
  }
  // KPI strip — def = [label, valueFn, valueClassFn, noteFn, formula].
  // `formula` drives the hover/focus popup (mirrors workbook-model.md / model.js).
  const KPI_DEFS = [
    ['CAP', (m) => fmt.percent2(m.cap), (m) => verdictClass(capVerdict(m.cap)), () => `benchmark ${fmt.percent2(BENCHMARK_CAP)}`,
      'NOI ÷ Offer Price'],
    ['DSCR', (m) => fmt.ratio(m.dscr), (m) => verdictClass(dscrVerdict(m.dscr)), () => `benchmark ${fmt.ratio(BENCHMARK_DSCR)}`,
      '(Rent − collection loss − included expenses) ÷ annual debt service'],
    ['NOI', (m) => fmt.money(m.noi), null, () => 'per year',
      'Total rent − included expenses'],
    ['NOI − Debt Svc', (m) => fmt.money(m.noiDebtService), null, () => 'per year',
      'NOI − annual debt service'],
    ['NOI − Coll. Loss', (m) => fmt.money(m.noiLessCollection), null, () => 'less collection',
      '(Rent − collection loss) − included expenses'],
    ['Cash on Cash', (m) => fmt.percent2(m.cashOnCash), null, () => 'on equity',
      '(NOI − annual debt service) ÷ all-in cost'],
    ['Annual IRR', (m) => fmt.percent2(m.irr), (m) => m.irr !== null && m.irr >= m.wacc ? 'kpi__value--pass' : '', () => 'vs WACC',
      'Rate where NPV of [−all-in cost, yr 1…5 cashflows] = 0'],
    ['5Y NPV', (m) => fmt.money(m.npv), (m) => m.npv > 0 ? 'kpi__value--pass' : (m.npv < 0 ? 'kpi__value--fail' : ''), () => 'at WACC',
      '−All-in cost + Σ (yearₜ cashflow ÷ (1 + WACC)ᵗ), t = 1…5'],
    ['5Y Total Return', (m) => fmt.money(m.totalReturn), null, () => 'CF + appreciation',
      'Sum of the 5-year cashflow + appreciation series (incl. −all-in)'],
    ['WACC', (m) => fmt.percent2(m.wacc), null, () => 'hurdle rate',
      'Σ(LTV × rate × (1 − tax)) + (1 − ΣLTV) × min. opportunity cost of equity'],
    ['Return on Cost', (m) => fmt.percent2(m.returnOnCost), null, () => 'NOI / all-in',
      'NOI ÷ all-in cost'],
    ['1% Rule', (m) => fmt.money(m.onePctRule), (m) => verdictClass(onePctVerdict(m.onePctRule)), () => 'rent vs 1% offer',
      'Monthly rent − 1% of offer price'],
    ['Breakeven Occ.', (m) => fmt.percent2(m.breakevenOccupancy), null, () => 'of gross income',
      '(Included expenses + annual debt service) ÷ gross annual income'],
    ['Expense Ratio', (m) => fmt.percent2(m.expenseRatio), null, () => 'of gross income',
      'Included expenses ÷ gross annual income'],
    ['Price/SF', (m) => fmt.moneyCents(m.priceSF), null, () => 'offer ÷ rentable SF',
      'Offer Price ÷ Rentable SF'],
  ];
  // Shared formula popup — position:fixed so it escapes the strip's overflow:hidden
  // and can be clamped to the viewport. Included in render() so it's cleaned up.
  const kpiTip = el('div', { class: 'kpi-tip', role: 'tooltip' });
  function showTip(anchor, text) {
    kpiTip.textContent = text;
    kpiTip.classList.add('kpi-tip--on');
    kpiTip.style.left = '0px'; kpiTip.style.top = '0px';   // measure at origin
    const a = anchor.getBoundingClientRect(), t = kpiTip.getBoundingClientRect();
    const left = Math.max(8, Math.min(a.left + a.width / 2 - t.width / 2, window.innerWidth - t.width - 8));
    let top = a.top - t.height - 6;
    if (top < 4) top = a.bottom + 6;                        // flip below if it would leave the viewport
    kpiTip.style.left = left + 'px'; kpiTip.style.top = top + 'px';
  }
  function hideTip() { kpiTip.classList.remove('kpi-tip--on'); }
  const kpiStrip = el('section', { class: 'kpi-strip', 'aria-label': 'Key metrics' },
    KPI_DEFS.map((def, i) => {
      const valNode = el('div', { class: 'kpi__value' });
      const noteNode = el('div', { class: 'kpi__note' });
      const formula = def[4];
      const srDesc = formula ? el('span', { class: 'sr-only', id: 'kpi-f' + i, text: 'Formula: ' + formula }) : null;
      const cell = el('div', formula ? { class: 'kpi kpi--info', tabindex: '0', 'aria-describedby': 'kpi-f' + i } : { class: 'kpi' }, [
        el('span', { class: 'kpi__label', text: def[0] }), valNode, noteNode, srDesc,
      ]);
      out['kpi' + i] = { valNode, noteNode, def, cell };
      if (formula) {
        cell.addEventListener('mouseenter', () => showTip(cell, formula));
        cell.addEventListener('mouseleave', hideTip);
        cell.addEventListener('focus', () => showTip(cell, formula));
        cell.addEventListener('blur', hideTip);
      }
      return cell;
    }));

  function paintKPIs(m) {
    KPI_DEFS.forEach((def, i) => {
      const { valNode, noteNode, cell } = out['kpi' + i];
      const nv = def[1](m);
      if (valNode.textContent !== nv && !firstPaint) flash(cell);   // flash the cell (valNode's class is reset below)
      valNode.textContent = nv;
      valNode.className = 'kpi__value ' + (def[2] ? def[2](m) : '');
      noteNode.textContent = def[3](m);
    });
  }

  // Property info ---------------------------------------------------------
  const PROPERTY_TYPES = Object.keys(INSURANCE_RATE);   // dropdown = the rate table's keys
  const infoDefs = [
    ['Type', 'propertyType', 'select'],
    ['Asking', 'askingPrice', 'num'], ['Appraised', 'appraisedValue', 'num'],
    ['Rentable SF', 'rentableSF', 'num'], ['Lot', 'lotSize', 'text'],
    ['Built', 'yearBuilt', 'num'], ['Zoning', 'zoning', 'text'],
    ['Beds', 'bedrooms', 'text'], ['Baths', 'baths', 'text'],
    ['HVAC', 'hvacAge', 'text'], ['Roof', 'roofAge', 'text'],
    ['Parking', 'parking', 'text'], ['Ceiling', 'ceilingHeight', 'text'],
    ['APN', 'apn', 'text'],
  ];
  // Deal summary — full-width band ABOVE the cards, mirroring the workbook's
  // Offer/All-In/Fees/Improvement header row. Editable, synced with the Offer
  // & Debt card; All-In Cost derived. Built here, mounted in render() below.
  const allInSummaryCell = el('div', { class: 'deal-cell__val' });
  out.allInCells.push(allInSummaryCell);
  // Dashboard-wide edit lock: sits right in front of the Offer Price field —
  // the deal's headline figure — but toggling it shades and read-only/disables
  // every editable field across the WHOLE dashboard (Property Info, Income,
  // Expenses, Offer & Debt Service incl. both loans, deal-strip, Assumptions),
  // not just Offer Price. Pro-Forma's horizon slider is excluded — a view
  // toggle, not deal data. Locking a field's own input naturally blocks any
  // path fed by its onChange — the Target CAP/DSCR goal-seek and the
  // Asking→Offer sync both stop firing once their source fields are locked, no
  // separate guard needed. Persisted on prop.locked (auto-saved, undoable).
  const dashLockBtn = el('button', { class: 'dash-lock-btn', type: 'button' });
  function paintDashLock() {
    const locked = !!prop.locked;
    container.classList.toggle('is-locked', locked);
    container.querySelectorAll('input, select, textarea').forEach((node) => {
      if (node.classList.contains('pf-slider')) return;   // view-only horizon toggle, not deal data
      if (node.tagName === 'SELECT' || node.type === 'checkbox' || node.type === 'range') node.disabled = locked;
      else node.readOnly = locked;
    });
    dashLockBtn.textContent = locked ? '🔒' : '🔓';
    dashLockBtn.classList.toggle('dash-lock-btn--locked', locked);
    dashLockBtn.title = locked ? 'Unlock every field in this deal' : 'Lock every field to prevent accidental edits';
    dashLockBtn.setAttribute('aria-label', locked ? 'Unlock all fields' : 'Lock all fields');
  }
  dashLockBtn.addEventListener('click', () => {
    prop.locked = !prop.locked;
    paintDashLock();
    onEdit();
  });
  const offerPriceField = el('div', { class: 'offer-lock' }, [dashLockBtn, offerField('offerPrice', 'Offer price')]);
  // Target CAP/DSCR is a GOAL-SEEK ACTION, not a stored setting: typing a value
  // back-solves the offer price so the ACTUAL CAP/DSCR becomes that number
  // (CAP = NOI÷offer, DSCR via PV(loan)÷LTV). It always renders EMPTY on load — a
  // deal never carries a "target" to redisplay (any stored value is ignored) — so
  // a value never reads as a default the user didn't set. The verdict pills check
  // the fixed benchmark, independent of this field.
  //
  // Target CAP / Target DSCR: a slider plus a directly-editable readout field,
  // both driving the SAME permanent back-solve (goalSeekOffer) — dragging the
  // slider to release, or typing a precise figure into the readout and
  // committing (Enter/blur), each move the real, saved Offer Price exactly
  // like the original goal-seek. No separate mode: the readout always shows
  // the deal's live actual CAP/DSCR (recomputed on every refresh, never a
  // separately stored "target"), and the slider position mirrors it
  // (clamped into its fixed range) — so both controls double as a live
  // display AND an editor for the same number.
  function makeTargetRow(kind, label, opts) {
    const { toTarget, fromTarget } = opts;
    function commit(target) { goalSeekOffer(kind, target); onEdit(); }
    const slider = el('input', {
      type: 'range', class: 'target-sweep-slider', 'aria-label': `${label} slider`,
      min: String(opts.min), max: String(opts.max), step: String(opts.step),
    });
    // 'change' (fires on release), not 'input' — one commit (one undo step)
    // per drag gesture, matching how every other field here commits on
    // Enter/blur rather than per keystroke.
    slider.addEventListener('change', () => { commit(toTarget(parseFloat(slider.value))); });
    const fieldWrap = opts.buildField(commit);
    const fieldInput = opts.getInput(fieldWrap);
    function paint(m) {
      const actual = opts.currentValue(m);
      if (!Number.isFinite(actual)) return;
      slider.value = String(Math.min(opts.max, Math.max(opts.min, fromTarget(actual))));
      if (document.activeElement !== fieldInput) fieldInput.value = opts.fieldDisplay(actual);
    }
    return { row: el('div', { class: 'target-row' }, [
      el('span', { class: 'target-row__label', text: label }), slider, fieldWrap,
    ]), paint };
  }
  const capRow = makeTargetRow('cap', 'Target CAP', {
    min: 5, max: 20, step: 0.05,
    toTarget: (v) => v / 100, fromTarget: (v) => v * 100,
    buildField: (onChange) => fieldPercent(null, onChange, { label: 'Target CAP' }),
    getInput: (wrap) => wrap.firstChild,
    fieldDisplay: (actual) => (actual * 100).toFixed(2),   // 2dp, matching the KPI strip's own CAP display
    currentValue: (m) => m.cap,
  });
  const dscrRow = makeTargetRow('dscr', 'Target DSCR', {
    min: 1, max: 5, step: 0.01,
    toTarget: (v) => v, fromTarget: (v) => v,
    buildField: (onChange) => fieldNum(null, onChange, { label: 'Target DSCR', step: '0.01' }),
    getInput: (wrap) => wrap,
    fieldDisplay: (actual) => actual.toFixed(2),
    currentValue: (m) => m.dscr,
  });
  function paintTargetRows(m) { capRow.paint(m); dscrRow.paint(m); }
  paintTargetRows(compute(prop));
  const dealStrip = el('div', { class: 'deal-strip', 'aria-label': 'Deal summary' }, [
    dealCell('Offer Price', offerPriceField),
    dealCell('All-In Cost', allInSummaryCell, true),
    dealCell('Fees', offerField('fees', 'Fees')),
    dealCell('Improvement', offerField('improvements', 'Improvements')),
    el('div', { class: 'deal-cell deal-cell--target-combo' }, [capRow.row, dscrRow.row]),
  ]);
  // Photos button — lives in the Property Info card header (not the top bar, so
  // the mobile top bar can't overflow; and in an existing header row, so it adds
  // no dashboard height). Opens the gallery modal (hoisted below).
  const photosBtn = el('button', { class: 'photos-btn', type: 'button', title: 'Photos' });
  function refreshPhotosBtn() {
    const n = prop.media.photos.length;
    photosBtn.textContent = '▦ ' + n;
    photosBtn.setAttribute('aria-label', `Photos (${n})`);
  }
  refreshPhotosBtn();
  photosBtn.addEventListener('click', openGallery);
  // Listing details — the extra descriptors imported from a source listing
  // (subtype, tenancy, broker, …) plus a free-text description. Kept in a modal
  // rather than inline fields so the one-screen layout holds on every context
  // (touch inputs are 44px tall, so extra inline rows would overflow on mobile).
  const LISTING_FIELDS = [['Subtype', 'subtype'], ['Broker', 'broker'], ['Source', 'source']];
  const listingBtn = el('button', { class: 'photos-btn', type: 'button', title: 'Listing details', 'aria-label': 'Listing details' });
  function refreshListingBtn() {
    const filled = LISTING_FIELDS.some(([, k]) => (prop.info[k] || '').trim())
      || (prop.info.photosLink || '').trim() || (prop.info.description || '').trim();
    listingBtn.textContent = filled ? '🏷 ✓' : '🏷';
  }
  refreshListingBtn();
  listingBtn.addEventListener('click', openListing);
  const infoCard = el('section', { class: 'card col-3', 'aria-label': 'Property Info' }, [
    el('div', { class: 'card__head' }, [
      el('span', { class: 'eyebrow', text: 'Property Info' }),
      el('div', { class: 'card__head-actions' }, [listingBtn, photosBtn]),
    ]),
    el('div', { class: 'form-grid form-grid--3' }, infoDefs.map(([label, key, type]) => {
      // Property Type drives the insurance estimate — re-seed a blank insurance on change.
      if (type === 'select') {
        return labeledField(label, fieldSelect(prop.info[key] || 'Commercial', PROPERTY_TYPES,
          (v) => { prop.info[key] = v; seedFormulaExpenses(['insurance']); onEdit(); }, label));
      }
      if (type === 'num') {
        return labeledField(label, fieldNum(prop.info[key], (v) => {
          prop.info[key] = v;
          // Workbook onEdit parity: editing Asking Price seeds the Offer Price to
          // it (the offer's starting point), syncing every bound offer input.
          if (key === 'askingPrice') {
            prop.offer.offerPrice = v;
            offerInputs.offerPrice.forEach((n) => { n.value = String(v); });
          }
          // Asking→Offer feeds the tax estimate; rentable SF feeds the insurance estimate.
          if (key === 'askingPrice') seedFormulaExpenses(['taxes']);
          if (key === 'rentableSF') seedFormulaExpenses(['insurance']);
          onEdit();
        }, { label }));
      }
      return labeledField(label, fieldText(prop.info[key], (v) => { prop.info[key] = v; onEdit(); }, { label }));
    })),
  ]);

  // Income ----------------------------------------------------------------
  const rentPerSFNodes = [];
  const incomeRows = prop.tenants.map((t, i) => {
    const rps = el('td', { class: 'num' });
    rentPerSFNodes.push(rps);
    return el('tr', {}, [
      el('td', {}, [fieldText(t.name, (v) => { t.name = v; onEdit(); }, { label: 'Tenant name' })]),
      el('td', { class: 'num' }, [fieldNum(t.sf, (v) => { t.sf = v; onEdit(); }, { label: 'SF' })]),
      el('td', { class: 'num' }, [fieldNum(t.monthlyIncome, (v) => { t.monthlyIncome = v; onEdit(); }, { label: 'Rent/mo' })]),
      rps,
      el('td', {}, [fieldDate(t.leaseExpires, (v) => { t.leaseExpires = v; onEdit(); }, { label: 'Lease expires' })]),
      el('td', {}, [fieldText(t.leaseOptions, (v) => { t.leaseOptions = v; onEdit(); }, { label: 'Lease options' })]),
    ]);
  });
  out.totalSFCell = el('td', { class: 'num' });        // SF column
  out.totalMoRentCell = el('td', { class: 'num' });    // Rent/mo column
  out.avgRentCell = el('td', { class: 'num' });         // Rent/SF column
  // Each "/ yr" figure sits left-aligned in a colspan cell over the lease
  // columns, so the three tiers line up in one money rail.
  out.totalRentCell = el('td', { class: 'num income-yr', colspan: '2' });   // $90,000 / yr — gross (unchanged)
  out.rentLossCell = el('td', { class: 'num income-yr', colspan: '2' });    // −$4,500 / yr — collection-loss deduction
  out.rentLessCell = el('td', { class: 'num income-yr', colspan: '2' });    // $85,500 / yr — effective (feeds NOI)
  out.collLossChip = el('span', { class: 'rt-chip rt-chip--loss' });        // the collection-loss rate, e.g. "5%"
  const incomeCard = card('Income', 'col-5', [
    tableWrap(el('table', { class: 'data-table data-table--dense' }, [
      el('thead', {}, el('tr', {}, ['Tenant', 'SF', 'Rent / mo', 'Rent / SF', 'Lease Expires', 'Lease Options']
        .map((h, i) => el('th', { scope: 'col', class: i >= 1 && i <= 3 ? 'num' : '' , text: h })))),
      el('tbody', {}, [
        ...incomeRows,
        // Totals footer: three tiers of one shaded band, separated by visible
        // rules — gross rent (kept as-is), the collection-loss deduction, then
        // the effective rent that feeds NOI (emphasized). See .rent-totals.
        el('tr', { class: 'total rent-totals rent-totals--gross' }, [el('td', { text: 'Total rent' }), out.totalSFCell, out.totalMoRentCell, out.avgRentCell, out.totalRentCell]),
        el('tr', { class: 'rent-totals rent-totals--loss' }, [el('td', { colspan: '4' }, [el('span', { text: 'Less collection loss' }), out.collLossChip]), out.rentLossCell]),
        el('tr', { class: 'rent-totals rent-totals--eff' }, [el('td', { colspan: '4' }, [el('span', { class: 'rt-label--eff', text: 'Effective rent' }), el('span', { class: 'rt-chip rt-chip--noi', text: 'feeds NOI' })]), out.rentLessCell]),
      ]),
    ])),
  ]);

  // Expenses --------------------------------------------------------------
  const expPctNodes = [];
  const DEFAULTABLE = { taxes: true, insurance: true };   // rows carrying a formula default
  // Tiny human formula shown next to the "use default" toggle. Insurance reflects
  // the live property-type rate; tax is a flat share of the offer.
  function defaultFormula(key) {
    if (key === 'taxes') return 'Offer × 1.2%';
    if (key === 'insurance') {
      const rate = INSURANCE_RATE[prop.info.propertyType] ?? INSURANCE_RATE.Commercial;
      return `SF × $${rate.toFixed(2)}/SF`;
    }
    return '';
  }
  const expRows = prop.expenses.map((e, i) => {
    let syncDefault = null;   // assigned below for tax/insurance; refreshes the toggle + formula text
    const chk = el('input', { type: 'checkbox', id: 'exp-' + e.key, checked: e.included ? true : null, 'aria-label': e.label + ' include in NOI' });
    chk.addEventListener('change', () => { e.included = chk.checked; rowEl.className = 'check-row' + (chk.checked ? '' : ' check-row--off'); onEdit(); });
    // Share-of-NOI badge — omitted on the defaultable rows (tax/insurance), where
    // it carries no meaning for the owner.
    const labelKids = [e.label + ' '];
    if (!DEFAULTABLE[e.key]) { const pct = el('span', { class: 'pct' }); expPctNodes.push({ pct, i }); labelKids.push(pct); }
    const amount = fieldNum(e.amount, (v) => {
      e.amount = v;
      // A typed figure is the user's own actual: it clears the default toggle so a
      // later driver change never overwrites it.
      if (DEFAULTABLE[e.key]) { e.useDefault = false; e.seeded = false; if (syncDefault) syncDefault(); }
      onEdit();
    }, { label: e.label + ' amount' });
    amount.classList.add('amount-input');
    const rowEl = el('div', { class: 'check-row' + (e.included ? '' : ' check-row--off') }, [
      chk,
      el('label', { for: 'exp-' + e.key }, labelKids),
      amount,
    ]);
    if (!DEFAULTABLE[e.key]) { expAmountNodes.push({ e, input: amount }); return el('div', { class: 'exp-cell' }, [rowEl]); }

    // Tax & insurance: a small "use default" checkbox. Checked pre-fills the
    // estimate (recomputed when its driver moves) and shows the formula in a tiny
    // font; cleared zeroes the field. Both sit on white like every other input.
    if (e.useDefault === undefined) e.useDefault = !!e.seeded;   // migrate the legacy seeded flag
    const dchk = el('input', { type: 'checkbox', checked: e.useDefault ? true : null, 'aria-label': 'Use default ' + e.label });
    const formula = el('span', { class: 'exp-default__formula' });
    syncDefault = () => {
      dchk.checked = !!e.useDefault;
      formula.textContent = e.useDefault ? '= ' + defaultFormula(e.key) : '';
    };
    dchk.addEventListener('change', () => {
      e.useDefault = dchk.checked;
      if (dchk.checked) { e.amount = estimateExpense(e.key); e.seeded = true; }
      else { e.amount = 0; e.seeded = false; }
      amount.value = String(e.amount);
      syncDefault();
      onEdit();
    });
    syncDefault();
    expAmountNodes.push({ e, input: amount, sync: syncDefault });
    return el('div', { class: 'exp-cell' }, [
      rowEl,
      el('label', { class: 'exp-default' }, [dchk, 'use default', formula]),
    ]);
  });
  out.totalInclCell = el('dd', {});
  const expenseCard = card('Expenses (yr) — included in NOI', 'col-4', [
    el('div', { class: 'check-grid' }, expRows),
    el('dl', { class: 'facts facts--1col' }, [
      el('div', {}, [el('dt', { text: 'Total incl. (feeds NOI) / all cat.' }), out.totalInclCell]),
    ]),
    el('p', { class: 'fineprint', text: '% = share of NOI' }),
  ]);

  // Offer & debt service --------------------------------------------------
  // Loan 1 + Loan 2 (a secondary financing option, normalized onto every
  // property in app.js) share ONE compact grid — LTV/Rate/Amort/Maturity/Type
  // as rows, one column per loan — rather than two stacked title+field+facts
  // blocks, so both fit the one-screen dashboard budget (S11) and read like
  // the reference workbook's side-by-side Finance Amount 1/2 columns.
  out.debtNodes = {};
  function loanColsRow(label, cells, cls) {
    return el('div', { class: 'loan-cols__row' + (cls ? ' ' + cls : '') }, [
      el('span', { class: 'loan-cols__label', text: label }), ...cells,
    ]);
  }
  const loanValCell = (nodes) => el('span', { class: 'loan-cols__val' }, nodes);
  // Loan Amount is derived (offer × LTV) — shown first, above the editable
  // params, so it reads as each loan's headline figure rather than buried in
  // a combined "amount · payment" fact line.
  const amountCells = prop.loans.map((ln, i) => {
    const amt = el('span', {}); out.debtNodes['loanAmt' + i] = amt;
    return loanValCell([amt]);
  });
  const loanCols = el('div', { class: 'loan-cols' }, [
    loanColsRow('', prop.loans.map((_, i) => el('span', { class: 'loan-cols__head', text: `Loan ${i + 1}` })), 'loan-cols__row--head'),
    loanColsRow('Amount', amountCells),
    loanColsRow('LTV', prop.loans.map((ln, i) => fieldPercent(ln.ltv, (v) => { ln.ltv = v; onEdit(); }, { label: `Loan ${i + 1} LTV`, step: '0.1' }))),
    loanColsRow('Rate', prop.loans.map((ln, i) => fieldPercent(ln.rate, (v) => { ln.rate = v; onEdit(); }, { label: `Loan ${i + 1} rate`, step: '0.1' }))),
    loanColsRow('Amort', prop.loans.map((ln, i) => fieldNum(ln.termYears, (v) => { ln.termYears = v; onEdit(); }, { label: `Loan ${i + 1} amortization years` }))),
    loanColsRow('Maturity', prop.loans.map((ln, i) => fieldNum(ln.maturityYears ?? 0, (v) => { ln.maturityYears = v; onEdit(); }, { label: `Loan ${i + 1} maturity years` }))),
    loanColsRow('Type', prop.loans.map((ln, i) => fieldSelect(ln.type, ['CONV', 'IO'], (v) => { ln.type = v; onEdit(); }, `Loan ${i + 1} type`))),
  ]);
  const payCells = prop.loans.map((ln, i) => {
    const pay = el('span', {}); out.debtNodes['pay' + i] = pay;
    return loanValCell([pay]);
  });
  const balloonCells = prop.loans.map((ln, i) => {
    const balloon = el('span', {}); out.debtNodes['balloon' + i] = balloon;
    return loanValCell([balloon]);
  });
  const loanFacts = el('div', { class: 'loan-cols loan-cols--facts' }, [
    loanColsRow('Mo. payment', payCells),
    loanColsRow('Balloon due', balloonCells),
  ]);
  out.totalMortgageCell = el('dd', {});
  out.allInCell = el('dd', {});
  out.allInCells.push(out.allInCell);
  // Offer / Fees / Improvement now live only in the deal-summary band above;
  // this card is loan data + derived debt/equity totals.
  const debtCard = card('Offer & Debt Service', 'col-3', [
    loanCols, loanFacts,
    el('dl', { class: 'facts facts--1col' }, [
      el('div', {}, [el('dt', { text: 'Total yearly mortgage' }), out.totalMortgageCell]),
      el('div', {}, [el('dt', { text: 'All-in cost (equity)' }), out.allInCell]),
    ]),
  ]);

  // Pro-forma -------------------------------------------------------------
  // Horizon is user-selectable (5 default, 10). drawProforma() rebuilds the
  // chart/table/stats into pfBody on each recompute and on slider change; the
  // slider itself stays mounted so it keeps focus/position across edits.
  let horizon = 5;
  let lastM = null;
  const pfBody = el('div', {});
  const horizonSlider = el('input', {
    type: 'range', min: '5', max: '10', step: '5', value: '5',
    class: 'pf-slider', 'aria-label': 'Pro-forma horizon (years)',
  });
  horizonSlider.addEventListener('input', () => {
    horizon = parseInt(horizonSlider.value, 10) || 5;
    if (lastM) drawProforma(lastM);
  });
  const proformaCard = card('Pro-Forma', 'col-6', [
    pfBody,
    el('div', { class: 'pf-head' }, [
      el('span', { class: 'pf-head__lbl', text: '5 yr' }), horizonSlider,
      el('span', { class: 'pf-head__lbl', text: '10 yr' }),
    ]),
  ]);

  // Assumptions + methodology --------------------------------------------
  const assumeDefs = [
    ['Min opp. equity', 'minOppCostEquity'], ['Tax (int. ded.)', 'taxRate'],
    ['Collection loss', 'collectionLoss'], ['Cashflow appr. rate', 'cashflowAppr'],
    ['Property appr. rate', 'capitalAppr'],
  ];
  // Desired CAP/DSCR now live in the deal-summary band above the cards.
  const assumeCard = card('Assumptions', '', [
    grid2(assumeDefs.map(([label, key]) =>
      labeledField(label, fieldPercent(prop.assumptions[key], (v) => { prop.assumptions[key] = v; onEdit(); }, { label, step: '0.1' })))),
  ]);
  const methodCard = el('section', { class: 'card notes', 'aria-label': 'Methodology' }, [
    el('span', { class: 'eyebrow', text: 'Methodology' }),
    el('details', {}, [
      el('summary', { text: 'Definitions & decision rules (workbook notes)' }),
      ...NOTES.map((n) => el('div', {}, [el('h3', { text: n.title }), el('p', { text: n.body })])),
    ]),
  ]);
  const rightStack = el('div', { class: 'col-3 stack' }, [assumeCard, methodCard]);

  function openGallery() {
    const grid = el('div', { class: 'gallery__grid' });
    function renderThumbs() {
      clear(grid);
      if (!prop.media.photos.length) {
        grid.appendChild(el('p', { class: 'gallery__empty', text: 'No photos yet — paste image URLs below to add them.' }));
        return;
      }
      prop.media.photos.forEach((url, i) => {
        const img = el('img', { class: 'gallery__img', loading: 'lazy', alt: `Photo ${i + 1}`, src: url });
        img.addEventListener('click', () => openLightbox(i));
        const del = el('button', { class: 'gallery__del', type: 'button', 'aria-label': `Remove photo ${i + 1}`, text: '×' });
        del.addEventListener('click', () => { prop.media.photos.splice(i, 1); renderThumbs(); refreshPhotosBtn(); onEdit(); });
        grid.appendChild(el('figure', { class: 'gallery__cell' }, [img, del]));
      });
    }
    const ta = el('textarea', { class: 'input gallery__ta', rows: '2', 'aria-label': 'Add photo URLs', placeholder: 'Paste image URLs — one per line…' });
    const addBtn = el('button', { class: 'btn btn--primary', type: 'button', text: 'Add photos' });
    addBtn.addEventListener('click', () => {
      const seen = new Set(prop.media.photos);
      const fresh = parsePhotoUrls(ta.value).filter((u) => !seen.has(u));
      if (!fresh.length) { toast('No new valid image URLs found', 'info'); return; }
      prop.media.photos.push(...fresh);
      ta.value = '';
      renderThumbs(); refreshPhotosBtn(); onEdit();
      toast(`Added ${fresh.length} photo${fresh.length > 1 ? 's' : ''}`, 'success');
    });
    const closeBtn = el('button', { class: 'btn btn--ghost', type: 'button', text: 'Done' });
    const panel = el('div', { class: 'modal__panel gallery', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Property photos' }, [
      el('div', { class: 'gallery__head' }, [el('h2', { class: 'modal__title', text: 'Photos' }), closeBtn]),
      grid,
      el('div', { class: 'gallery__add' }, [ta, addBtn]),
    ]);
    const overlay = el('div', { class: 'modal__overlay' }, [panel]);
    const close = () => { document.removeEventListener('keydown', onKey); overlay.remove(); };
    // Ignore Escape while the full-size lightbox is up — that layer owns the key,
    // so one Escape closes the lightbox only, not the gallery beneath it.
    const onKey = (e) => { if (e.key === 'Escape' && !document.querySelector('.lightbox')) close(); };
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    renderThumbs();
    document.body.appendChild(overlay);
    ta.focus();
  }

  // Full-size viewer with keyboard/arrow navigation.
  function openLightbox(start) {
    let idx = start;
    const img = el('img', { class: 'lightbox__img', alt: '' });
    const cap = el('div', { class: 'lightbox__cap' });
    const paint = () => { img.src = prop.media.photos[idx]; cap.textContent = `${idx + 1} / ${prop.media.photos.length}`; };
    const step = (d) => { const n = prop.media.photos.length; idx = (idx + d + n) % n; paint(); };
    const prev = el('button', { class: 'lightbox__nav', type: 'button', 'aria-label': 'Previous photo', text: '‹' });
    const next = el('button', { class: 'lightbox__nav', type: 'button', 'aria-label': 'Next photo', text: '›' });
    prev.addEventListener('click', (e) => { e.stopPropagation(); step(-1); });
    next.addEventListener('click', (e) => { e.stopPropagation(); step(1); });
    const box = el('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Photo viewer' }, [prev, img, next, cap]);
    const close = () => { document.removeEventListener('keydown', onKey); box.remove(); };
    const onKey = (e) => { if (e.key === 'Escape') close(); else if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); };
    box.addEventListener('click', (e) => { if (e.target === box) close(); });
    document.addEventListener('keydown', onKey);
    paint();
    document.body.appendChild(box);
  }

  // Listing-details modal — the extra descriptor fields + a description textarea.
  // Edits are committed once on close (one undo step), not per keystroke.
  function openListing() {
    let dirty = false;
    const fieldEls = LISTING_FIELDS.map(([label, key]) => {
      const inp = el('input', { class: 'input', type: 'text', value: prop.info[key] || '', 'aria-label': label });
      inp.addEventListener('input', () => { prop.info[key] = inp.value; dirty = true; });
      return el('label', { class: 'field' }, [el('span', { class: 'field__label', text: label }), inp]);
    });
    // Photos link — a URL to the source listing / photo gallery, with a live
    // "Open ↗" anchor when the value is a valid http(s) link.
    const linkInp = el('input', { class: 'input', type: 'url', value: prop.info.photosLink || '', 'aria-label': 'Photos link', placeholder: 'https://… listing / photo gallery' });
    const linkOpen = el('a', { class: 'link-open', target: '_blank', rel: 'noopener noreferrer', text: 'Open ↗' });
    const syncLink = () => { const u = safeImageUrl(linkInp.value); if (u) { linkOpen.href = u; linkOpen.hidden = false; } else { linkOpen.removeAttribute('href'); linkOpen.hidden = true; } };
    linkInp.addEventListener('input', () => { prop.info.photosLink = linkInp.value; dirty = true; syncLink(); });
    syncLink();
    const linkField = el('label', { class: 'field' }, [el('span', { class: 'field__label' }, ['Photos link ', linkOpen]), linkInp]);
    const ta = el('textarea', { class: 'input desc-ta', rows: '6', 'aria-label': 'Property description', placeholder: 'Description, highlights, building/business extras…' });
    ta.value = prop.info.description || '';
    ta.addEventListener('input', () => { prop.info.description = ta.value; dirty = true; });
    const closeBtn = el('button', { class: 'btn btn--ghost', type: 'button', text: 'Done' });
    const panel = el('div', { class: 'modal__panel desc-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Listing details' }, [
      el('div', { class: 'gallery__head' }, [el('h2', { class: 'modal__title', text: 'Listing details' }), closeBtn]),
      el('div', { class: 'form-grid' }, fieldEls),
      linkField,
      el('span', { class: 'field__label', text: 'Description' }),
      ta,
    ]);
    const overlay = el('div', { class: 'modal__overlay' }, [panel]);
    const close = () => {
      document.removeEventListener('keydown', onKey);
      overlay.remove();
      refreshListingBtn();
      if (dirty) onEdit();   // commit + auto-save once
    };
    const onKey = (e) => { if (e.key === 'Escape') close(); };
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
    document.addEventListener('keydown', onKey);
    document.body.appendChild(overlay);
    fieldEls[0].querySelector('input').focus();
  }

  // Actions — rendered into the top bar (keeps the dashboard one-screen) ----
  // Top-bar actions are just the edit-history controls (kept lean so the mobile
  // top bar never overflows). Edits auto-save on commit (no Save), and Delete
  // lives on each Properties-list card. The Photos button lives in the Property
  // Info card header instead.
  if (ctx.actionsHost) {
    render(ctx.actionsHost, [
      ...(ctx.undoButton ? [ctx.undoButton] : []),
      ...(ctx.redoButton ? [ctx.redoButton] : []),
    ]);
  }

  render(container, [
    kpiStrip,
    dealStrip,
    el('div', { class: 'grid' }, [infoCard, incomeCard, expenseCard, debtCard, proformaCard, rightStack]),
    kpiTip,
  ]);
  paintDashLock();   // applied after every field exists in the DOM

  // ── output painting ────────────────────────────────────────────────
  function paintDerived(m) {
    // income
    prop.tenants.forEach((t, i) => { setText(rentPerSFNodes[i], fmt.moneyCents(m.tenantRentPerSF[i])); });
    setText(out.totalSFCell, fmt.integer(m.totalTenantSF));
    setText(out.totalMoRentCell, fmt.money(m.totalMonthlyRent));
    setText(out.avgRentCell, fmt.moneyCents(m.avgRentPerSF));
    setText(out.totalRentCell, fmt.money(m.totalRent) + ' / yr');                        // $90,000 / yr — gross
    out.collLossChip.textContent = fmt.percent(prop.assumptions.collectionLoss);         // 5%
    setText(out.rentLossCell, fmt.money(m.rentLessCollection - m.totalRent) + ' / yr');  // −$4,500 / yr — deduction
    setText(out.rentLessCell, fmt.money(m.rentLessCollection) + ' / yr');                // $85,500 / yr — effective
    // expenses
    expPctNodes.forEach(({ pct, i }) => { setText(pct, fmt.percent(m.expensePctOfNoi[i]), true); });
    setText(out.totalInclCell, `${fmt.money(m.includedExpense)} / ${fmt.money(m.allExpense)}`);
    // debt
    m.loans.forEach((l, i) => {
      setText(out.debtNodes['loanAmt' + i], fmt.money(l.amount));
      setText(out.debtNodes['pay' + i], l.payment === null ? 'Invalid type' : fmt.money(l.payment));
      const balloonNode = out.debtNodes['balloon' + i];
      if (balloonNode) {
        setText(balloonNode, l.hasBalloon
          ? `${fmt.money(l.balloon)} · yr ${l.maturityYears}`
          : '—');
      }
    });
    setText(out.totalMortgageCell, fmt.money(m.annualDebt));
    out.allInCells.forEach((n) => { setText(n, fmt.money(m.allInCost)); });
    drawProforma(m);
  }
  function setCell(cell, v) {
    cell.textContent = fmt.money(v);
    cell.classList.toggle('neg', typeof v === 'number' && v < 0);
  }
  function barEl(kind, v, pxPerUnit, title) {
    const h = Math.max(2, Math.round(Math.abs(v) * pxPerUnit));
    // Bar length is magnitude; positive bars sit in the up-lane and negative
    // ones (e.g. a value-add deal that loses money early) drop into the
    // down-lane below the zero line, tinted red so a loss never reads as a gain.
    const b = el('div', { class: `chart__bar chart__bar--${kind}` + (v < 0 ? ' chart__bar--neg' : ''), title });
    b.style.height = h + 'px';
    return b;
  }
  function statRow(label, h, boundary) {
    return el('div', { class: 'pf-stat' + (boundary ? ' pf-stat--boundary' : '') }, [
      el('span', { class: 'pf-stat__label', text: label }),
      el('span', {}, [el('b', { text: fmt.money(h.npv) }), ' NPV']),
      el('span', {}, [el('b', { text: fmt.money(h.totalReturn) }), ' Total return']),
      el('span', {}, [el('b', { text: fmt.percent2(h.irr) }), ' IRR']),
    ]);
  }
  // Rebuild the pro-forma chart/table/stats for the selected horizon (5 or 10).
  function drawProforma(m) {
    lastM = m;
    const H = horizon;
    const pf = m.proforma;
    const hs = H === 10 ? pf.h10 : pf.h5;      // hold-series for the table (equity returned in YR H)
    const boundary = H === 10;                 // show the 5↔10 divider only when zoomed out
    // chart — operating cashflow + appreciation bars, years 1..H, on a shared
    // zero baseline: positives rise above the line, negatives drop below it.
    const op = pf.operating.slice(0, H), ap = pf.apprYear.slice(0, H);
    const H_PX = 70;   // keep in sync with .chart__plot height
    const vals = [...op, ...ap];
    const maxPos = Math.max(1, ...vals.filter((v) => v > 0));
    const maxNeg = Math.max(0, ...vals.filter((v) => v < 0).map((v) => -v));
    const span = maxPos + maxNeg;                       // one px-per-dollar scale, both directions
    const pxPerUnit = H_PX / span;
    const topPx = Math.round((maxPos / span) * H_PX);   // plot height above the zero line
    const botPx = H_PX - topPx;                         // …and below it
    const group = (c, apv, i) => {
      const cfBar = barEl('cf', c, pxPerUnit, `YR ${i + 1} cashflow ${fmt.money(c)}`);
      const apBar = barEl('ap', apv, pxPerUnit, `YR ${i + 1} appreciation ${fmt.money(apv)}`);
      const up = [], down = [];
      (c >= 0 ? up : down).push(cfBar);
      (apv >= 0 ? up : down).push(apBar);
      // No floating per-year total over the bars — it read as a value for the
      // (taller, adjacent) green appreciation bar. Each bar carries its own
      // value in its tooltip, and the table below lists cashflow, appreciation,
      // and their sum per year, so the legend stays unambiguous: blue = operating
      // cashflow, green = appreciation (never the combined total).
      return el('div', { class: 'chart__group' + (boundary && i === 4 ? ' chart__group--boundary' : '') }, [
        el('div', { class: 'chart__lane chart__lane--up' }, up),
        el('div', { class: 'chart__lane chart__lane--down' }, down),
      ]);
    };
    const chartPlot = el('div', { class: 'chart__plot', role: 'img', 'aria-label': `${H}-year operating cashflow and appreciation` },
      op.map((c, i) => group(c, ap[i], i)));
    chartPlot.style.setProperty('--pf-top', topPx + 'px');
    chartPlot.style.setProperty('--pf-bot', botPx + 'px');
    const chart = el('div', { class: 'chart' }, [
      chartPlot,
      el('div', { class: 'chart__xlabels' }, op.map((_, i) => el('span', { text: `YR ${i + 1}` }))),
      el('div', { class: 'legend' }, [
        el('span', {}, [el('i', { class: 'sw-cf' }), 'Operating cashflow']),
        el('span', {}, [el('i', { class: 'sw-ap' }), 'Appreciation']),
      ]),
    ]);
    // table — Initial + YR1..YRH; boundary border on the YR5 column when zoomed
    const heads = ['Series', 'Initial', ...Array.from({ length: H }, (_, i) => `YR ${i + 1}`)];
    const bCol = (i) => boundary && i === 6 ? ' cell--boundary' : '';   // header YR5 = index 6
    const row = (label, arr, cls) => el('tr', { class: cls || '' }, [el('td', { text: label }),
      ...arr.map((v, i) => { const c = el('td', { class: 'num' + (boundary && i === 5 ? ' cell--boundary' : '') }); setCell(c, v); return c; })]);
    const table = tableWrap(el('table', { class: 'data-table' }, [
      el('thead', {}, el('tr', {}, heads.map((h, i) => el('th', { scope: 'col', class: (i ? 'num' : '') + bCol(i), text: h })))),
      el('tbody', {}, [row('Cashflow', hs.cashflow), row('Appreciation', hs.appreciation), row('CF + appreciation', hs.combined, 'total')]),
    ]));
    // stats — 5-year always; 10-year (after the boundary) only when zoomed out
    const stats = el('div', { class: 'pf-stats' }, [
      statRow('5-year', pf.h5),
      boundary ? statRow('10-year', pf.h10, true) : null,
    ]);
    const note = el('p', { class: 'fineprint', text: `YR ${H} includes the return of equity (chart shows operating years); this series feeds IRR, NPV, and total return.` });
    render(pfBody, [chart, table, stats, note]);
  }

  refresh();          // initial paint
  firstPaint = false; // subsequent edits flash the values that change
}

// ── helpers ───────────────────────────────────────────────────────────
function verdictClass(v) { return v === null ? '' : (v ? 'kpi__value--pass' : 'kpi__value--fail'); }
function card(title, colClass, children) {
  return el('section', { class: 'card ' + (colClass || ''), 'aria-label': title }, [
    el('span', { class: 'eyebrow', text: title }), ...children,
  ]);
}
function tableWrap(t) { const w = el('div', { class: 'table-wrap' }, [t]); dragScroll(w); return w; }
function grid2(children) { return el('div', { class: 'form-grid' }, children); }
function labeledField(label, input) {
  return el('label', { class: 'field' }, [el('span', { class: 'field__label', text: label }), input]);
}
