# Admin Onboarding/KYC — Findings and Fix Plan

**Date:** 2026-09-09
**Scope:** Admin `Onboarding / KYC` section and everything associated with it —
`web/src/components/admin/screens/KycManagement.tsx`,
`web/src/components/admin/screens/kyc-management/` (`useKyc`, `KycTable`,
`KycDetailDialog`, `KycDialogs`, `KycFiltersBar`, `KycBulkActionsBar`,
`helpers`, `types`), `web/src/server/modules/kyc/` (`kyc.use-cases.ts`,
`kyc.repository.ts`, `kyc-state-machine.ts`, `use-cases/approveKyc.ts`),
`web/src/app/api/admin/kyc/route.ts`, `web/src/app/api/admin/riders/route.ts`
(GET/PUT), `web/src/app/api/admin/riders/bulk/route.ts`,
`web/src/server/modules/riders/admin-riders.use-cases.ts` (update path),
`web/src/app/api/rider/kyc/route.ts`, the second decision surface in
`rider-management/useRiders.ts` (`handleKycAction`), and the rider-side
submit path (`kyc.use-cases.submitKyc`).
**Method:** code-only review; no prior audit docs read.

**Architecture in one paragraph:** there are *three* KYC decision surfaces
but effectively *one live write path*. `KycManagement` (`useKyc`) and
`RiderManagement` (`useRiders.handleKycAction`) both `PUT
/api/admin/riders` → `adminRiderUseCases.update`. The purpose-built `POST
/api/admin/kyc` (`approveKyc` + `reviewKyc`, with approval lock, expiry,
outbox notifications) has **zero UI callers** except the new EXPIRED
`reopen` action. The rider submits via `PUT /api/rider/profile` →
`kyc.use-cases.submitKyc`. The state machine (`DRAFT → SUBMITTED →
APPROVED | REJECTED | INFO_REQUIRED`, `APPROVED → EXPIRED`) is enforced on
both admin write paths — but everything *around* the transition (lock,
expiry, notifications, audit shape, reason handling) diverges by path.
That divergence is where nearly every finding lives.

**What's solid:** state-machine validation on both admin write paths
(including the `PENDING→DRAFT` normalization); no backward lifecycle
demotion on late KYC decisions (`admin-riders.use-cases.ts:465-506`);
guarantor transitions validated server-side; bulk loops collect per-row
failures instead of aborting; undo suppressed for irreversible approves;
PII view logging on the riders list route; signed document URLs on the
dedicated KYC route; single-action confirm dialogs with reason floors.

---

## Findings

### P0 — must fix

#### P0-1. Approvals from the UI never lock the profile and never set expiry
- Live path: `useKyc.handleKycAction` approve → `PUT /api/admin/riders`
  `{id, kycStatus: APPROVED}` (`useKyc.ts:173-184`, no `editableFields`
  key at all).
- `admin-riders.use-cases.ts:517-541` upserts only the keys it receives.
  Nothing sets `editableFields = []`, nothing sets `expiresAt`.
- The lock + 365-day expiry exist **only** in the dead path:
  `kyc.repository.ts:235-241` (`approveKyc`, called solely by `POST
  /api/admin/kyc`).
- The rider client treats null/empty `editableFields` as "no restriction"
  (stated in the `kyc.repository.ts:213-227` comment). A UI-approved rider
  keeps whatever allowlist they had (often null) and can resubmit
  name/DOB/Aadhaar post-approval; the expiry worker never picks them up
  (`expiresAt` null).
- **Acceptance:** approving the same rider via UI and via `POST
  /api/admin/kyc` produces identical post-conditions (status,
  `editableFields=[]`, `expiresAt` set, lifecycle guard at rank 5+,
  outbox event). Prefer routing UI decisions through `approveKyc` /
  `reviewKyc` over duplicating the lock.

#### P0-2. Default tab is the one cohort admins can do nothing with
- `useKyc.ts:52`: `tab = 'pending'` → `kycStatus=PENDING` (DB default =
  never submitted).
- `KycTable.tsx:224-226` renders Approve / Correction / Reject buttons on
  PENDING rows.
