// dashboard-media.js — the Property Info card header's two buttons and the three
// overlays they open: the photo gallery, its full-size lightbox, and the
// Listing-details form.
//
// Split out of dashboard.js, which had reached 905 lines because almost
// everything lived inside one renderDashboard() closure. This block was the one
// part closing over nothing but `prop` and `onEdit`, so moving it NARROWS the
// seam rather than widening it: dashboard.js previously held eight interrelated
// bindings here (two buttons, two label refreshers, three openers and
// LISTING_FIELDS) and now makes a single call and places two buttons. Everything
// else is module-private.
//
// Both surfaces are modals rather than inline fields because the dashboard must
// stay one-screen (S11) and touch inputs are 44px tall; the gallery/lightbox
// layering and every dismissal path are S30/S40's subject.

import { el, clear, toast, mountOverlay } from '../dom.js';
import { safeImageUrl, parsePhotoUrls } from '../media.js';

/** Build the Photos (▦ N) and Listing-details (🏷) buttons, each fully wired to
 *  its overlay. `onEdit` is the dashboard's commit + auto-save hook, called only
 *  when an overlay actually changed something. */
export function mediaButtons({ prop, onEdit }) {
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
  renderThumbs();
  // Ignore Escape while the full-size lightbox is up — that layer owns the key,
  // so one Escape closes the lightbox only, not the gallery beneath it.
  const close = mountOverlay(overlay, { escapeWhen: () => !document.querySelector('.lightbox') });
  closeBtn.addEventListener('click', close);
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
  // An explicit close control, not only Escape + a backdrop tap. Both of those
  // keep working, but neither is DISCOVERABLE on a touch screen, where there is
  // no keyboard and the backdrop looks like part of the photo — design.md
  // -> Cross-platform: every action works by tap, click AND keyboard.
  const shut = el('button', { class: 'lightbox__close', type: 'button', 'aria-label': 'Close photo viewer', title: 'Close', text: '\u00d7' });
  const box = el('div', { class: 'lightbox', role: 'dialog', 'aria-modal': 'true', 'aria-label': 'Photo viewer' }, [shut, prev, img, next, cap]);
  paint();
  const close = mountOverlay(box, {
    onKey: (e) => { if (e.key === 'ArrowLeft') step(-1); else if (e.key === 'ArrowRight') step(1); },
  });
  shut.addEventListener('click', (e) => { e.stopPropagation(); close(); });
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
  const close = mountOverlay(overlay, {
    onClose: () => { refreshListingBtn(); if (dirty) onEdit(); },   // commit + auto-save once
  });
  closeBtn.addEventListener('click', close);
  fieldEls[0].querySelector('input').focus();
}

  return { photosBtn, listingBtn };
}
