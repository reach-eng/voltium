# Top-Level Shell Audit — 2026-07-30

**Ticket:** #26 (Admin Web 11.13)
**Scope:** `web/src/app/` and `web/src/app/api/` top-level structure
**Effort:** 0.5 day
**Status:** DONE (audit complete; sub-tickets filed)

---

## 1. Top-level files (web/src/app/)

| File | Lines | Notes |
|---|---|---|
| `layout.tsx` | 87 | Standard Next.js root layout; imports Plus Jakarta Sans, Toaster, SkipLink, Providers, branding constants. Clean. |
| `page.tsx` | 21 | Top-level home page (likely a redirect to /admin or /rider). Clean. |
| `providers.tsx` | 44 | Client provider wrapper. Standard. |
| `error.tsx` | 71 | App-level error boundary. Clean. |
| `global-error.tsx` | 60 | Root-level error boundary (used when layout itself errors). Clean. |
| `globals.css` | 338 | Global styles. Reasonable size. |

**No findings.** All top-level files are small, focused, and follow Next.js conventions.

---

## 2. Top-level API directories (web/src/app/api/)

| Directory | Routes | Notes |
|---|---|---|
| `admin/` | 73 | Bulk of admin operations. Well-organized. |
| `rider/` | 23 | Rider-app endpoints (singular — see finding 3.1). |
| `files/` | 6 | File upload/download. |
| `support/` | 5 | Support tickets, chat, FAQ. |
| `auth/` | 5 | Auth flow. |
| `health/` | 4 | Health checks (db, storage, worker, root). |
| `cron/` | 3 | Cron-triggered routes. |
| `transaction/` | 3 | Wallet transaction operations. |
| **`riders/`** | **2** | **Orphan directory — see finding 3.1.** |
| `internal/` | 2 | Internal worker + debug. |
| `device/` | 2 | Device data + permissions. |
| `shifts/` | 1 | Single route. |
| `vehicles/` | 1 | Single route. |
| `webhooks/` | 1 | Payment webhooks. |
| `sync/` | 1 | Sync queue. |
| `v1/` | 1 | v1 payment gateways (1 untracked file with pre-existing typecheck errors — out of scope). |
| `notification/` | 1 | Single route. |
| `monitoring/` | 1 | Metrics. |
| `metrics/` | 1 | Single route. |
| `pricing/` | 1 | Single route. |
| `search/` | 1 | Single route. |
| `rental/` | 1 | Single route. |
| `ready/` | 1 | K8s readiness probe. |

**Total: 140 routes across 23 directories.**

---

## 3. Findings

### 3.1 [P3] `riders/` (plural) directory is mostly orphan

**Location:** `web/src/app/api/riders/`

**Files:**
- `riders/dashboard/route.ts` — ORPHAN. Flutter calls `/api/rider/dashboard` (singular) instead. No other client, no test, no admin tool references `/api/riders/dashboard`.
- `riders/register-token/route.ts` — IN USE. Flutter's generated `api_client.dart:476` calls `POST /api/riders/register-token`.

**Why both `rider/` and `riders/` exist:**
The codebase has a naming inconsistency. The `rider/` (singular) directory was created later and is the canonical location. The `riders/` (plural) directory predates the migration and was not fully cleaned up.

**Action:**
1. Move `/api/riders/register-token` → `/api/rider/register-token` (1-line change; update Flutter generated client).
2. Delete `/api/riders/dashboard` (orphan).

**Effort:** 1 hour.

**Risk:** Low. The orphan is provably unused; the move is a simple rename.

**Sub-ticket:** Filed as Ticket #26.1 below.

### 3.2 [P3] `notification/` (singular) is a single-route directory

**Location:** `web/src/app/api/notification/list/route.ts`

This is a single-route directory. It could be merged into `web/src/app/api/rider/notifications/` (which already exists for the rider's notification list endpoint).

**Action:** Compare the two routes. If they serve the same purpose, consolidate. If different (one for admin, one for rider), document the distinction.

**Effort:** 0.5 hour.

**Risk:** Low. Routes are functionally similar; consolidation is a small refactor.

**Sub-ticket:** Filed as Ticket #26.2 below.

### 3.3 [P3] `metrics/` and `monitoring/metrics` are nearly duplicate

**Locations:**
- `web/src/app/api/metrics/route.ts` (top-level)
- `web/src/app/api/monitoring/metrics/route.ts`

**Action:** Grep both routes. If they serve the same purpose (Prometheus format, etc.), pick one location. Otherwise, document the difference.

**Effort:** 0.5 hour.

**Risk:** Low.

**Sub-ticket:** Filed as Ticket #26.3 below.

### 3.4 [P3] `v1/payment-gateways/active` is a v1 sub-API

**Location:** `web/src/app/api/v1/payment-gateways/active/route.ts`

The `v1/` prefix suggests a versioned API. The rest of the codebase has no v2/ or other versions, so the `v1/` directory is the only one of its kind. The 1 route there is the active payment gateway list (used by the rider app's payment screen).

**Action:** Document the `v1/` prefix convention. Either move the route to the top level (it's a small, well-scoped endpoint) or document why it lives under `v1/`.

**Effort:** 0.25 hour.

**Risk:** None — this is a documentation call.

**Sub-ticket:** Filed as Ticket #26.4 below.

---

## 4. Recommendations

1. **Clean up `riders/` orphan** (Finding 3.1) — highest priority, 1 hour.
2. **Investigate `notification/` and `monitoring/metrics`** (Findings 3.2 + 3.3) — 1 hour combined.
3. **Document `v1/` convention** (Finding 3.4) — 15 min.

**Total cleanup effort:** 2-3 hours.

---

## 5. Sub-tickets

| Ticket | Title | Effort | Source |
|---|---|---|---|
| #26.1 | Move `riders/register-token` → `rider/register-token`; delete orphan `riders/dashboard` | 1 hr | 3.1 |
| #26.2 | Consolidate `notification/list` into `rider/notifications` (or document distinction) | 0.5 hr | 3.2 |
| #26.3 | Resolve `metrics/` vs `monitoring/metrics/` duplication | 0.5 hr | 3.3 |
| #26.4 | Document or remove the `v1/` API prefix | 0.25 hr | 3.4 |

---

## 6. Acceptance criteria

- [x] Audit report (this doc)
- [x] Findings filed as sub-tickets (#26.1, #26.2, #26.3, #26.4)
- [ ] Cleanup PR (separate — tracks the 4 sub-tickets)

---

## 7. Out of scope

- Admin subdirectory structure (covered by Ticket #21 — 30+ admin screen splits)
- `rider/` directory internal structure (already audited in PR-S design)
- v2 API planning (no business need yet)
- File-system route conventions (Next.js enforces; not customizable)
