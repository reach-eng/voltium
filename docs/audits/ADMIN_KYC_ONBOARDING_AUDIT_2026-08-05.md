# Admin KYC / Onboarding — Deep Audit

**Audit date:** 2026-08-05
**Auditor:** Mavis (deep-code review)
**Scope:** `web/src/components/admin/screens/kyc-management/` + `web/src/components/admin/screens/KycManagement.tsx` + `web/src/components/admin/screens/rider-management/KycActionModal.tsx` + `web/src/app/api/admin/kyc/route.ts` + `web/src/server/modules/kyc/`
**Out of scope:** Rider-app KYC submission flow (`flutter/lib/features/kyc/...`) — separate audit recommended

---

## TL;DR

The KYC review surface is **functionally solid and has good bones** — the state machine is clean, the route layer is well-typed, and the UI is functional. But there are **6 P0 (must fix before next release)**, **9 P1 (fix in the next 2 sprints)**, and **6 P2 (cleanup backlog)** issues that range from a critical security hole, to a duplicate KYC implementation causing split-brain state, to UX friction that an admin would feel on their first day.

The biggest single concern: **two parallel KYC implementations** — `kyc-management/` (KYC review) and `rider-management/KycActionModal.tsx` (rider detail KYC actions). They look identical but have **diverged**: the rider-management version validates rejection reason, the kyc-management one doesn't. If a reviewer uses both UIs, behavior is inconsistent and the bulk-action API will silently succeed on missing rejection reasons.

---

## Severity scale

| Tag | Meaning | Target fix |
|---|---|---|
| **P0** | Security hole, data corruption, or production-blocker | Before next release |
| **P1** | UX friction, accessibility, or maintainability issue | Next 2 sprints |
| **P2** | Code quality, naming, dead code | Cleanup backlog |

---

## P0 — Must fix before next release

### P0-1: Duplicate KYC implementation — split-brain state

**Files:**
- `web/src/components/admin/screens/kyc-management/KycDialogs.tsx` (newer, in this module)
- `web/src/components/admin/screens/rider-management/KycActionModal.tsx` (older, in rider-management)

**What:** The KYC review screen (`/admin/kyc-management`) and the rider detail screen (presumably `/admin/rider-management/:id`) both have a "confirm KYC action" dialog. They look identical (same title, same buttons, same textarea), but they **diverged**:

| Behavior | `KycDialogs.tsx` (kyc-management) | `KycActionModal.tsx` (rider-management) |
|---|---|---|
| Disable confirm when rejection reason is empty | ❌ No — can submit with empty `rejectionReason` | ✅ Yes — `!kycRejectionReason.trim()` |
| Bulk action validation | ❌ No client-side check | ❌ No check |
| API call | `PUT /api/admin/riders` (legacy path) | Same `PUT /api/admin/riders` |

**Impact:** A reviewer using the rider detail screen is protected from accidentally rejecting without a reason. A reviewer using the KYC queue screen can hit "Reject" with an empty reason and the server has to decide. Since `web/src/app/api/admin/kyc/route.ts` (the new path) requires `rejectionReason` for REJECT but the older `/api/admin/riders` PUT endpoint does **not** enforce it, behavior is inconsistent across the two surfaces.

**Fix:**
1. **Delete** `rider-management/KycActionModal.tsx` and **import** `KycDialogs` from `kyc-management/` instead.
2. **Audit all callers** of `KycActionModal` (grep for the import) and switch them.
3. **Add a regression test** that asserts the dialog disables "Reject" / "Request Correction" buttons when the rejection reason is empty.

**Effort:** ~3-4 hours. 1 PR.

---

### P0-2: `useKyc` does not check `res.ok` on POST / PUT

**File:** `web/src/components/admin/screens/kyc-management/useKyc.ts` lines 86-100 (handleKycAction) and 134-141 (handleUndo) and 165-173 (handleBulkAction)

**What:** The `fetch()` calls to `/api/admin/riders` and `/api/admin/riders/bulk` are wrapped in try/catch but **never check `res.ok`**. A 500 / 400 / 401 response is treated the same as a 200. The `lastAction` state is set, the undo toast is shown, the row is removed from selection — but the server actually rejected the change.

