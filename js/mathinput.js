// Excel-style arithmetic entry for numeric fields. A committed field value may be
// a plain number OR an arithmetic expression — `2+2` commits as `4`, `1300000/2`
// as `650000`. Pure (no DOM), so it unit-tests directly.
//
// Supports + - * / , parentheses, and unary sign, with normal precedence. Returns:
//   { empty: true }          — the field is blank
//   { ok: true, value }      — a valid number or expression (value is finite)
//   { ok: false }            — the text isn't parseable arithmetic
// A tiny recursive-descent parser, deliberately not `eval`, so only arithmetic
// runs — never arbitrary JS.
export function evalMath(raw) {
  const s = String(raw ?? '').trim();
  if (s === '') return { empty: true };
  // Reject anything outside the arithmetic alphabet up front (blocks `eval`-style input).
  if (!/^[-+*/().\d\s]+$/.test(s)) return { ok: false };
  const toks = s.match(/\d+\.?\d*|\.\d+|[-+*/()]/g);
  if (!toks) return { ok: false };

  let i = 0;
  const peek = () => toks[i];
  const eat = () => toks[i++];

  //  expr   := term (('+' | '-') term)*
  //  term   := factor (('*' | '/') factor)*
  //  factor := ('+' | '-') factor | number | '(' expr ')'
  function parseExpr() {
    let v = parseTerm();
    if (v === null) return null;
    while (peek() === '+' || peek() === '-') {
      const op = eat(); const r = parseTerm();
      if (r === null) return null;
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function parseTerm() {
    let v = parseFactor();
    if (v === null) return null;
    while (peek() === '*' || peek() === '/') {
      const op = eat(); const r = parseFactor();
      if (r === null) return null;
      if (op === '/') { if (r === 0) return null; v = v / r; } else v = v * r;
    }
    return v;
  }
  function parseFactor() {
    const t = peek();
    if (t === '+') { eat(); return parseFactor(); }
    if (t === '-') { eat(); const r = parseFactor(); return r === null ? null : -r; }
    if (t === '(') { eat(); const v = parseExpr(); if (v === null || eat() !== ')') return null; return v; }
    if (t !== undefined && /^[\d.]/.test(t)) { const n = Number(eat()); return Number.isFinite(n) ? n : null; }
    return null;
  }

  const v = parseExpr();
  if (v === null || i !== toks.length || !Number.isFinite(v)) return { ok: false };
  // Snap away binary float noise (0.1 + 0.2 → 0.3) without harming real precision.
  return { ok: true, value: Math.round(v * 1e9) / 1e9 };
}

// DOM-layer convenience: turn a committed raw string into the number to store and
// the text to show back in the field (Excel replaces the expression with its
// result). A blank field is 0; unparseable text falls back to a lenient number
// read, then 0 — never NaN.
export function commitNumericInput(raw) {
  const r = evalMath(raw);
  if (r.empty) return { value: 0, display: '' };
  if (r.ok) return { value: r.value, display: String(r.value) };
  const f = parseFloat(raw);
  if (Number.isFinite(f)) return { value: f, display: String(f) };
  return { value: 0, display: '' };
}
