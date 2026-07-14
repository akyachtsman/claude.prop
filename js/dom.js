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
