// dom.js — tiny element builder. All text goes through textContent (never
// innerHTML with data), satisfying global.md's XSS rule by construction.

/** el('div', {class:'x', onclick:fn}, [childNodes|strings]) → HTMLElement.
 *  String children become text nodes. `html` is intentionally NOT supported. */
export function el(tag, attrs = {}, children = []) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === null || v === undefined || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'text') node.textContent = v;
    else if (k === 'html') throw new Error('el(): html not allowed — use text');
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else if (k === 'dataset') Object.assign(node.dataset, v);
    else if (v === true) node.setAttribute(k, '');
    else node.setAttribute(k, v);
  }
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) {
    if (c === null || c === undefined || c === false) continue;
    node.appendChild(typeof c === 'string' || typeof c === 'number'
      ? document.createTextNode(String(c)) : c);
  }
  return node;
}

/** Clear a node's children. */
export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }

/** Replace a node's children with new ones. */
export function render(node, children) {
  clear(node);
  const kids = Array.isArray(children) ? children : [children];
  for (const c of kids) if (c) node.appendChild(c);
}

/** Transient toast/notice at the top of the viewport. */
export function toast(message, kind = 'info') {
  const t = el('div', { class: `toast toast--${kind}`, role: 'status', text: message });
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 3200);
}

/** Click-and-drag horizontal panning for an overflow-x:auto container — a
 *  reliable way to scroll a wide table when the native scrollbar auto-hides
 *  (macOS-style overlay scrollbars fade out at rest, independent of CSS).
 *  Mouse only (pointerType 'mouse'); touch/trackpad keep native scroll/swipe.
 *  Uses pointer capture so drag tracking is self-contained per element — no
 *  window-level listeners to leak across re-renders. A drag beyond a small
 *  threshold swallows the next click so it doesn't also fire (e.g. a sort
 *  header) underneath the pointer. */
export function dragScroll(el) {
  let pointerId = null, startX = 0, startScrollLeft = 0, dragging = false, moved = false;
  el.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    dragging = true; moved = false; pointerId = e.pointerId;
    startX = e.clientX; startScrollLeft = el.scrollLeft;
    // Capture is deferred to the FIRST real movement (see pointermove) — capturing
    // immediately on pointerdown retargets pointerup away from whatever was under
    // the cursor (a sort header, a Restore/Delete button), silently breaking its
    // click. A plain click never crosses the threshold, so it's never captured
    // and reaches its target exactly as if this listener didn't exist.
  });
  el.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - startX;
    if (!moved && Math.abs(dx) > 4) { moved = true; el.setPointerCapture(pointerId); el.classList.add('is-dragging'); }
    if (moved) el.scrollLeft = startScrollLeft - dx;
  });
  const end = () => {
    if (!dragging) return;
    dragging = false;
    el.classList.remove('is-dragging');
    if (moved) el.addEventListener('click', (ev) => { ev.stopPropagation(); ev.preventDefault(); }, { capture: true, once: true });
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
}

/** Mount an overlay and own its whole dismissal lifecycle; returns `close`.
 *
 *  Five overlays each hand-rolled the same four things — Escape, a backdrop
 *  click, removing the node, and unregistering the keydown listener — and that
 *  duplication is exactly why their dismissal paths had drifted apart: two had no
 *  close control, one guarded Escape differently, and nothing tested the backdrop
 *  (S40, Codex #116). One implementation means one set of paths to prove.
 *
 *  `root` is the element the caller built, and is also the backdrop: a click
 *  closes only when it lands on `root` itself, never on a child, so clicking
 *  inside the panel does nothing. The caller wires its own close control to the
 *  returned function — presence, label and position are per-overlay.
 *    onKey(e, close)  extra keys beyond Escape (the lightbox's arrows).
 *    escapeWhen()     veto Escape — the gallery ignores it while the lightbox,
 *                     its upper layer, owns the key.
 *    onClose()        runs after removal (commit edits, refresh a button).
 */
export function mountOverlay(root, { onKey, escapeWhen, onClose } = {}) {
  const close = () => {
    document.removeEventListener('keydown', key);
    root.remove();
    if (onClose) onClose();
  };
  const key = (e) => {
    if (e.key === 'Escape') { if (!escapeWhen || escapeWhen()) close(); return; }
    if (onKey) onKey(e, close);
  };
  root.addEventListener('click', (e) => { if (e.target === root) close(); });
  document.addEventListener('keydown', key);
  document.body.appendChild(root);
  return close;
}