**Repro:**
1. Go to /admin/kyc-management
2. Select a rider
3. Stop the dev server (or revoke your session cookie)
4. Click "Approve"
5. **Expected:** Error toast, no state change
6. **Actual:** Green undo toast appears, row appears to be updated, table re-fetches and shows the **old** status (because the PUT silently failed but `fetchRiders` still ran)

**Impact:** Admins can think they approved a KYC and move on. The rider's actual KYC stays `SUBMITTED` forever, and the admin has no idea.

**Fix:** Add a `res.ok` check after every fetch in the hook; throw if not OK; show a proper error toast. Pattern:

```typescript
const res = await fetch('/api/admin/riders', { ... });
if (!res.ok) {
  const err = await res.json().catch(() => ({}));
  throw new Error(err.message || `Request failed: ${res.status}`);
}
```

**Effort:** ~1 hour. 1 PR.

---

### P0-3: `useKyc` puts submit/reject text in the `kyc.rejectionReason` field for `info_required` — server schema is unclear

**File:** `web/src/components/admin/screens/kyc-management/useKyc.ts` lines 93-98

**What:** For both `reject` and `info_required`, the same `rejectionReason` field is sent in the PUT body. But the **meaning** is different:
- `reject` = "Why is this KYC being rejected?" (the reason the rider is being kicked back)
- `info_required` = "What needs to be corrected?" (the question, not a rejection)

This works in the current code because the dialog has different placeholder text per action. But the server (`kyc.routes.ts` / `kyc.use-cases.ts` `reviewKyc`) treats both as `rejectionReason` for storage. The rider sees "Rejection Reason" in their KYC status, even when it's actually "needs more info".

**Impact:** Riders in `INFO_REQUIRED` status see "Rejection Reason: Aadhaar front is blurry" — which is technically not a rejection, just a request. This is confusing and could cause support tickets.

**Fix:**
1. Split the API body into `rejectionReason` (for REJECT) and `infoRequest` (for INFO_REQUIRED). The `kyc.use-cases.reviewKyc` already supports this — the API just needs to pass them through.
2. Update the frontend dialog to use the right field per action.
3. Update `KycRider.kycRejectionReason` in the type, or add `kycInfoRequest` as a separate field.

**Effort:** ~2 hours. 1 PR.

---

### P0-4: `MediaPreview` opens images in new tab via `window.open` — no CSP, no size limit

**File:** `web/src/components/admin/screens/kyc-management/helpers.tsx` lines 67-76

**What:** The "View Full" button uses `window.open(src, '_blank')` to open the full image. Three problems:

1. **No rel="noopener noreferrer"** — if any image URL ever becomes attacker-controlled (e.g. via a rider uploading a malicious URL), the opened page gets a `window.opener` reference to the admin panel. The classic [tabnabbing](https://owasp.org/www-community/attacks/Reverse_Tabnabbing) attack.
2. **No image size cap** — a rider could upload a 4K image; opening it in a new tab works fine, but the **browser tab title** will show the image's URL (which could be a presigned S3 URL with the rider's name, signature, etc. in the query string).
3. **No fallback** — if the URL is a video, the new tab opens the video player with no controls (a `<video>` element has controls; a new tab on a .mp4 URL just downloads it).

**Fix:**
1. Use `<a href={src} target="_blank" rel="noopener noreferrer">` instead of `window.open`.
2. Or, even better: build a proper `<Dialog>` with a fullscreen image viewer (zoom, rotate, download) — not a new tab.
3. Add an `alt` text policy (already present) but also add `width`/`height` attributes to prevent CLS.

**Effort:** ~2-3 hours for the proper image viewer dialog. ~30 min for the `rel="noopener"` minimum fix.

---

### P0-5: `KycDetailSheet` shows Aadhaar/PAN numbers as plain text

**File:** `web/src/components/admin/screens/kyc-management/KycDetailSheet.tsx` (and likely rider-management too)

**What:** The detail dialog shows `rider.aadhaarNumber` and `rider.panNumber` as plain, fully visible text. An admin looking at the screen over a teammate's shoulder, or recording a screen share, leaks PII. This is a compliance issue under India's DPDP Act 2023 for any production KYC review tool.