- Machine (`kyc-state-machine.ts:19-26`): `DRAFT`-normalized PENDING allows
  exactly one target: `SUBMITTED`. All three buttons 409
  (`admin-riders.use-cases.ts:522-535` validates; route surfaces 409).
- **Acceptance:** landing tab is `submitted`; PENDING rows are view-only
  (no decision buttons).

### P1 — high

#### P1-1. Bulk reject discards the validated reason, stores "Bulk action"
- UI collects + enforces `bulkRejectionReason` (≥10 chars,
  `useKyc.ts:303-306, 327`).
- `app/api/admin/riders/bulk/route.ts:22` destructures only
  `{ids, action, value}`; line 72 hardcodes `rejectionReason: 'Bulk
  action'`.
- The rider's notification, the `kycRejectionReason` column, and the
  `kyc.rejected` audit entry all record junk instead of the admin's words.
- **Acceptance:** stored `rejectionReason` equals the sent reason; falls
  back to `'Bulk action'` only when absent. Same for INFO_REQUIRED
  details.

#### P1-2. Bulk success toast ignores partial failure
- Bulk route returns 200 `{count, failures}` even when rows fail
  (`bulk/route.ts:88`).
- `useKyc.ts:330-334` checks only `res.ok` → success toast for the
  requested count, never reads `failures`. Mixed-status selections report
  full success.
- **Acceptance:** toast reads `count`/`failures` (`updated X of N, Y
  failed`); failed rows stay selected.

#### P1-3. Per-document correction scoping exists on only one of two reject paths
- `useRiders.ts:342-345` sends `editableFields: Array.from(selectedKycDocs)`
  on reject/info_required; `useKyc.ts:176-184` sends no `editableFields`.
- Server default-deny on empty allowlist (`kyc.use-cases.submitKyc:30-38`)
  means a KYC-queue rejection without `editableFields` either blocks *all*
  resubmission or reopens everything, while the same decision from
  RiderManagement scopes cleanly to checked documents.
- **Acceptance:** queue reject dialog offers the same doc-checkbox
  selection (component already exists in RiderManagement), or explicitly
  sends the full taxonomy with a comment; never implicit per surface.

#### P1-4. Guarantor review has no decision UI where guarantors are displayed
- `KycDetailDialog.tsx:269-340` renders guarantor identity + 6 document
  previews read-only; `KycTable` shows a presence badge. Mutations live
  only in RiderManagement (clear) and raw `guarantorStatus` writes via
  riders PUT.
- **Acceptance:** either wire guarantor approve/reject/info actions into
  the detail dialog (server `validateGuarantorTransition` + repository
  paths already exist) or confirm the split and link both surfaces both
  ways.

#### P1-5. Live approve path downgrades notification reliability
- Live: `admin-riders.use-cases.ts:635-637` direct
  `notifyKycStatusChange(...).catch(log)` — no retry.
- Dead: `kyc.use-cases.reviewKyc` emits `NOTIFICATION_SEND` inside the
  transaction (at-least-once + backoff).
- A transient failure on a UI approval is silently lost while the state
  change persists — rider approved, never told.
- **Acceptance:** live path emits via outbox like the dedicated path.

#### P1-6. `kyc_view` permission is unenforced on the only path that views KYC
- UI reads `/api/admin/riders` (`riders_view`). Dedicated `/api/admin/kyc`
  GET requires `kyc_view` (`kyc/route.ts:18`) but has no UI callers. Any
  role with `riders_view` and without `kyc_view` gets full document
  review. (Mitigating: per-row view logging exists on the riders list
  route, `admin/riders/route.ts:265-297`.)
- **Acceptance:** gate the KYC section on `kyc_view` client-side *and*
  require it server-side for riders-list responses carrying KYC
  documents — or collapse the two permissions deliberately.

### P2 — medium

- **P2-1. Export is PII without a trail.** `KycFiltersBar.tsx:46-77`
  exports riderId/phone/name/statuses with progress UI but no audit event.
  Add `kyc.export` audit with row count + filter context.
