// reconcile.js — pure first-sign-in reconcile decision (D6). No browser deps, so
// it is unit-testable and shared with js/account.js.

/** Of `fixtures`, return only those whose id is absent from `existing`. Seeding
 *  just these means an uploaded or edited copy (same id) is never overwritten,
 *  while a fresh account still gets its samples. */
export function missingFixtures(existing, fixtures) {
  const have = new Set(existing.map((p) => p.id));
  return fixtures.filter((f) => !have.has(f.id));
}
