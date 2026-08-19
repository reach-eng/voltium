# Release Readiness — 2026-08-06 (fix-plan-9-audits)

Implementation of `docs/plans/2026-08-06-fix-plan-9-audits.md` — the 11 active
items across the 8 prior audits, shipped as a single coordinated sweep. All
work is on branch `feat/ux-2-loading-haptics` (uncommitted, per the shared
checkout policy).

## What landed

| PR | Scope | Outcome |
|----|-------|---------|
| PR-1 | Team-leader bulk permission key (`tl_manage` → `team_leaders_manage`) | Bulk routes + nav entries consolidated; legacy key kept in the map so admins with stored explicit `["tl_manage"]` perms don't lock out (route-level fallback). Gates: `team-leaders-p0.test.ts`. |
| PR-9 | Fleet/settings/rewards tidy-ups | Shifts perms cleaned; `/api/shifts` public route now rate-limited; `Reward.points` paise unit pinned + documented; server-side `search` added to coupons/offers/plans list routes. |
| PR-2 | Operations Board stats | Verify-only — endpoint already computes real Prisma counts with a test. No change. |
| PR-3 | Maintenance cache + caddyStatus | Cache extracted to `lib/maintenance-cache.ts` with `invalidateMaintenanceCache()` wired into the PUT route; `caddyStatus` fallback now `'Offline'` instead of masking as `'healthy'`. Gate: `maintenance-cache.test.ts`. |
| PR-5 | KYC dialog unification | `KycActionModal.tsx` was dead code (0 callers) wrapping the canonical `KycDialogs` — deleted. |
| PR-6 | Earnings summary | Verify-only — repository already aggregates over the full filtered dataset (`aggregate({ where })`), UI reads `json.data.summary`. No change. |
| PR-7 | DR restore orphaned backup | `restore.service.ts` tracks the pre-restore backup id; mid-restore failure flags it `ORPHANED_BY_FAILED_RESTORE:<restoreJobId>` + `restore.orphaned_pre_restore_backup` audit. New `orphan-backup-cleanup.job.ts` purges flagged backups past 7 days (disk + row + audit). Gates: `restore-orphaned-pre-restore.test.ts`, `orphan-backup-cleanup.test.ts`. |
| PR-8 | Payment-gateway credentials | `keySecret`/`webhookSecret` encrypted at rest (AES-256-GCM via new `lib/credentials.ts`, idempotent encrypt, legacy-plaintext passthrough) across GET/POST/PATCH on both routes. Gate: `credentials-roundtrip.test.ts`. |
| PR-4 | Announcements async fanout | Immediate ALL sends require `?confirm=true` + 3/hr/admin fail-closed rate limit, return 202; use-case emits `ANNOUNCEMENT_BROADCAST`; new `announcement-broadcast.job.ts` does the batched background insert (500/batch, 100ms throttle, `skipDuplicates`). Scheduled cron now emits events instead of inline fanout. Admin UI adds the confirm gate. Gate: `announcements-async-broadcast.test.ts` (7 tests). |

## Validation

- `npx tsc --noEmit` — clean.
- Full web unit suite — **2727 passed, 3 skipped, 0 failures**.
- New gates — 31 tests across 5 files, all passing.
- `check-api-coverage` (159 ops) still green — no new routes were added.

## Outstanding / decision needed

- **Reward redeem endpoint** (Phase 3 of the plan) — 2-day feature, blocked on
  whether rewards = wallet credits vs external (Amazon etc.). Tracked in
  `docs/FOLLOWUP_TICKETS.md`.
- **Admin ticket UI** cannot yet *display* attached evidence photos (URL is
  stored but not rendered) — follow-up if ticket attachments matter for ops.

## Ledger

Audit reclassification entries **#94–#96** added to
`docs/AUDIT_INDEX_2026-08-03.md`; `docs/AUDIT_WORKERS.md` updated with the
`ANNOUNCEMENT_BROADCAST` event → worker mapping.