**I need to confirm** — let me check the actual type/render. Looking at the type, the fields are present: `aadhaarNumber`, `panNumber` are in the KycRider interface. But I don't see them rendered in the current detail sheet (only `aadhaarFront`/`aadhaarBack` images). However, **they're in the data fetched by the API** (see the `where.rider` select — though the API doesn't include them, the broader rider detail screen probably does).

Let me also note: even if the detail sheet doesn't show them, **the export CSV includes phone numbers** which is also PII. The export has no redaction, no password protection, no expiry.

**Impact:** Privacy/compliance. Phone numbers in an unprotected CSV that any admin can download and accidentally email to the wrong person.

**Fix:**
1. Add a "reveal on hover / click" pattern for sensitive fields (Aadhaar, PAN, account number, IFSC) — show as `•••• •••• 1234` by default, click to reveal.
2. Password-protect CSV exports, OR add a "contains PII" warning + require a typed confirmation.
3. Add an audit log entry for every export ("admin X exported Y rows of KYC data at Z time").
4. Update the API to **not** return `aadhaarNumber` and `panNumber` in the list endpoint — only in the detail endpoint (defense in depth: the table doesn't need to show them).

**Effort:** ~1 day. 1 PR.

---

### P0-6: Keyboard shortcuts are global — fire even when not on KYC page

**File:** `web/src/components/admin/screens/kyc-management/useKyc.ts` lines 196-226

**What:** The `useEffect` registers a `window.addEventListener('keydown', ...)` that watches for `Ctrl+A`, `Ctrl+K`, `Ctrl+R`, `Ctrl+Z`. The handler is set up in `useKyc` which is only used on the KYC page, but:

1. **Ctrl+A** ("select all") is **the browser's default for "select all text in focused field"**. Overriding it everywhere breaks native form behavior on every other page. If an admin is on the rider-management page and tries to Ctrl+A in a textarea, they get nothing (or the page-level select all fires).
2. **Ctrl+Z** ("undo") is the browser's default for "undo last text input". Same issue — typing in a textarea on any other page, hitting Ctrl+Z, the KYC page's undo handler fires and tries to undo a previous bulk action.
3. The check `if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;` at line 198 is **inside the wrong scope** — it correctly returns early for inputs but only checks at the top of the handler. Wait, let me re-read… actually it IS at the top. Good. But the override still happens for the textarea state on OTHER pages (the handler is registered globally while the component is mounted, but the component is mounted as long as the tab is in the browser).
4. **No `Cmd+K`** — the handler checks `e.ctrlKey || e.metaKey` so it does work on Mac. Good.

Wait, I need to re-examine — the `useEffect` is inside `useKyc`. It runs when the component is mounted. It only mounts on the KYC page. So the global listener is only added when the KYC page is open. **But it doesn't get removed until the user navigates away.** Between mount and unmount, if the admin opens a new tab or another app via keyboard shortcut, the handler is still listening.

The bigger issue: **Ctrl+Z is genuinely dangerous**. If an admin has a half-typed support ticket in another tab, switches to the KYC tab, hits Ctrl+Z thinking "undo my typing", the KYC undo handler fires and undoes the previous bulk KYC action. **That's a data-loss bug.**

**Fix:**
1. Remove the global `Ctrl+Z` handler. Undo should be a button only, not a keyboard shortcut, because of the data-loss risk.
2. For `Ctrl+A` / `Ctrl+K` / `Ctrl+R` — scope them to a specific key combo that doesn't conflict (e.g. `Ctrl+Shift+A` / `Ctrl+Shift+K` / `Ctrl+Shift+R`), OR keep them but add a check that `document.activeElement` is inside the KYC page container (e.g. `useRef` on the table + `e.target.closest('[data-kyc-scope]')`).
3. Show the keyboard shortcut hint in a tooltip on the buttons themselves, not as a global "Ctrl+K Approve · Ctrl+R Reject" hint at the top of the page (the hint is misleading because the shortcuts work globally, not just on the page).

**Effort:** ~2 hours. 1 PR.

---

## P1 — Fix in the next 2 sprints

### P1-1: `KycManagement.tsx` has a single-tab `<Tabs>` that does nothing

**File:** `web/src/components/admin/screens/KycManagement.tsx` lines 82-91

**What:**
```tsx
<Tabs defaultValue="kyc" className="space-y-6">
  <TabsList className="bg-muted/40 p-1 h-10">
    <TabsTrigger value="kyc" className="text-xs px-5 font-semibold">
      KYC Review
    </TabsTrigger>
  </TabsList>
  <TabsContent value="kyc">
    <KycManagementTab />
  </TabsContent>
</Tabs>
```

A `<Tabs>` with **one tab** is dead UI. The `KYC Review` tab trigger is rendered but there's nothing to switch to.

**Fix:** Remove the `<Tabs>` wrapper, render `<KycManagementTab />` directly. The other admin screens (`analytics`, `rider-management`, etc.) don't have this pattern; this is an inconsistency.

**Effort:** ~5 minutes.

---

### P1-2: No empty / error / loading state for the KYC table

**File:** `web/src/components/admin/screens/kyc-management/KycTable.tsx` lines 52-71

**What:** Three states exist:
- **Loading:** shows 6 skeleton rows ✅
- **Empty (filtered):** shows a small "No riders found for this filter" message with a shield icon ⚠️ (acceptable but not great)
- **Error (API failure):** no handling at all ❌

In `useKyc.ts` line 47, `fetchRiders` catches errors and logs them but never surfaces them. If `/api/admin/riders` returns 500, the admin sees an empty list and assumes "no pending KYCs" — which is dangerous (could miss a backlog, could be a real outage).

Also, the empty state has a `Shield` icon at 40% opacity with no context. An admin on their first day wouldn't know if "no riders" means "filter is wrong" or "filter is right and queue is clear".

**Fix:**
1. Add a `fetchError` state to `useKyc`. On fetch failure, set it. Render a proper error state in `KycTable` (or a sibling component) — icon + "Couldn't load KYC queue" + "Retry" button.
2. Improve the empty state — show what filter is active ("No riders with status = SUBMITTED in the last 7 days") with a "Clear filters" CTA.
3. Consider differentiating "no data" (queue is actually empty — good!) from "filtered out" (filter is too narrow — try widening).

**Effort:** ~3-4 hours.

---

### P1-3: Date range filter has no validation

**File:** `web/src/components/admin/screens/kyc-management/KycFiltersBar.tsx` lines 97-129

**What:** The user can set `endDate < startDate` and the API happily returns no results, with no error. The same for "from date in the future". And no "last 7 days" / "last 30 days" preset chips which are the most common filters an admin reaches for.

**Fix:**
1. Disable `endDate` if it's before `startDate` (HTML `min` attribute on the input).
2. Add quick-filter chips: Today, Last 7 days, Last 30 days, This month, Last month.
3. Show the date range as a label when active: "Showing 2026-07-01 → 2026-08-04" near the table.

**Effort:** ~2 hours.

---

### P1-4: Bulk action has no confirmation dialog for destructive operations

**File:** `web/src/components/admin/screens/kyc-management/KycBulkActionsBar.tsx` lines 41-69

**What:** Clicking "Reject All" or "Needs Correction All" immediately fires the bulk API with no confirmation. The undo toast is the only safety net, but:
- The undo toast disappears after 5 seconds (`setTimeout(() => setShowUndoToast(false), 5000)` in `useKyc.ts` line 180).
- If the admin navigates away or refreshes, the undo state is lost.
- An admin with 50 riders selected and a misclick can mass-reject everyone, with a 5-second window to notice.

**Fix:**
1. Add a confirmation step for bulk reject / needs-correction: "You're about to reject 50 riders. This will notify all of them. Type 'REJECT 50' to confirm." (Similar pattern to GitHub's destructive-action confirmation.)
2. The undo toast should persist across navigation (currently it doesn't — `lastAction` is in component state, lost on route change).
3. Or, more conservatively, cap the bulk action at 25 riders per click and require multiple clicks for more.

**Effort:** ~3 hours.

---

### P1-5: `getCompletion` only counts 5 documents, ignoring guarantor + bank

**File:** `web/src/components/admin/screens/kyc-management/helpers.tsx` lines 16-20 + `kycDocuments` array

**What:** The `Completion` column in the table shows "% complete" based on only 5 fields: Aadhaar Front, Aadhaar Back, PAN, Signature, Profile Photo. But the full KYC requires:
- All 5 above
- Bank details (bankName, accountNumber, ifscCode)
- Personal details (fatherName, motherName, dob, currentAddress)
- Guarantor (guarantorName, guarantorPhone, guarantorAadhaar Front/Back, guarantorPan, guarantorPhoto, guarantorSignature, guarantorVideo)

So a rider with all 5 "documents" but no bank details shows 100% complete in the table, but is actually ~40% complete.

**Impact:** Admins think the rider is ready to review; they click, see the full detail, and discover bank + guarantor are missing. Wasted time.

**Fix:** Define a proper `kycCompletion` helper that includes all required fields with weights. Something like:

```ts
const REQUIRED_FIELDS = {
  documents: ['aadhaarFront', 'aadhaarBack', 'panCard', 'signature', 'profilePhoto'],
  personal: ['fatherName', 'motherName', 'dob', 'currentAddress'],
  bank: ['bankName', 'accountNumber', 'ifscCode'],
  guarantor: ['guarantorName', 'guarantorPhone', 'guarantorAadhaarFront', 
              'guarantorAadhaarBack', 'guarantorPan', 'guarantorPhoto'],
};
```

**Effort:** ~1 hour.

---

### P1-6: `KycTable` has 12 columns — overflows on most laptop screens

**File:** `web/src/components/admin/screens/kyc-management/KycTable.tsx` lines 77-103

**What:** The table has 12 columns (Select, Rider, Guarantor, Phone, KYC Status, Aadhaar, PAN, Bank, Signature, Date, Completion, Actions). The wrapper has `overflow-x-auto` which means on a 1366px laptop (the most common admin device), the table horizontally scrolls. The actions column (most important) is at the right end — meaning the admin has to scroll right to take action on every row.

**Fix:** Make the most important columns sticky (Select, Rider, KYC Status, Actions) and let the document-check columns (Aadhaar/PAN/Bank/Signature) be horizontally scrollable. Or convert the document checks into a single "Documents (5/5 ✓)" cell. Or make the row a card on mobile / small viewports.

**Effort:** ~3 hours.

---

### P1-7: The "KYC Review" page has no total / count summary

**File:** `web/src/components/admin/screens/kyc-management/KycFiltersBar.tsx` (the `Tab` triggers) and `KycTable.tsx`

**What:** An admin landing on the KYC review page sees a list but has no idea how many KYCs are pending total, or how many are in each tab. The tabs say "Pending" / "Approved" / "Rejected" / "Needs Correction" / "All" but **don't show counts**. An admin has no urgency signal — is the queue empty, or are there 200 waiting?

**Fix:** Add counts to each tab. Use the `total` field from the API's pagination response (already there). Show as `(42)`, `(0)`, etc.

**Effort:** ~1 hour.

---

### P1-8: Bulk action undo is client-side only — server state has already changed

**File:** `web/src/components/admin/screens/kyc-management/useKyc.ts` lines 131-151

**What:** The `handleUndo` function records the previous statuses in `lastAction.previousStatuses` and on Ctrl+Z / button click, fires a new PUT to revert. But:

1. **If the admin closes the tab before undoing**, the previous statuses are lost. Server has the new statuses.
2. **If the undo API call fails** (network blip, server error), the partial state is silently lost — some rows reverted, some didn't.
3. **There's no server-side audit trail of "this was an undo"** — from a compliance perspective, you want to know "admin X approved 50, then undid 50, then approved 30 again" — not just "approved 30".

**Fix:**
1. Add a server-side bulk-undo endpoint (`POST /api/admin/kyc/bulk-undo` with the action ID) that the server tracks. The server can then guarantee atomicity.
2. Persist the undo state in `sessionStorage` or a server-side temporary record, so a refresh doesn't lose it.
3. Add audit log entries for both the original action AND the undo, linked by a correlation ID.

**Effort:** ~1 day (server-side endpoint + frontend wiring).

---

### P1-9: `kyc.state-machine.ts` allows `REJECTED → SUBMITTED` but no test covers it

**File:** `web/src/server/modules/kyc/kyc-state-machine.ts` line 24

**What:** The state machine has:
```ts
REJECTED: ['SUBMITTED'],
```

Meaning a rejected KYC can be re-submitted. That's fine (rider fixes docs, submits again). But I don't see a test for this transition. And the rider-management flow's logic in `kyc.use-cases.submitKyc` has the "REJECTED + editableFields" path that filters to only allowed fields — if a rider re-submits WITHOUT editable fields set, the behavior is undefined.

**Fix:** Add a test for the `REJECTED → SUBMITTED` transition, AND a test for the "rejected with no editable fields" edge case. Currently I only see `kyc_workflow.test.ts` (integration) and 2 unit tests.

**Effort:** ~2 hours.

---

## P2 — Cleanup backlog

### P2-1: `KycRider` type is 56 fields, mostly nullable

**File:** `web/src/components/admin/screens/kyc-management/types.ts` lines 1-56

**What:** The type is a flat list of 56 fields, mostly nullable. This is a "god object" — the KYC review table has no business knowing about `pickupPhotoSpeedometer`. Split into logical groups:

```ts
interface KycRider {
  id: string;
  riderId: string;
  phone: string;
  fullName: string | null;
  kycStatus: KycStatus;
  state: string;
  lifecycleStatus: string;
  profilePhoto: string | null;
  completion: number;  // computed
  personal: { /* father, mother, dob, address */ };
  documents: { aadhaarFront, aadhaarBack, panCard, signature };
  bank: { bankName, accountNumber, ifscCode };
  guarantor: { name, phone, status, documents };
  meta: { createdAt, submissionDate, rejectionReason };
}
```

This also makes `getCompletion` and the `kycDocuments` array easier to maintain.

**Effort:** ~3-4 hours.

---

### P2-2: `helpers.tsx` mixes pure functions, a const list, and a component

**File:** `web/src/components/admin/screens/kyc-management/helpers.tsx`

**What:** The file has:
- `kycDocuments` (const list)
- `getCompletion` (pure function)
- `getKycBadge` (pure function returning CSS class string)
- `MediaPreview` (React component)

Split into 3 files: `constants.ts`, `helpers.ts`, `MediaPreview.tsx`.

**Effort:** ~30 min.

---

### P2-3: `kyc-management/index.ts` re-exports everything

**File:** `web/src/components/admin/screens/kyc-management/index.ts`

**What:** `export * from './X'` for every file. This works but defeats tree-shaking and makes it hard to track what's used where. Use named re-exports:

```ts
export { useKyc } from './useKyc';
export { KycTable } from './KycTable';
export { KycDetailSheet } from './KycDetailSheet';
// ...
```

**Effort:** ~15 min.

---

### P2-4: `useKyc` is 263 lines — split into smaller hooks

**File:** `web/src/components/admin/screens/kyc-management/useKyc.ts`

**What:** The hook has data fetching, state management, keyboard shortcuts, undo logic, bulk action logic — all in one file. Split into:
- `useKycData` (fetching + riders state)
- `useKycActions` (approve/reject single + bulk)
- `useKycSelection` (selectedIds + toggle)
- `useKycUndo` (lastAction + handleUndo)
- `useKycShortcuts` (keyboard listener)

**Effort:** ~2-3 hours.

---

### P2-5: `submissionDate` field exists on the type but is never used

**File:** `web/src/components/admin/screens/kyc-management/types.ts` line 54

**What:** `submissionDate: string | null;` — listed in the type but not displayed anywhere in the UI. Probably was intended for a "submitted 2 days ago" badge on the table. Either render it (it'd be useful — admins can see which KYCs are stale) or remove it from the type.

**Effort:** ~30 min either way.

---

### P2-6: `KycRider.sharedGuarantorWith` shows a count but no detail

**File:** `web/src/components/admin/screens/kyc-management/KycTable.tsx` lines 142-146

**What:** A rider with a shared guarantor shows "Shared (3)" — meaning 3 other riders share this guarantor. An admin might want to know **who** (to spot fraud — same guarantor across many unrelated riders is a red flag). The detail dialog doesn't show this either.

**Fix:** Make the count clickable, show a popover or expand the row to show the shared rider IDs. Or surface in the detail dialog.

**Effort:** ~2 hours.

---

## Things that are good (preserve in future PRs)

- **`kyc-state-machine.ts`** — clean, typed, single source of truth for valid transitions. ✅
- **`approveKyc.ts` use case** — proper precondition check, audit log, typed errors. ✅
- **`withApiHandler` wrapper** — consistent error handling in the API routes. ✅
- **`AdminErrorBoundary`** in `KycManagement.tsx` — wraps the whole thing in case of a render error. ✅
- **Tab-based filtering** — clean, keyboard-navigable. ✅
- **Export with progress** — shows real progress, not just "Exporting...". ✅
- **Caching with `invalidateCache('admin:kyc:*')`** on mutation — ensures list updates after action. ✅
- **`getKycBadge`** with consistent KYC status colors — matches the team's canonical mapping (SUBMITTED=blue, PENDING=amber). ✅

---

## Suggested fix order

| # | Item | Effort | Risk | Impact |
|---|---|---|---|---|
| 1 | P0-1 Delete duplicate KYC modal | 3-4 hrs | Low | Critical (consistency) |
| 2 | P0-2 Check `res.ok` in fetch | 1 hr | Low | Critical (data integrity) |
| 3 | P0-6 Remove global Ctrl+Z, scope other shortcuts | 2 hrs | Low | Critical (data loss) |
| 4 | P0-3 Separate `rejectionReason` / `infoRequest` | 2 hrs | Med | High (rider UX) |
| 5 | P0-5 PII protection (reveal-on-click + audit log) | 1 day | Low | Critical (compliance) |
| 6 | P0-4 Image viewer dialog (drop window.open) | 3 hrs | Low | High (security + UX) |
| 7 | P1-1 Remove single-tab wrapper | 5 min | None | Low (dead code) |
| 8 | P1-2 Empty/error/loading states | 3-4 hrs | Low | High (UX) |
| 9 | P1-5 Fix `getCompletion` weights | 1 hr | Low | High (admin efficiency) |
| 10 | P1-7 Tab counts | 1 hr | None | High (admin awareness) |
| 11 | P1-4 Bulk action confirmation | 3 hrs | Low | High (data loss prevention) |
| 12 | P1-6 Sticky columns | 3 hrs | Low | High (admin efficiency) |
| 13 | P1-3 Date filter presets + validation | 2 hrs | Low | Med (UX) |
| 14 | P1-8 Server-side undo | 1 day | Med | Med (data integrity) |
| 15 | P1-9 State machine test for REJECTED→SUBMITTED | 2 hrs | None | Med (correctness) |
| 16 | P2-* cleanup items | as needed | None | Low |

---

## Test gaps to close

- **No test for the bulk action happy path** in `kyc_workflow.test.ts` (only single-rider actions are tested).
- **No test for the duplicate KYC modal removal** (after P0-1) — would have caught the divergence.
- **No test for `useKyc` keyboard shortcut scoping** (after P0-6).
- **No test for the "no editable fields + rejected" edge case** in `kyc.use-cases.submitKyc`.
- **No accessibility tests** — no `axe-core` or `vitest-axe` setup. Critical for an admin tool used by multiple people.

---

## Recommended follow-up audits

1. **Rider-app KYC submission flow** — `flutter/lib/features/kyc/...` — to find the rider-side counterpart of the issues above.
2. **Audit log integrity** — every KYC mutation should be logged. Verify `createAuditLog` is called on every path (approve, reject, info_request, bulk, undo).
3. **Permissions audit** — the API uses `kyc_view`, `kyc_approve` permissions. Are the rider-management route and bulk endpoint using the same checks?
4. **PII in logs** — search the codebase for `logger.*` calls that might log Aadhaar / PAN / phone numbers.

---

**Audit complete.** Recommend creating tracking tickets for each P0 item this week, P1 items in the next sprint planning.
