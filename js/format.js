// format.js — number/date/rate formatting, single source of truth.
// Editorial rules from design.md: whole-% default, K/M above 999, "Jun 4"
// dates, "—" for no data. Pure functions; no DOM.

const DASH = '—'; // — no-data / not-measured

/** True for values that should render as "—" (null, undefined, NaN, non-finite). */
export function isBlank(v) {
  return v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v));
}

/** Wrap a formatter so blanks become "—". */
export function orDash(v, fmt) {
  return isBlank(v) ? DASH : fmt(v);
}

/** $1,234 (no cents). */
export function money(v) {
  return orDash(v, (n) => (n < 0 ? '-$' : '$') + Math.round(Math.abs(n)).toLocaleString('en-US'));
}

/** $1,234.56 (two cents) — used for rent/SF and similar. */
export function moneyCents(v) {
  return orDash(v, (n) => (n < 0 ? '-$' : '$') + Math.abs(n).toLocaleString('en-US', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  }));
}

/** Whole-number percent from a ratio (0.073 → "7%"). design.md default. */
export function percent(v) {
  return orDash(v, (n) => Math.round(n * 100) + '%');
}

/** Two-decimal percent from a ratio (0.0730 → "7.30%") — for headline rates. */
export function percent2(v) {
  return orDash(v, (n) => (n * 100).toFixed(2) + '%');
}

/** Two-decimal ratio (1.192 → "1.19") — DSCR, 1% rule. */
export function ratio(v) {
  return orDash(v, (n) => n.toFixed(2));
}

/** Editable percent field value: a stored ratio → the bare number the user
 *  reads/edits (0.0619 → "6.19"), float-representation cruft removed and no "%"
 *  sign (the field renders the sign separately). Blank/non-finite → "" so the
 *  input shows empty rather than "NaN". */
export function percentInput(v) {
  if (v === '' || v == null) return '';
  const n = typeof v === 'number' ? v : parseFloat(v);
  if (!Number.isFinite(n)) return '';
  return String(parseFloat((n * 100).toFixed(6)));
}

/** K/M suffix above 999 (1200 → "1.2K", 2400000 → "2.4M"); else the integer. */
export function compact(v) {
  return orDash(v, (n) => {
    const a = Math.abs(n), sign = n < 0 ? '-' : '';
    if (a >= 1e6) return sign + (a / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (a >= 1e3) return sign + (a / 1e3).toFixed(1).replace(/\.0$/, '') + 'K';
    return sign + Math.round(a).toLocaleString('en-US');
  });
}

/** Compact money for card KPIs: "$1.2K", "$2.4M", "-$400". */
export function moneyCompact(v) {
  return orDash(v, (n) => (n < 0 ? '-$' : '$') + compact(Math.abs(n)));
}

/** Plain integer with thousands separators (2400 → "2,400"). */
export function integer(v) {
  return orDash(v, (n) => Math.round(n).toLocaleString('en-US'));
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** ISO date or Date → "Jun 4"; passes through free-form strings the workbook
 *  stores verbatim (e.g. "Mar 2027") and blanks → "—". */
export function shortDate(v) {
  if (isBlank(v) || v === '') return DASH;
  if (v instanceof Date) return MONTHS[v.getMonth()] + ' ' + v.getDate();
  const s = String(v);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (m) return MONTHS[+m[2] - 1] + ' ' + +m[3];
  return s; // free-form (workbook stores things like "Mar 2027")
}

export { DASH };
