"""Re-append the AUDIT_ADMIN_2026-08-21 section to FOLLOWUP_TICKETS.md
using UTF-8 encoding (PowerShell Add-Content corrupted the special chars)."""

import os

path = r"D:\voltium\docs\FOLLOWUP_TICKETS.md"
section = """

---

### Follow-up — Admin panel deep audit (AUDIT_ADMIN_2026-08-21)

**Date:** 2026-08-21
**Source:** `docs/AUDIT_ADMIN_2026-08-21.md` — 4 parallel read-only agents
(UI deep audit + API/server modules + Security/RBAC/observability +
Data-management + workers). 136 raw findings de-duplicated to **86 unique
findings (8 P0, 28 P1, 38 P2, 12 P3)**.
**Status:** Implementation plan ready. 11-PR ship order in the audit doc
(PR-1 through PR-11). Total effort ~14 focused days.

**What's covered (already shipped or in the implementation plan):**
- The 8 P0s (single-flight restore, typed-phrase confirms, audit-log
  integrity, APP_ENV gate, daily-IP cap) are PR-1 + PR-2 + PR-3 in the
  audit doc. Each PR is review-ready.
- The 28 P1s split into PR-2..PR-8 (audit-log additions, RBAC
  fine-grained gates, rate-limit hardening, UI confirmations, PII
  exposure, code health splits).
- The 38 P2s + 12 P3s go into PR-9..PR-11 (hygiene + UI consolidation
  + polish + coverage-gap fill).

**De-duplication note:** This audit explicitly cross-references the prior
plans (`docs/AUDIT_PLAN_2026-08-18.md`, `docs/ADMIN_WEB_PLAN.md`,
`docs/AUDIT_FINDINGS_ADMINPANEL.md`, `docs/AUDIT_WORKERS.md`,
`docs/AUDIT_SECURITY.md`) and the 65 existing tickets. Where a finding
overlaps an existing ticket, it is re-stated in the de-duplication map
(§2 of the audit doc) but NOT re-numbered.

**New tickets filed (numbers T-70..T-79) — 10 tickets, ~14 days focused:**

**T-70 (P0) — Restore single-flight + destructive confirm primitive**
(PR-1 in audit doc). Findings F-001, F-002, F-003, F-004, F-005, F-006,
F-010, F-021. Atomic `findOrCreateRestoreJob` with `BACKUP_LOCK_STATUS`
flip in one transaction; extract `<DestructiveConfirm phrase={...}>` in
`web/src/components/admin/DestructiveConfirm.tsx`; wire into 5
destructive flows (Start Restore, Enable Maintenance, Delete Backup,
Verify All, Run Backup Now).
**Owner:** Web team. **Effort:** 1.5 d. **Why now:** worst-case =
two concurrent restores racing the pre-restore backup.

**T-71 (P0) — Admin audit-log integrity + per-route audit additions**
(PR-2 in audit doc). Finding F-036 + 14 audit-log gaps (T-37, T-38, T-46,
T-47, T-48, T-49, T-50, T-51, T-52, T-53, T-54, T-64, T-65, T-73). Move
`createAuditLog` into the `db.$transaction` for wallet-adjust (drop
fire-and-forget). Add `logAdminMutation({session, action, entity, ...})`
helper. One-line per handler.
**Owner:** Web team. **Effort:** 1.5 d. **Why now:** SOC2 fail if a
critical action is silent.

**T-72 (P0) — APP_ENV gate alignment + daily-IP cap + CSRF cleanup**
(PR-3 in audit doc). Findings F-039, F-040, F-045, F-059, F-071, F-076,
F-081. Replace `NODE_ENV === 'development'` with canonical
`IS_PROD = APP_ENV === 'production' || APP_ENV === 'staging' ||
NODE_ENV === 'production'` in `auth/sendOtp` echo, `auth/verify-otp`
and `auth/verify-phone` rate caps, `outbox.ts:335` emit-rate gate,
`lib/rate-limit-middleware.ts:73-99` cf-connecting-ip trust. Add
24h daily-IP cap to send-otp / verify-otp / verify-phone. Drop
`x-approval-token` header fallback in data-deletion. Extract
`IS_PROD` to `lib/env.ts` to close F-071.
**Owner:** Web team. **Effort:** 0.5 d. **Why now:** staging SMS
budget protection is bypassed.

**T-73 (P1) — Auth + files rate limits + verify-otp idempotency**
(PR-4 in audit doc). Findings F-041, F-042, F-043, F-044, F-063, F-085.
Add `checkRateLimit` to `auth/refresh` (rider + admin), `files/confirm-upload`,
`files/request-read`, `notifications` single-rider branch. Wrap `verify-otp`
in `withIdempotency`. Add per-rider upload count cap
(`db.fileRecord.count({where:{ownerId, status:'PENDING_UPLOAD'}})`).
**Owner:** Web team. **Effort:** 1 d.

**T-74 (P1) — Fine-grained permission gates on 18 admin routes**
(PR-5 in audit doc). Findings F-055 (dangling `transactions_manage`),
F-058 (`admins/lookup` unpermissioned), F-086 (18 admin routes use only
`requireAdmin`). Add `hasPermission(session, '<perm>')` to riders/[id],
riders/bulk, riders/actions, team-leaders/*, tickets/*, vehicles/*,
vehicles/bulk, vehicles/[id]/history, transactions/*, transactions/bulk,
payment-gateways/*, scores/*, reconciliation, shifts/*, operations/overview,
workflow-coverage, admins/lookup, deposits. Resolve `data_management_*`
permissions being `[]` in role matrix (either grant to a new
DISASTER_RECOVERY role or document as SUPER_ADMIN-only).
**Owner:** Web team. **Effort:** 1 d.

**T-75 (P1) — UI confirmations + 4-tab dedup + error UX**
(PR-6 in audit doc). Findings F-011 (raw `json.error` toast), F-013
(`aria-current="step"`), F-014 (3 loading idioms → 1), F-016 (4 tabs
duplicate ~600 lines), F-017 (sidebar re-fetches `/auth/me`), F-018
(error boundary surfaces raw text), F-019 (inline `style={{display:'none'}}`
hydration marker), F-020 (ScheduleTab `disabled` no explanation),
F-024 (bulk actions no optimistic rollback), F-025 (audit log search
by action only), F-029 (`RestoreTab` step state should be `useReducer`).
Centralise `extractErrorMessage(json)` helper; extract
`data-management/types.ts` + `helpers.ts`; consume `AdminSessionContext`
in sidebar; add `useOptimisticBulk` helper; widen `AuditLogScreen`
filter bar.
**Owner:** Web team. **Effort:** 1.5 d.

**T-76 (P1) — PII exposure: KYC masks + reveal audit + verifyOtp slim
+ flattenRider deny-list** (PR-7 in audit doc). Findings F-007, F-008,
F-026, F-031, F-066, F-067, F-069, F-095, F-097. Add `maskPhone()` to
KYC dialog; wrap reveal in audit-log call; move audit log "Details" to
a modal; read `KycBulkActionsBar` and gate bulk-approve response; trim
`verifyOtp` response to `{riderId, isNewRider, token, refreshToken}`;
introduce `FORBIDDEN_PROFILE_FIELDS` deny-list in `flattenRider` for
defense-in-depth; move SOS audit log to 30-day `emergency` retention
bucket; round lat/lng to 3 decimals at write; surface `acknowledged:
false` to the rider app as a "report manually" CTA.
**Owner:** Web + mobile team. **Effort:** 1.5 d. **Why now:**
rider-app verify-otp contract change is in scope.

**T-77 (P1) — Code health: service moves + use-case splits + api-handler fold**
(PR-8 in audit doc). Findings F-060, F-061, F-062, F-068. Move
`lib/services/wallet-service.ts` and `deposit-service.ts` to
`server/modules/{wallet,deposits}/`. Move 5 direct `db.*` queries in
route handlers to use-cases. Split `admin-riders.use-cases.ts` (34.5KB)
into `rider-update-fields.ts` etc.; same for `rider.use-cases.ts` (26.9KB)
and `backup.service.ts` (26.9KB). Fold `api-handler.ts` into
`api-middleware.ts`; update ~30 call sites; delete `api-handler.ts`.
**Owner:** Web team. **Effort:** 3 d.

**T-78 (P2) — P2 hygiene batch** (PR-9 in audit doc). 30 P2 findings
including: PII mask rules consolidation (F-087), secret-collision
check at boot (F-089), `encryptKycData('')` empty handling (F-090),
`validateMagicBytes` accept-all (F-088), `rateLimitIdentifierFromRequest`
`127.0.0.1` fallback (F-091), `getMaintenanceState` fail-open (F-092),
`contracts/openapi.ts` regen in prebuild (F-093), CSRF no-Origin
bypass (F-094), `decryptPii` → security event (F-079), `verify-receipt`
binds tokenVersion (F-080), `OutboxEmitRateLimitedError` catch
(F-077), `OutboxService.emit` per-process decision (F-078), virus scan
stub (F-084), `withJobGuards` dead code (F-083), `proxy.ts` dead code
(F-082), `lib/services/dashboard.ts` dead (F-074), `parseDDMMYYYY`
silent fallback (F-070), `withApiHandler` 500-opaque (F-072), `rider
refresh expiresIn` 1h→2h (F-096), audit-log catch-path redaction
(F-097), `useState` sprawl + raw `fetch()` everywhere (F-022), `RiderDetailDialog`
30-prop god (F-023), `CommandPalette` no detail (F-027), `KycBulkActionsBar`
not reviewed (F-031).
**Owner:** Web team. **Effort:** 1.5 d.

**T-79 (P3) — UI consolidation + coverage gap fill** (PR-10 + PR-11
in audit doc). 12 P3 + 16 admin screens with no test. EmptyState
unification (F-015), icon-only button `aria-label` ratchet (F-012),
`<TabSkeleton>` shared component, copy consistency "Cancel/Close/Back"
(F-030), `AdminLayout` magic number (F-032), 279 `ml/mr/pl/pr` RTL
instances (F-033, opportunistic), `PlanFormDialog` durationDays
read-only (F-034), ⌘K hint on mobile (F-035), inline hydration marker
(F-019), 16 missing admin integration tests (F-028 — must ship in
PR-11: `maintenance_mode.test.ts`, `rental.test.ts`, `notifications.test.ts`,
`fleet_map.test.ts` at minimum; also the 4 security tests for F-007,
F-008, F-010, F-011).
**Owner:** Web team. **Effort:** 1.5 d.

**Total new admin tickets: 10 (T-70..T-79), ~14 days focused, 11-PR
ship order, all P0s shippable in 2 weeks.** The audit doc is the
single source of truth — these tickets are summary back-references.

**Out of scope for this audit pass:** Flutter app (covered by
`docs/AUDIT_PLAN_2026-08-18.md`), design system (already shipped),
dark mode (already shipped), Indian-locale RTL (admin is en-only by
product decision).
"""