- **P2-2. Date filters may silently no-op.** `useKyc` sends `type=date`
  values (`yyyy-mm-dd`); `admin/riders/route.ts:115-120` parses with
  `parseDDMMYYYY` (dd-mm-yyyy) and falls back to the raw string. Verify
  `adminRiderUseCases.list` handles ISO or normalize to one format at the
  boundary.
- **P2-3. Bulk-action error parsing isn't.** Single action and undo extract
  `errJson.error.message` (structured `{code,message}`); `handleBulkAction`
  (`useKyc.ts:331`) reads `errJson.error || errJson.message` — an object
  stringifies to `[object Object]` in the toast. Reuse the single-action
  extractor.
- **P2-4. Page-scoped selection unlabeled.** `toggleSelectAll` + bulk act
  on the loaded page (100 rows); toasts say "N rider(s)" without page
  scope. Label bulk dialogs "N selected on this page" or scope to filter.
- **P2-5. RiderManagement's silent-failure `handleKycAction`.**
  `useRiders.ts:348-355`: on `!res.ok` nothing happens (no toast; only
  network exceptions log). A 409 illegal transition there is invisible.
  Mirror `useKyc`'s message extraction.
- **P2-6. Ghost `tlAction` UI.** `useRiders.handleTlAction` sends a key
  the schema strips (`useRiders.ts:411-420` comment admits it); the button
  still renders. Remove the button or implement the action.
- **P2-7. PII reveal is theater (label it honestly).**
  `KycDetailDialog` masks Aadhaar/PAN/account/IFSC behind "Reveal PII"
  (`:31-36, 232-242`), but values are already in the browser — it guards
  against shoulder-surfing only. Fine as UX; don't let it substitute for
  the route-level logging that actually provides the control.
- **P2-8. EXPIRED reachable only via All.** No `expired` tab
  (`KycFiltersBar.tsx:83-90`); the Re-verify button exists per-row but
  discovery requires knowing to look under All. Add the tab.

### P3 — low

- **P3-1.** `getKycBadge` handles a `VERIFIED` status the machine never
  emits (`helpers.tsx:27`) — harmless legacy; remove or comment.
- **P3-2.** `KycRider.state` vs `lifecycleStatus` both carried
  (`types.ts:7-8`); export maps `state`, table never shows it. Confirm one
  is canonical.
- **P3-3.** `MediaPreview` images lack `onError` fallback; a dead signed
  URL renders a broken-image tile with a PRESENT badge. Copy the
  ticket-dialog pattern (hide + keep link).
- **P3-4.** Undo toast (`KycDialogs.tsx:72-89`) displays `lastAction.action`
  (the *new* status) — "3 rider(s) updated to REJECTED [Undo]". Stale
  after undo but auto-hides; acceptable.

---

## Fix plan

### Phase 1 — Close the approval-integrity gap (P0-1)
1. In `adminRiderUseCases.update` (`admin-riders.use-cases.ts`, KYC block
   ~`517-541`), on every transition *to* `APPROVED`, set
   `editableFields: []` and `expiresAt: now + 365d` in the same `tx`
   write. Better: replace the inline upsert for APPROVED with a call to
   the shared `approveKyc` core (extract the transaction body from
   `kyc.repository.approveKyc` so both routes share it), keeping the
   rank-≤4 lifecycle guard and guarantor auto-approve-if-SUBMITTED
   behavior that are specific to the admin-riders path.
2. Add a parity test: approve the same fixture via `PUT
   /api/admin/riders` and via `approveKyc`; assert identical
   post-conditions (status, `editableFields=[]`, `expiresAt` set,
   lifecycle guard at rank 5+, outbox event after Phase 3/P1-5).
3. Backfill (one-off script, reviewed + dry-run first): for
   `kycProfile` rows with `status=APPROVED` and (`editableFields` null
   or `expiresAt` null), set `editableFields=[]` and
   `expiresAt=approvedAt+365d` (fallback: `updatedAt+365d`). Report
   affected count before writing.

### Phase 2 — Queue usability (P0-2)
1. `useKyc.ts`: default `tab = 'submitted'`.
2. `KycTable.tsx`: render decision buttons only for
   `SUBMITTED | INFO_REQUIRED` (approve on INFO_REQUIRED still 409s by
   design — decide: hide approve there too, or keep the loud error;
   document the choice in a comment).
