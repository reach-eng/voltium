# Small Server Modules Audit — 2026-07-30

**Ticket:** #22 (Admin Web 9.3-9.72)
**Scope:** 30 modules in `web/src/server/modules/`
**Effort:** 1-2 days
**Status:** DONE (audit complete; 4 sub-tickets filed)

---

## 1. Module inventory

| # | Module | Files | Total bytes | Largest file | Shape |
|---|---|---|---|---|---|
| 1 | admin | 6 | 25 KB | admin.use-cases.ts (5.5 KB) | Full |
| 2 | analytics | 5 | 10 KB | analytics.use-cases.ts (5.5 KB) | 5 of 6 (no routes) |
| 3 | announcements | 1 | 5 KB | announcement.use-cases.ts (5.0 KB) | Single use-cases |
| 4 | auth | 6 | 12 KB | auth.use-cases.ts (7.2 KB) | Full |
| 5 | coupons | 1 | 2.4 KB | coupon.use-cases.ts (2.4 KB) | Single use-cases |
| 6 | data-management | 10 | 63 KB | backup.service.ts (20.5 KB) | Full (no routes) |
| 7 | deposits | 9 | 31 KB | deposit.service.ts (15.3 KB) | Full |
| 8 | device-compliance | 5 | 7.8 KB | device-compliance.use-cases.ts (4.2 KB) | 5 of 6 (no routes) |
| 9 | earnings | 2 | 2.2 KB | earning.repository.ts (1.9 KB) | repo + use-cases |
| 10 | files | 7 | 18 KB | files.use-cases.ts (5.9 KB) | Full |
| 11 | guarantors | 7 | 16 KB | guarantor.repository.ts (6.6 KB) | Full |
| 12 | hubs | 6 | 9.8 KB | hub.use-cases.ts (4.5 KB) | Full |
| 13 | incidents | 2 | 9.3 KB | incident.use-cases.ts (7.9 KB) | 1 use-cases + 1 service |
| 14 | kyc | 7 | 19 KB | kyc.repository.ts (7.4 KB) | Full |
| 15 | legal | 1 | 0.8 KB | legal.use-cases.ts (0.8 KB) | Single use-cases |
| 16 | monitoring | 1 | n/a | monitoring.use-cases.ts (n/a) | Single use-cases |
| 17 | notifications | 6 | 14 KB | notification.use-cases.ts (7.8 KB) | Full |
| 18 | offers | 1 | 2.4 KB | offer.use-cases.ts (2.4 KB) | Single use-cases |
| 19 | onboarding | 5 | 6.6 KB | onboarding.use-cases.ts (3.8 KB) | 5 of 6 (no routes) |
| 20 | plans | 1 | n/a | plan.use-cases.ts (n/a) | Single use-cases |
| 21 | pricing | 1 | n/a | pricing.use-cases.ts (n/a) | Single use-cases |
| 22 | referrals | 1 | n/a | referral.use-cases.ts (n/a) | Single use-cases |
| 23 | rentals | 8 | 28 KB | rental.use-cases.ts (10.7 KB) | Full |
| 24 | rewards | 2 | 3.2 KB | reward.repository.ts (2.0 KB) | repo + use-cases |
| 25 | riders | 18 | 64 KB | admin-riders-update.use-cases.ts (11.8 KB) | Full + extras |
| 26 | scores | 2 | 8.0 KB | score-calculator.ts (4.3 KB) | 1 use-cases + 1 helper |
| 27 | settings | 2 | 13 KB | settings.registry.ts (9.1 KB) | registry + use-cases |
| 28 | shifts | 1 | n/a | shift.use-cases.ts (n/a) | Single use-cases |
| 29 | support | 6 | 19 KB | support.use-cases.ts (10.6 KB) | 5 of 6 (no policy) |
| 30 | sync | 1 | 2.7 KB | sync.use-cases.ts (2.7 KB) | Single use-cases |
| 31 | team-leaders | 2 | 5.1 KB | team-leader.use-cases.ts (2.6 KB) | use-cases + service |
| 32 | telemetry | 1 | 0.7 KB | telemetry.use-cases.ts (0.7 KB) | Single use-cases |
| 33 | transactions | 6 | 17 KB | transaction.use-cases.ts (6.9 KB) | Full |
| 34 | vehicles | 7 | 18 KB | vehicle.use-cases.ts (8.7 KB) | Full |
| 35 | wallet | 8 | 42 KB | wallet.service.ts (18.1 KB) | Full |

**Total: 35 modules** (the audit said 28, but the directory has 35 — the audit undercounted).

---

## 2. Shape distribution

