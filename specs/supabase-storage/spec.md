# Feature Spec — Permanent per-user storage (cloud accounts)

**Feature slug:** `supabase-storage`
**Status:** phase 1 (specify) — WHAT & WHY only; no tech/how (that's `plan.md`).

## Why
Today all property data lives in one browser's local storage. Clear the browser,
switch devices, or use a different browser and the deals are gone. Users want
their portfolio to **persist to them, not to a device** — sign in and see the
same deals everywhere — while keeping the app's local-first feel (fast, works
offline, no mandatory login just to look around).

## User stories
- **US1 — Keep my deals.** As an investor, I sign in with my email so my saved
  properties are stored to my account and survive a browser wipe.
- **US2 — Same deals everywhere.** Signed in on my laptop and my phone, I see the
  same portfolio; a change on one shows up on the other.
- **US3 — Only mine.** My deals are private to me; no other user can see or change
  them, and I never see theirs.
- **US4 — Still works offline / logged out.** Without signing in (or with no
  network) the app behaves exactly as it does today — local-only — and nothing I
  do is lost.
- **US5 — Don't lose my current work.** When I sign in for the first time, the
  properties I already created locally aren't silently discarded.
- **US6 — Know where I stand.** I can tell at a glance whether I'm signed in (and
  as whom), and can sign out.

## Functional requirements  (each testable)
- **FR1** A user can request a sign-in link by entering their email; following the
  emailed link returns them to the app in a signed-in session.
- **FR2** A signed-in user can sign out, returning to logged-out (local) mode.
- **FR3** While signed in, creating/editing/deleting a property persists to the
  user's account — visible after a full reload, and on a different browser/device
  after signing in as the same user.
- **FR4** A signed-in user can only ever read or write their **own** properties;
  another account's data is never returned or mutable (isolation — see
  constitution `data.md`).
- **FR5** Logged out, the entire app works against local storage exactly as today,
  including every existing behavior (S5–S22) and JSON export/import.
- **FR6** While signed in but offline, edits are not lost: they persist locally and
  reach the account once connectivity returns.
- **FR7** The views are unchanged: the storage swap happens behind the existing
  repository interface (`list/get/save/remove/export/import`); no view rewires its
  data access.
- **FR8** On first sign-in, the user's existing local properties are reconciled
  with the (empty) account per an explicit, non-destructive policy
  `[NEEDS CLARIFICATION: Q1]`.
- **FR9** The signed-in identity (or a sign-in affordance) is visible in the app
  chrome and fits the established Banker Navy look (`design.md`).
- **FR10** The calc engine and fidelity fixture are untouched; all existing S5–S22
  tests continue to pass unchanged.

## Success criteria  (measurable)
- **SC1** A property saved while signed in appears after a full reload in a
  *different* browser profile signed in as the same user (cross-device persistence).
- **SC2** Two different accounts using the app never see each other's properties.
- **SC3** With the network blocked, a signed-in user can still edit a property;
  after reconnect, that change is present in the account (survives a reload on
  another device).
- **SC4** Logged-out behavior is identical to today — the full S5–S22 suite passes
  with no account.
- **SC5** No secret/privileged key is present in any shipped client asset; only the
  public project URL + publishable key, and data is reachable only through
  per-user RLS policies.
- **SC6** First sign-in never destroys existing local work (per the Q1 policy).

## Non-goals  (explicit)
- Password, OAuth, or social login — **magic-link email only** in v1.
- Real-time collaboration, sharing, or team/shared portfolios.
- Any server-side scheduled job, cron, or backend compute.
- Introducing a build step or moving off GitHub Pages (stays static tier).
- Changing the calc engine, KPIs, or the workbook model.

## Open questions  `[NEEDS CLARIFICATION]`  (resolve in `clarify`)
- **Q1 — First-sign-in reconciliation.** When a user with existing *local*
  properties signs in to a fresh account, do we: (a) offer to upload the local
  set to the account, (b) leave local alone and start the account empty, or
  (c) auto-merge? And does this include the built-in sample / demo deals or only
  user-created ones?
- **Q2 — Samples in the cloud.** Do the built-in **715 Plumas sample** and the
  three **demo deals** live per-account in the cloud, or remain local-only
  first-run fixtures (never persisted to an account)?
- **Q3 — Sync conflict policy.** If the *same* property was edited in two places
  (e.g. offline on two devices), how do we resolve — last-write-wins by
  `updatedAt`, or surface a conflict?
- **Q4 — Sign-out cache.** On sign-out, keep the local cache in place (so the
  device still shows the last state) or clear it (cleaner but loses offline view)?
- **Q5 — Sign-in optional?** Assumed **optional** — the app is fully usable logged
  out (today's behavior), sign-in is an upgrade. Confirm.
- **Q6 — Session longevity.** A magic-link session stays signed in until explicit
  sign-out (persistent). Acceptable, or cap it?

## Constitution constraints (binding — cited)
- **`data.md`** — RLS **always on**; each user isolated to their own rows; the
  service-role/secret key **never** ships to the browser; only the public
  publishable key + URL in client code. (FR4, SC5.)
- **`global.md`** — static tier, no build; all dynamic text via `textContent`;
  cross-platform/responsive (the auth UI must reflow on phone).
- **`test.md`** — new behavior gets test coverage; existing suite stays green (FR10).
- **`design.md`** — the sign-in / account UI uses the project's tokens/components,
  not a bolt-on style (FR9).