# Read the file as bytes, find the corrupted section, replace it with the clean one.
# The corrupted section starts at "---" followed by the corrupted "Follow-up" header.
with open(path, "rb") as f:
    raw = f.read()

# Detect the corrupted marker
corruption_marker = b"### Follow-up \xe2\x80\x94 Admin panel deep audit"  # in case it was correctly encoded
# Actually the corruption mangled the em-dash. Look for the literal text.
# Find the start of the corrupted block by looking for the last "## " before our section.
# The corrupted section is at the very end. Find it by looking for a unique-ish marker.
# The marker text: "### Follow-up ? Admin panel deep audit"  (em-dash got mangled to ?)
# In UTF-8 the em-dash is \xe2\x80\x94, but PowerShell corrupted to "?" or " ".
# The simplest: find the LAST occurrence of "future use." (the line just before our section) and replace from there.

marker = b"future use.\n**Owner:** Localization lead. **Effort:** 10 min + translator"
idx = raw.rfind(marker)
if idx == -1:
    raise SystemExit("Could not find the marker 'future use' preceding the section to replace")

# Find the end of "future use" line (next newline) and the start of the corrupted section.
# The corrupted section starts with "\n\n---\n\n### Follow-up"
fwd = raw.find(b"### Follow-up", idx)
if fwd == -1:
    raise SystemExit("Could not find '### Follow-up' after the marker")

# Replace the corrupted block with the clean section
new_raw = raw[:fwd] + section.encode("utf-8")
with open(path, "wb") as f:
    f.write(new_raw)
print(f"Replaced {len(raw) - len(new_raw)} bytes of corrupted content with {len(section)} bytes of clean UTF-8 section.")
print(f"File is now {len(new_raw)} bytes.")
