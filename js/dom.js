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

/** A toast (design.md §18), the house one: shown at the bottom, one at a time;
 *  success fades by itself, an error is red, announced, and stays longer. */
export function toast(message, { error = false } = {}) {
  return window.House.toast(message, { error });
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

/** The house dialog (design.md §10): a native <dialog class="dialog"> with its
 *  title and × in the header, a body and a right-aligned footer, opened through
 *  House.dialog, which owns focus, Esc, the backdrop press, the busy and
 *  unsaved-typing rules and the return to the opener. Any button marked
 *  data-dialog-close (Cancel, Not now) closes it. A dialog with no footer (the
 *  photo viewer) is closed by × alone. The dialog takes itself out of the page
 *  once closed; `done` resolves then, with the value close() was given. */
export function houseDialog({ title, className = '', body = [], footer = [], actions = [], opener, initialFocus }) {
  const xBtn = el('button', { class: 'btn btn-icon', type: 'button', 'aria-label': 'Close', title: 'Close', 'data-dialog-close': '' }, [window.House.icon('x')]);
  const box = el('dialog', { class: 'dialog' + (className ? ' ' + className : '') }, [
    el('div', { class: 'dialog-header' }, [
      el('h2', { class: 'dialog-title', text: title }),
      // `actions` sit just before × (the photo viewer's Previous and Next).
      actions.length ? el('div', { class: 'dialog-actions' }, [...actions, xBtn]) : xBtn,
    ]),
    el('div', { class: 'dialog-body' }, body),
    ...(footer.length ? [el('div', { class: 'dialog-footer' }, footer)] : []),
  ]);
  document.body.appendChild(box);
  const done = window.House.dialog.open(box, { opener, initialFocus }).then((value) => { box.remove(); return value; });
  return {
    box, done,
    close: (value) => window.House.dialog.close(box, value),
    setBusy: (on) => window.House.dialog.setBusy(box, on),
    setDirty: (on) => window.House.dialog.setDirty(box, on),
  };
}

/** A labelled field (design.md §12): the label above its control, always shown. */
export function field(label, control, extra) {
  const id = control.id || ('f-' + Math.random().toString(36).slice(2, 9));
  control.id = id;
  const after = extra ? (Array.isArray(extra) ? extra : [extra]) : [];
  return el('div', { class: 'field' }, [el('label', { class: 'label', for: id }, [label, ...after]), control]);
}