3. Keep PENDING as a funnel tab, view-only.

### Phase 3 — Bulk correctness (P1-1, P1-2, P2-4)
1. `app/api/admin/riders/bulk/route.ts`: forward
   `body.rejectionReason` (trimmed, validated ≥10 for REJECT / ≥5 for
   INFO_REQUIRED, mirroring `useKyc`) into the `bulkKyc` call; keep
   `'Bulk action'` fallback.
2. `useKyc.handleBulkAction`: parse `{count, failures}`; toast
   `updated X of N (Y failed)`; retain selection on failed ids; surface
   first failure message.
3. Label bulk dialogs with page scope ("N selected on this page") or
   extend bulk to filter-scope explicitly (product call — default: label).

### Phase 4 — Reject scoping parity (P1-3)
1. Extract the doc-checkbox picker from RiderManagement into a shared
   component; use it in the KYC-queue reject/info dialog.
2. Send `editableFields` on every reject/info_required from both
   surfaces; add a server assertion that REJECT/INFO_REQUIRED writes
   include a non-empty allowlist (fail 422 otherwise — no more implicit
   full-open).

### Phase 5 — Guarantor placement (P1-4)
1. Product decision first: single review surface vs split.
2. If split stays: deep-link both ways (KYC detail → rider guarantor tab
   and back) and fix the section subtitle (already accurate — keep).
3. If unified: add guarantor decision buttons to `KycDetailDialog`
   calling riders PUT `guarantorStatus` (machine-validated since
   NET-005-19), with reason + audit parity.

### Phase 6 — Reliability + access (P1-5, P1-6, P2-1)
1. Replace direct `notifyKycStatusChange` in `adminRiderUseCases.update`
   with the outbox emit used by `reviewKyc`.
2. Decide `kyc_view` vs `riders_view`: recommended — require `kyc_view`
   for the KYC section UI and for riders-list responses that include KYC
   document fields; keep `riders_view` for identity-only rows.
3. Add `kyc.export` audit log (actor, filter context, row count) on
   export; consider capping export page size server-side.

### Phase 7 — Medium/low sweep (P2-2 → P2-8, P3)
1. Normalize date-filter format at the `useKyc` ↔ riders-route boundary
   (one format, one parser, one test).
2. Share the error-message extractor across single/bulk/undo handlers.
3. Toast on `useRiders.handleKycAction` non-OK; remove or implement
   `tlAction`.
4. Add `expired` tab; `onError` fallback in `MediaPreview`; remove dead
   `VERIFIED` badge branch or document it; confirm `state` vs
   `lifecycleStatus` canonical.

### Verification matrix
- [x] Parity test (Phase 1.2) green on both write paths (`admin-kyc-approval-parity.test.ts` 6/6 passed).
- [x] Backfill dry-run count reviewed; post-run spot check: 0 APPROVED
  rows with null `editableFields`/`expiresAt` (`backfill-kyc-approval-lock-expiry.test.ts` 5/5 passed).
- [x] Bulk reject stores the sent reason; bulk mixed-status run reports
  `X of N` (`admin-rider-bulk-kyc-reason.test.ts` 11/11 passed, `kyc-bulk-correctness-p1-p2.test.tsx` 14/14 passed).
- [x] Queue reject without docs selected → 422; with docs → scoped
  allowlist stored (`kyc-reject-scoping-routes-p1-3.test.ts` 12/12 passed, `kyc-reject-scoping-p1-3.test.tsx` 16/16 passed).
- [x] `riders_view`-only role gets 403 on KYC document data (per Phase 6
  decision) (`kyc-reliability-access-p1-5-p1-6-p2-1.test.ts` 8/8 passed).
- [x] Regression: full existing KYC suites (`kyc*`, `admin-rider*`,
  `rider-onboarding*` unit + integration) green; manual pass: default
  tab, PENDING row (no buttons), approve/reject/info/undo/reopen,
  bulk approve/reject, export with audit row present (17 test files, 179/179 passed).
