import { test } from 'node:test';
import assert from 'node:assert/strict';
import { safeImageUrl, parsePhotoUrls, normalizeMedia } from '../js/media.js';

test('safeImageUrl accepts http/https, rejects everything else', () => {
  assert.equal(safeImageUrl('https://crexi.com/images/a.JPG'), 'https://crexi.com/images/a.JPG');
  assert.equal(safeImageUrl('http://x.com/b.png'), 'http://x.com/b.png');
  assert.equal(safeImageUrl('  https://x.com/c.jpg  '), 'https://x.com/c.jpg'); // trims
  assert.equal(safeImageUrl('javascript:alert(1)'), null);   // no script URLs
  assert.equal(safeImageUrl('data:image/png;base64,AAAA'), null);
  assert.equal(safeImageUrl('/relative/path.jpg'), null);
  assert.equal(safeImageUrl('not a url'), null);
  assert.equal(safeImageUrl(''), null);
  assert.equal(safeImageUrl(null), null);
});

test('parsePhotoUrls splits on newline/comma/space, validates, dedupes, preserves order', () => {
  const text = 'https://a.com/1.jpg\nhttps://a.com/2.jpg, https://a.com/1.jpg\njavascript:bad\nfoo';
  assert.deepEqual(parsePhotoUrls(text), ['https://a.com/1.jpg', 'https://a.com/2.jpg']);
  assert.deepEqual(parsePhotoUrls(''), []);
  assert.deepEqual(parsePhotoUrls('   '), []);
});

test('normalizeMedia coerces legacy shapes and drops invalid entries', () => {
  assert.deepEqual(normalizeMedia(undefined), { photos: [] });
  assert.deepEqual(normalizeMedia({}), { photos: [] });
  assert.deepEqual(normalizeMedia({ photos: 'nope' }), { photos: [] });
  // bare strings + legacy {url} objects both accepted; junk dropped; deduped
  assert.deepEqual(
    normalizeMedia({ photos: ['https://a.com/1.jpg', { url: 'https://a.com/2.jpg' }, 'javascript:x', 'https://a.com/1.jpg'] }),
    { photos: ['https://a.com/1.jpg', 'https://a.com/2.jpg'] },
  );
});