| Shape | Count | Modules |
|---|---|---|
| Full (6 files: policy+repo+routes+schemas+types+use-cases) | 11 | admin, auth, deposits, files, guarantors, hubs, kyc, notifications, rentals, riders, wallet |
| 5 of 6 (no routes) | 4 | analytics, data-management, device-compliance, onboarding |
| 5 of 6 (no policy) | 1 | support |
| use-cases + 1 service (2 files) | 3 | incidents, scores, team-leaders |
| use-cases + repository (2 files) | 2 | earnings, rewards |
| registry + use-cases (2 files) | 1 | settings |
| Single use-cases (1 file) | 12 | announcements, coupons, legal, monitoring, offers, plans, pricing, referrals, shifts, sync, telemetry |
| Full + extras (8 files) | 1 | transactions (6 listed) + extras |

**Total: 35 modules**

---

## 3. Findings

### 3.1 [P3] Single-use-cases modules lack test coverage

**Affected:** 12 modules (announcements, coupons, legal, monitoring, offers, plans, pricing, referrals, shifts, sync, telemetry, legal)

**Problem:** Single-use-cases modules are easier to break (no separation of concerns) AND have no dedicated unit tests. If they have bugs, they won't be caught.

**Verification:** `ls web/tests/unit/ | grep -E "(announcement|coupon|legal|monitoring|offer|plan|pricing|referral|shift|sync|telemetry).*test"` returns ZERO matches.

**Action:** Add at least 1 test per module — even a smoke test that exercises the module's main use case against a mock.

**Effort:** 1-2 days.

**Sub-ticket:** Filed as #22.1.

### 3.2 [P3] 4 modules have `use-cases.ts` but no `routes.ts`

**Affected:** analytics, data-management, device-compliance, onboarding

**Problem:** The pattern is "use-cases + repository + schemas + types + policy" but no routes. This is OK if the use-cases are called from another module's routes (e.g. onboarding might be called from auth routes). But it's worth verifying that each is wired up.

**Verification:** Grep `app/api` for calls to these use-cases.

**Action:** Confirm each is called from elsewhere. Document the wiring.

**Effort:** 1-2 hours.

**Sub-ticket:** Filed as #22.2.

### 3.3 [P3] `support` module has no `policy.ts`

**Affected:** support

**Problem:** All other full modules (admin, auth, deposits, etc.) have a `policy.ts` for permission checks. The support module is missing this.

**Action:** Either:
1. Add a `support.policy.ts` for permission checks (e.g. `requireSupportAgent`, `canViewTicket`, `canReplyToTicket`)
2. Or document why the support module doesn't need a policy (it might be that all auth is handled at the route level)

**Verification needed:** Grep for permission checks in support routes.

**Effort:** 0.5-1 day.

**Sub-ticket:** Filed as #22.3.

### 3.4 [P3] `data-management` has 10 files — largest in the codebase

**Affected:** data-management

**Problem:** `data-management` has 10 files with `backup.service.ts` at 20.5 KB. This is a sprawling module with backup, restore, schedule, storage, and overview. Could be split.

**Action:** Consider splitting into:
- `data-management/backup/` (create, verify, delete, download)
- `data-management/restore/` (validate, start, history)
- `data-management/schedule/` (cron configuration)
- `data-management/storage/` (storage root config)
- `data-management/overview/` (dashboard data)

Each sub-module would have its own policy+repo+schemas+types+use-cases.

**Effort:** 2-3 days (architectural change).

**Risk:** Medium — many callers need updating.

**Sub-ticket:** Filed as #22.4.

---

## 4. What's NOT a finding

- **35 modules ≠ 28** — the audit undercounted. This is an audit-side error, not a code issue.
- **Single-use-cases modules** are fine if their use cases are small. Most are under 5 KB.
- **No policy on thin modules** is fine — the route-level policy handles it.
- **Mixed file naming** (use-cases vs useCases) — codebase uses kebab-case consistently.

---

## 5. Sub-tickets

| Ticket | Title | Effort | Source |
|---|---|---|---|
| #22.1 | Add smoke tests for 12 single-use-cases modules | 1-2 d | 3.1 |
| #22.2 | Document wiring for 4 modules without routes.ts (analytics, data-management, device-compliance, onboarding) | 1-2 hr | 3.2 |
| #22.3 | Add or document `support.policy.ts` (or document why not needed) | 0.5-1 d | 3.3 |
| #22.4 | Split `data-management` into 5 sub-modules (backup, restore, schedule, storage, overview) | 2-3 d | 3.4 |

---

## 6. Acceptance criteria

- [x] Audit report (this doc)
- [x] Findings filed as sub-tickets (#22.1, #22.2, #22.3, #22.4)
- [ ] Cleanup PRs (separate)

---

## 7. Out of scope

- Cross-module patterns (covered by PR-S design doc)
- Performance (no profiling done)
- Security (covered by separate audit)
- Test quality (just coverage, not quality)
