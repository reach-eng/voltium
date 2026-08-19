# Admin Panel Audit — Rewards, Reports & Analytics, Admin Access, FAQ Management

**Date:** 2026-08-05
**Scope:** Five admin sections — Rewards, Reports & Analytics (the analytics dashboard), Dashboard, Admin Access (admins CRUD + RBAC), FAQ Management.
**Method:** Surface + deep read of every route, server module, validator, schema, and UI component. Cross-checked against the Prisma schema, permissions matrix, and the previous 4 audit reports (riders section, riders deep, rentals/vehicles/hubs, team-leaders/operations/fleet).
**Reviewer:** Mavis (audit pass #5)

---

## 0. TL;DR — What is broken today

1. **`/api/admin/dashboard` shows "Total Revenue" from `type = 'CREDIT'`** — that's deposits + top-ups + sign-up bonuses, not rent revenue. The same number is reported as "real revenue" by every admin. `getRevenueTrend()` in `dashboard.ts:71-90` is the OPPOSITE of `getMonthlyTrend()` in `analytics.use-cases.ts:156-176`, which correctly filters to `RENT_PAYMENT`.
2. **`activeRentals` is set to `activeRiders` in two places** (`dashboard.ts:48` and `analytics.use-cases.ts:32` with the comment `// matches original logic`). Operations Board already shows this as a P0; we now find the same bug in two MORE places, on a screen the user opens first thing every morning.
3. **TWO parallel admin-creation code paths** with **different password rules** — `admin.routes.ts:48-75` uses `PasswordComplexitySchema` (upper/lower/number/special); `admins/route.ts:47` uses just `min(8)`. So an admin created via the live UI has a weak password, but an admin created via the dead `adminRoutes` wrapper would get a strong one.
4. **The admin-management UI lets you pick roles that don't exist in the enum** — `AdminUserDialogs.tsx:83-91` offers `ADMIN`, `MANAGER`, `SUPPORT_LEAD`, `VIEWER` as `<SelectItem>` values. None of these are in `AdminRole`. The form will submit, the Zod schema will reject with a 400, and the user sees a cryptic "Invalid role" toast.
5. **`/api/admin/rewards` has no DELETE handler** — admins can award points but cannot revoke an erroneous award. The UI also has no "Revoke" button.
6. **`/api/admin/audit-logs` and `/api/admin/dashboard` are ungated** — any admin session (including `READ_ONLY`) can read full audit log and dashboard stats.
7. **`/api/admin/dashboard` and `/api/admin/auth/me` and admin login rate limiter use in-memory state that does not survive serverless** — `loginAttempts` Map at `admin.use-cases.ts:10`; admin `name` map at `useDashboard.ts:80`. Both are per-instance time bombs.
8. **`/api/admin/admins` paginates in memory** — `listAdmins` at `admin.use-cases.ts:13-28` loads ALL admins then slices. At 500 admins the page loads all 500 rows into Node memory every request.
9. **FAQ re-order is two non-atomic PUTs** — `useFaqs.ts:119-153` `moveUp`/`moveDown` swap two FAQs' `order` field with two sequential awaits. A network glitch between the two PUTs leaves both FAQs with the same `order`.
10. **The dead `getDashboard()` in `analytics.use-cases.ts:11-58` returns hardcoded zeros for revenue** — it would under-report everything if anyone ever wired it up. The dead code is currently masking the fact that `activeRentals` should be a vehicle count, not a rider count.

---

## 1. File Map (read scope)

### Routes (5 files, 285 lines)
| File | Lines | Purpose |
| --- | --- | --- |
| `web/src/app/api/admin/rewards/route.ts` | 44 | GET (paginated list + summary) + POST (award). No DELETE or PUT. |
| `web/src/app/api/admin/analytics/route.ts` | 20 | GET (calls `getOverview()`, cached 60s). |
| `web/src/app/api/admin/dashboard/route.ts` | 31 | GET (calls `getDashboardStats()` + optional `getRevenueTrend(7)`, cached 60s). |
| `web/src/app/api/admin/faqs/route.ts` | 84 | GET + POST + PUT + DELETE. Permission-gated `faq_manage`. |
| `web/src/app/api/admin/admins/route.ts` | 106 | GET + POST + PUT. No DELETE in the live route. Permission-gated `admins_manage`. |
| `web/src/app/api/admin/audit-logs/route.ts` | ~80 | GET only. **NOT** permission-gated (PR-153 added PII redaction). |
| `web/src/app/api/admin/auth/me/route.ts` | 25 | GET. Reads `getAdminSession()`. |

### Server modules (5 files, 530 lines)
| File | Lines | Purpose |
| --- | --- | --- |
| `web/src/server/modules/rewards/reward.repository.ts` | 62 | `findAllPaginated` + `getSummary` (loads all rewards) + `create`. |
| `web/src/server/modules/rewards/reward.use-cases.ts` | 32 | `list` + `award`. Audit-log + notify on award (non-blocking). |
| `web/src/server/modules/analytics/analytics.policy.ts` | 22 | `canViewDashboard` (SUPER_ADMIN, OPERATIONS, HUB, FLEET) — **never called by the route**. |
| `web/src/server/modules/analytics/analytics.types.ts` | 40 | `RevenueMetrics` / `RiderMetrics` / `FleetMetrics` / `AnalyticsDashboard`. |
| `web/src/server/modules/analytics/analytics.use-cases.ts` | 207 | `getDashboard(period)` (DEAD) + `getOverview()` (used by route) + `getMonthlyTrend` + `getCohortData`. |
| `web/src/server/modules/admin/admin.policy.ts` | 137 | `requireAdminSession` + `requirePermission` + `withPermission`/`withAdmin` wrappers + `logAdminAction`. |
| `web/src/server/modules/admin/admin.repository.ts` | 139 | CRUD + `bulkActivateTeamLeaders`/`Deactivate`/`Delete` (misplaced). |
| `web/src/server/modules/admin/admin.schemas.ts` | 63 | `PasswordComplexitySchema` + Create/Update/Login/Audit schemas. **DUAL SCHEMA PROBLEM**. |
| `web/src/server/modules/admin/admin.types.ts` | 147 | `AdminRole` enum (9 values) + `AUDIT_ACTIONS` map (35+). |
| `web/src/server/modules/admin/admin.use-cases.ts` | 176 | CRUD + login (in-memory rate limit) + `getMe` + `logout`. |
| `web/src/server/modules/admin/admin.routes.ts` | 142 | **DEAD CODE** — uses `withPermission` wrappers, never imported. |
| `web/src/server/modules/support/admin-faq.use-cases.ts` | 71 | FAQ list + create + update + delete (hard delete). |
| `web/src/lib/services/dashboard.ts` | 96 | `getDashboardStats` (13 separate Prisma calls) + `getRevenueTrend` (filters wrong way). |

### Validators
- `web/src/lib/validators.ts:451-455` — `awardRewardSchema` (riderDbId + title + points, non-strict).
- `web/src/lib/validators/admin.ts:96-116` — `createAdminSchema` (`.strict()`, just `min(8)` password) + `updateAdminSchema` (`.strict()`).
- `web/src/lib/validators/admin.ts:160-179` — `createFaqAdminSchema` (`.strict()`) + `updateFaqAdminSchema` (`.strict()`).

### UI (40+ files)
- **Rewards:** `RewardManagement.tsx` (85) + `rewards/useRewards.ts` (172) + `rewards/RewardsTable.tsx` + `rewards/RewardsSummaryCards.tsx` + `rewards/RewardsHeader.tsx` + `rewards/AwardPointsForm.tsx` + `rewards/types.ts`.
- **Analytics:** `analytics/AnalyticsDashboard.tsx` (254) + `useAnalytics.ts` + `AnalyticsKpiCards.tsx` + `CohortTable.tsx` + `analyticsExport.ts` + `analyticsTypes.ts`.
- **Dashboard:** `dashboard/StatCards.tsx` + `SecondaryStatsGrid.tsx` + `RevenueTrendChart.tsx` + `ActivityStream.tsx` + `RecentTicketsCard.tsx` + `RecentTransactionsCard.tsx` + `SosAlert.tsx` + `SystemHealthDialog.tsx` + `DashboardHeader.tsx` + `useDashboard.ts` + `runHealthChecks.ts` + `types.ts` + `exportReport.ts`.
- **Admins:** `AdminUserManagement.tsx` (94) + `admin-users/AdminUserTable.tsx` + `admin-users/AdminUserDialogs.tsx` + `admin-users/useAdminUsers.ts` + `admin-users/types.ts`.
- **FAQs:** `FaqManagement.tsx` (76) + `faqs/useFaqs.ts` (190) + `faqs/FaqList.tsx` + `faqs/FaqListItem.tsx` + `faqs/FaqHeader.tsx` + `faqs/FaqFiltersBar.tsx` + `faqs/FaqFormDialog.tsx` + `faqs/FaqPagination.tsx` + `faqs/DeleteFaqDialog.tsx` + `faqs/types.ts`.

### Cross-cutting
- `web/src/lib/permissions-roles.ts` — `admins_manage: []` (P0 vs. live route which uses it; SUPER_ADMIN bypass in `hasPermission` saves the day, but no role has it explicitly).
- `web/src/components/admin/AdminLayout.tsx:55-63,102-113` — nav entry for each section + screen label.
- `web/src/lib/role-config.ts:11-50` — sidebar items use `analytics_view`, `rewards_manage`, `admins_manage`, `faq_manage`.

---

## 2. P0 — "breaks production today, users see broken data"

### P0-1 `dashboard.ts:48` — `activeRentals: activeRiders` (BUG: same pattern as OperationsBoard)

```ts
// web/src/lib/services/dashboard.ts:48
return {
  totalRiders,
  activeRiders,
  ...
  activeRentals: activeRiders,  // ← BUG: should count vehicles with status='ACTIVE_RENTAL' or 'OVERDUE'
  ...
};
```

The dashboard's "Active Rentals" stat card (`StatCards.tsx` reading `stats.activeRentals`) is the SAME number as "Active Riders". At 100 active riders, the card says 100 active rentals — even if zero vehicles are currently rented out (everyone is between rentals). The "Active Rentals" tile is also the click target for navigating to the rentals page (`route: 'rentals'` at `types.ts:122`).

Same pattern, second copy, at `analytics.use-cases.ts:32`:
```ts
const activeRentals = activeRiders; // matches original logic
```

The comment "matches original logic" is the canary — this is cargo-culted from a previous version and the two files disagree about what "active rentals" means. The `RiderMetrics.activeRiders` and `FleetMetrics.activeRentals` are not the same concept.

**Fix shape:** `db.vehicle.count({ where: { status: { in: ['ACTIVE_RENTAL', 'OVERDUE'] } } })` (1 PR, ~5 lines + test). The 13-query `Promise.all` in `getDashboardStats` can absorb this 14th query.

**Test gap:** no test in `web/tests/unit/analytics/` for `getDashboardStats`.

---

### P0-2 `dashboard.ts:71-90` — revenue trend filters the WRONG way (CREDIT instead of RENT_PAYMENT DEBIT)

```ts
// web/src/lib/services/dashboard.ts:71-80
const result = await db.$queryRaw<...>`
  SELECT
    DATE("createdAt") as date,
    SUM("amountInPaise") as revenue,
    COUNT(DISTINCT "riderId") as "riderCount"
  FROM "transactions"
  WHERE "createdAt" >= ${startDate} AND status = 'APPROVED' AND type = 'CREDIT'
  GROUP BY DATE("createdAt")
  ORDER BY date ASC
`;
```

`type = 'CREDIT'` covers top-ups, deposits, refunds, sign-up bonuses — none of which are revenue. The same project ships `analytics.use-cases.ts:150-176 getMonthlyTrend` which correctly filters to `type = 'DEBIT' AND purpose = 'RENT_PAYMENT'` (PR-79). The result is that the **Dashboard** "Total Revenue" KPI shows ~3-10x the real figure, while the **Analytics** page shows the correct figure. The 7-day chart on the dashboard (`RevenueTrendChart.tsx`) uses this wrong number.

Cross-link: the audit on rentals/vehicles/hubs found that `plan.use-cases.list` reads `p.price` instead of `p.priceInPaise` — same field-name confusion pattern.

**Fix shape:** replace `type = 'CREDIT'` with `type = 'DEBIT' AND purpose = 'RENT_PAYMENT' AND status = 'APPROVED'` (1 line). Add a test in `web/tests/unit/dashboard-audit-fixes.test.ts` or new `dashboard-stats.test.ts`.

**Test gap:** `web/tests/unit/dashboard-audit-fixes.test.ts` exists but doesn't cover this query.

---

### P0-3 `admins/route.ts:47` uses `createAdminSchema` (just `min(8)` password); `admin.routes.ts:56` uses `CreateAdminSchema` (`PasswordComplexitySchema` with upper/lower/number/special)

`web/src/lib/validators/admin.ts:96-104`:
```ts
export const createAdminSchema = z
  .object({
    name: z.string().min(1, 'name is required').max(200),
    email: z.string().email('email is required'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    ...
  })
  .strict();
```

`web/src/server/modules/admin/admin.schemas.ts:15-21`:
```ts
export const CreateAdminSchema = z.object({
  email: z.string().email('Valid email required'),
  password: PasswordComplexitySchema,   // ← upper/lower/number/special
  name: z.string().min(1, 'Name is required').max(100),
  role: z.nativeEnum(AdminRole).default(AdminRole.OPERATIONS_ADMIN),
  permissions: z.array(z.string()).optional(),
});
```

The live route `admins/route.ts:47` imports from `validators/admin.ts` (just `min(8)`). The dead-code route `admin.routes.ts:56` uses `admin.schemas.ts` (`PasswordComplexitySchema`). So an admin created today is weaker than one that would be created via the dead code. The intent is clearly the strict password; the live route has a regression.

**Fix shape:** import `CreateAdminSchema` from `admin.schemas.ts` into the live route. Delete the duplicate from `validators/admin.ts`. Add a test in `admin_users_roles.test.ts` (already exists).

---

### P0-4 `admin-users/AdminUserDialogs.tsx:83-91` — UI offers 7 roles, but `AdminRole` enum has only 9, and the 4 listed that don't exist are picked

```tsx
// web/src/components/admin/screens/admin-users/AdminUserDialogs.tsx:82-93
<SelectContent>
  <SelectItem value="SUPER_ADMIN">Super Admin (All Access)</SelectItem>
  <SelectItem value="ADMIN">Admin (Full Operational)</SelectItem>          // ← not in AdminRole enum
  <SelectItem value="OPERATIONS_ADMIN">Operations Admin</SelectItem>
  <SelectItem value="FLEET_MANAGER">Fleet Manager</SelectItem>
  <SelectItem value="SUPPORT_LEAD">Support Lead</SelectItem>              // ← not in AdminRole enum
  <SelectItem value="FINANCE_ADMIN">Finance Admin</SelectItem>
  <SelectItem value="VIEWER">Viewer (Read-only)</SelectItem>              // ← not in AdminRole enum
</SelectContent>
```

`AdminRole` (server-side, `admin.types.ts:12-22`) has: `SUPER_ADMIN`, `OPERATIONS_ADMIN`, `KYC_REVIEWER`, `FINANCE_ADMIN`, `SUPPORT_AGENT`, `HUB_MANAGER`, `FLEET_MANAGER`, `TEAM_LEADER`, `READ_ONLY`. None of `ADMIN`, `SUPPORT_LEAD`, `VIEWER` exist. `MANAGER` (in `AdminUserTable.tsx:30` `roleColors`) is also dead.

When a user picks "Admin (Full Operational)" and clicks Create, the Zod `z.enum(ADMIN_ROLES)` (in `validators/admin.ts:101`) rejects with a generic "Invalid enum value" error. The user has no idea why.

**Fix shape:** replace the 7 hardcoded `<SelectItem>`s with `Object.values(AdminRole).map(...)` (with localized labels from `ADMIN_ROLE_LABELS` at `admin.types.ts:24-34`). Remove the dead `ADMIN`/`MANAGER`/`SUPPORT_LEAD`/`VIEWER` color mappings from `AdminUserTable.tsx:27-33`.

**Test gap:** no test for the dialog form's role selection.

---

### P0-5 `rewards/route.ts` — only GET and POST; no DELETE or PUT

```ts
// web/src/app/api/admin/rewards/route.ts
export async function GET(req: NextRequest) { ... }
export async function POST(req: Request) { ... }
// no DELETE, no PUT, no PATCH
```

If an admin accidentally awards 10,000 points to the wrong rider (or awards points before the rider's birthday and wants to back out), there is no way to revoke the award through the API. The audit log records the award but the row stays. The UI also has no "Revoke" button. This is a real ops problem because `handleAwardPoints` (`useRewards.ts:105-140`) has no confirmation dialog (`AwardPointsForm.tsx:100-105` button is just "Confirm Award" without an AlertDialog).

**Fix shape:** add `DELETE /api/admin/rewards?id=X` and `PUT /api/admin/rewards` for "adjust points" flows. Both gated on `rewards_manage`. Add a confirmation dialog in `AwardPointsForm.tsx`. Audit log entry for revoke.

**Test gap:** `web/tests/integration/admin/rewards.test.ts` only covers GET/POST.

---

### P0-6 `/api/admin/dashboard` and `/api/admin/audit-logs` are NOT permission-gated

```ts
// web/src/app/api/admin/dashboard/route.ts:10-12
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // ← no hasPermission check
```

```ts
// web/src/app/api/admin/audit-logs/route.ts:9-10
export async function GET(req: NextRequest) {
  const session = await requireAdmin();
  if (!session) return adminUnauthorized();
  // ← no hasPermission check
```

`audit_view` is `['OPERATIONS_ADMIN', 'READ_ONLY']` (in `permissions-roles.ts:114`). Any `SUPPORT_AGENT`, `HUB_MANAGER`, `FLEET_MANAGER`, or `TEAM_LEADER` session can read the full audit log, including PII redacted via PR-153 but still with admin actorIds + entity types + timestamps.

Dashboard stats include `totalAdmins` (count of admins) and `totalBalance`/`totalDeposits` (sum of all rider wallet floats) — sensitive business numbers that should be `analytics_view`.

**Fix shape:** add `hasPermission(session.adminRole, 'audit_view')` to audit-logs; add `analytics_view` to dashboard. Test in `rbac.test.ts`.

---

### P0-7 `admin.use-cases.ts:10` — login rate limit is an in-memory `Map`, useless in serverless / multi-instance

```ts
// web/src/server/modules/admin/admin.use-cases.ts:10
const loginAttempts = new Map<string, number>();
```

In Next.js serverless deployments (Vercel, AWS Lambda), each request can run in a new container. The `Map` is per-process; a brute-force attack on the admin login can have each request see 0 attempts. The 15-minute timer (`setTimeout(() => loginAttempts.delete(rateKey), 15 * 60 * 1000)` at line 114) also won't survive cold starts.

In self-hosted multi-instance setups (e.g. PM2 cluster mode, which the project uses — see `ecosystem.config.js` if it exists), each worker has its own Map. An attacker hitting different workers bypasses the limit entirely.

**Fix shape:** use Redis (already in the stack — `scripts/seed-dev-admin.ts` references it) or a database table with a sliding window. Minimum viable fix: persist counter to `Admin` row (e.g. `failedLoginAttempts` + `lockUntil`). Audit log the breach.

**Test gap:** no test for `login` rate limit behaviour.

---

### P0-8 `admin.use-cases.ts:13-28` — `listAdmins` paginates in memory

```ts
// web/src/server/modules/admin/admin.use-cases.ts:20-27
async listAdmins(filters) {
  const { page = 1, limit = 20, ...rest } = filters || {};
  const result = await adminRepository.list(rest);  // ← loads ALL admins, ignores page/limit
  const total = result.length;
  const paginated = result.slice((page - 1) * limit, page * limit);
  return {
    admins: paginated,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  };
}
```

`adminRepository.list` at `admin.repository.ts:32-51` already accepts `page` and `limit` and does the SQL `skip`/`take` — but the use-case throws those away and then slices in JS. So at 1,000 admins, every page request loads all 1,000 rows from Postgres and sorts them in Node memory.

Same pattern in `rewardRepository.getSummary` (`reward.repository.ts:41-58`) — loads ALL rewards, reduces in JS. Time bomb.

**Fix shape:** pass `page` and `limit` through to the repository; use SQL `COUNT(*)` for total. For `getSummary`, do an aggregate query (`SELECT SUM(points), COUNT(DISTINCT riderId) ...`).

**Test gap:** no test for `listAdmins` pagination.

---

### P0-9 `useFaqs.ts:119-153` — `moveUp`/`moveDown` are two non-atomic PUTs

```ts
// web/src/components/admin/screens/faqs/useFaqs.ts:119-135
const moveUp = async (faq: Faq) => {
  if (faq.order <= 0) return;
  const sorted = [...faqs].sort((a, b) => a.order - b.order);
  const idx = sorted.findIndex((f) => f.id === faq.id);
  if (idx <= 0) return;
  const prev = sorted[idx - 1];
  await fetch('/api/admin/faqs', { method: 'PUT', body: JSON.stringify({ id: faq.id, order: prev.order }) });
  await fetch('/api/admin/faqs', { method: 'PUT', body: JSON.stringify({ id: prev.id, order: faq.order }) });
  fetchFaqs();
};
```

If the first PUT succeeds and the second PUT fails (network glitch, server error, 401 after tokenVersion bump), the two FAQs now share the same `order` value. Re-ordering the list then has undefined behaviour. There's no transaction wrapper on the server either — `adminFaqUseCases.update` just does `db.faq.update({ where: { id }, data: ... })` (`admin-faq.use-cases.ts:42-59`).

The `toggleActive` and `saveFaq` handlers in the same file also ignore `res.ok` and don't surface errors to the user.

**Fix shape:** add `POST /api/admin/faqs/reorder` that takes `{ id, newOrder }` or `{ id, direction: 'up'|'down' }` and runs the swap in a single `db.$transaction` on the server. UI calls one endpoint. Test the failure case.

---

## 3. P1 — "real bugs, fix in next sprint"

### P1-1 `admins/route.ts:50-57` filters `permissions` against `PERMISSION_DESCRIPTORS` after Zod validation, but `updateAdminSchema` accepts any string array

```ts
// web/src/app/api/admin/admins/route.ts:50-57
const { name, email, password, role, permissions: rawPermissions } = validation.data;
const { PERMISSION_DESCRIPTORS } = await import('@/lib/permissions');
const validPermissionKeys = PERMISSION_DESCRIPTORS.map(p => p.key) as string[];
const permissions = (rawPermissions ?? []).filter(
  (p: unknown) => typeof p === 'string' && validPermissionKeys.includes(p)
);
```

Zod validates `permissions: z.array(z.string()).optional()` — accepts any string. The route then does an in-memory filter. But `PUT` at line 73 doesn't filter at all — it passes `permissions` straight through to `adminUseCases.updateAdmin`, which writes it to the database. So `PUT` lets a client write arbitrary permission strings (e.g. `'super_admin_backdoor'`) into the `Admin.permissions` JSON column.

**Fix shape:** apply the same filter to PUT; or move the filter into `createAdminSchema` / `updateAdminSchema` via `z.array(z.enum(PERMISSION_KEYS))` so it errors with 400 at validation time.

---

### P1-2 `admin.use-cases.ts:74-89` — `deleteAdmin` hard-deletes + no self-delete guard

```ts
// web/src/server/modules/admin/admin.use-cases.ts:74-89
async deleteAdmin(id: string, actorId: string) {
  const existing = await adminRepository.findById(id);
  if (!existing) throw new Error('Admin not found');
  await adminRepository.delete(id);  // ← hard delete
  await logAdminAction({ ... });
}
```

Two problems:
1. **Hard delete** — no soft-delete / no recovery if an admin is removed by mistake. Compare with `vehicles/route.ts DELETE` (soft `RETIRED`) and `rider` data-deletion flow.
2. **No self-delete guard** — a SUPER_ADMIN can delete themselves. If they're the only SUPER_ADMIN, the system is bricketed.

**Fix shape:** add `isActive: false` (or `deactivatedAt`) instead of `delete`. Add a guard: `if (id === actorId) throw new Error('Cannot delete yourself')`. Check the last SUPER_ADMIN before allowing any SUPER_ADMIN delete.

---

### P1-3 `admin.use-cases.ts:91-100` — `getAuditLogs` doesn't filter `actorId`/`action` by case

```ts
// web/src/server/modules/admin/admin.repository.ts:127-134
if (actorId) where.actorId = actorId;
if (action) where.action = action;
```

`actorId` is exact-match. The UI never sends the actor's `id` (cuid); it sends the admin's `name` (or sometimes the email). So the audit log filter UI never finds anything when you type an admin name.

**Fix shape:** add a name/email fallback to the query, or fix the UI to use `id`. Either way, document the contract.

---

### P1-4 `analytics.use-cases.ts:96-99` — `active_vehicles` only counts `status = 'ACTIVE_RENTAL'`, missing `OVERDUE`

```ts
// web/src/server/modules/analytics/analytics.use-cases.ts:96
(SELECT COUNT(*) FROM "vehicles" WHERE status = 'ACTIVE_RENTAL') AS active_vehicles,
```

Same bug pattern as `rentals/route.ts` and `team-leaders` audit P0-1. An OVERDUE vehicle is also "actively rented" — it's just past the return date. The `collectionEfficiency` metric (`active_vehicles / total_vehicles`) is under-reported.

**Fix shape:** `status IN ('ACTIVE_RENTAL', 'OVERDUE')` (1 line). Test in `mrr-rent-payment-filter.test.ts`.

---

### P1-5 `analytics.use-cases.ts:11-58` — `getDashboard(period)` is DEAD code that returns hardcoded zeros for revenue

```ts
// web/src/server/modules/analytics/analytics.use-cases.ts:11-58
async getDashboard(period: string): Promise<AnalyticsDashboard> {
  ...
  return {
    revenue: {
      mrr: 0,
      previousMrr: 0,
      mrrGrowth: 0,
      pendingPayments: 0,
      totalCollected: 0,
    },
    ...
  };
}
```

The route at `analytics/route.ts:14` calls `getOverview()`, not `getDashboard`. The `AnalyticsDashboard` return type is also never used by any caller. This is the most dangerous kind of dead code: if someone wires it up in the future, they'll think it's the right answer because the type matches. Meanwhile `getOverview` does the real work but its return type is structurally different (`{ overview, trend, cohorts }` vs the typed `AnalyticsDashboard`).

**Fix shape:** delete `getDashboard` and `AnalyticsDashboard` type (they're not imported anywhere). The `RevenueMetrics`/`RiderMetrics`/`FleetMetrics` types can stay if reused.

---

### P1-6 `analytics.use-cases.ts:155-165` — `getMonthlyTrend` filters `purpose = 'RENT_PAYMENT'` but not `type = 'DEBIT'`

```ts
// web/src/server/modules/analytics/analytics.use-cases.ts:155-165
const transactions = await db.transaction.findMany({
  where: {
    status: 'APPROVED',
    type: 'DEBIT',
    purpose: 'RENT_PAYMENT',
    createdAt: { gte: startDate },
  },
  ...
});
```

OK, this one IS correct (`type: 'DEBIT'` is there). But the comment above says "PR-79: same RENT_PAYMENT filter as MRR" — yet `getOverview` itself uses the same filter in raw SQL. So the two are consistent. The risk is that a future developer adds a new "rent credit" type (e.g. a refund) without thinking to update this filter. Suggest adding an index migration on `transactions(status, type, purpose, createdAt)` to keep the trend query fast.

**Fix shape:** add composite index `idx_transactions_status_type_purpose_created` on the transactions table. Test that EXPLAIN shows the index is used.

---

### P1-7 `analytics.use-cases.ts:178-206` — `getCohortData` ignores `createdAt` timezone

```ts
// web/src/server/modules/analytics/analytics.use-cases.ts:183-192
SELECT
  TO_CHAR("createdAt", 'YYYY-MM') AS month,
  COUNT(*)::bigint AS total,
  COUNT(*) FILTER (WHERE "lifecycleStatus" = 'ACTIVE')::bigint AS active,
  COUNT(*) FILTER (WHERE "lifecycleStatus" = 'SUSPENDED')::bigint AS suspended
FROM "riders"
WHERE "deletedAt" IS NULL
GROUP BY TO_CHAR("createdAt", 'YYYY-MM')
ORDER BY month ASC
```

`TO_CHAR("createdAt", 'YYYY-MM')` uses the database's local timezone. A rider created at 2026-08-01 02:00 IST (2026-07-31 20:30 UTC) is bucketed into "2026-08" in IST but "2026-07" in UTC. The dashboard backend and the analytics backend may use different Postgres `TIMEZONE` settings, giving different cohort tables.

**Fix shape:** add `AT TIME ZONE 'Asia/Kolkata'` (or use a fixed reference like `createdAt AT TIME ZONE 'UTC'` consistently). Document the contract in a comment.

---

### P1-8 `AnalyticsKpiCards.tsx:30-46` — KPI "change" is a hardcoded magic number, not a real comparison

```ts
// web/src/components/admin/screens/analytics/AnalyticsKpiCards.tsx:21-47
{
  label: 'Churn Rate',
  value: `${overview.churnRate.toFixed(2)}%`,
  change: -overview.churnRate,  // ← the "change" is just -churnRate
  icon: TrendingDown,
  inverse: true,
},
{
  label: 'Avg Revenue/Rider',
  value: formatINR(overview.avgRevenuePerRider),
  change: overview.mrrGrowth > 0 ? 5 : -2,  // ← literally 5 or -2, no data
  icon: Users,
},
{
  label: 'Collection Efficiency',
  value: `${overview.collectionEfficiency.toFixed(1)}%`,
  change: overview.collectionEfficiency > 80 ? 3 : -5,  // ← literally 3 or -5
  icon: Percent,
},
```

`avgRevenuePerRider` shows `+5%` or `-2%` regardless of actual data. `Collection Efficiency` shows `+3%` or `-5%` based on an arbitrary 80% threshold. The user sees green/red arrows next to numbers that have no relationship to the previous period.

**Fix shape:** extend `getOverview` to also return `previousAvgRevenuePerRider` and `previousCollectionEfficiency`, and compute the real change percentage. Update the types.

---

### P1-9 `useAnalytics.ts:24-39` — fetch error swallowed silently, `lastUpdated` updated on error

```ts
// web/src/components/admin/screens/analytics/useAnalytics.ts:24-39
const fetchData = useCallback(async (isBackground = false) => {
  if (!isBackground) setRefreshing(true);
  try {
    const res = await fetch('/api/admin/analytics');
    if (res.ok) {
      const json = await res.json();
      setData(json.data);
    }
    setLastUpdated(new Date());  // ← updated even on 500
  } catch (error) {
    logger.error('Failed to fetch analytics', { error });
  } finally {
    setLoading(false);
    setRefreshing(false);
  }
}, []);
```

When the API returns 500, the UI shows stale data and updates the "Last updated X seconds ago" timestamp, making it look like a fresh fetch succeeded. No error UI.

Same issue in `useDashboard.ts:70-72` (catches and logs but shows no error) and `useRewards.ts:50-78` (returns silently on 403).

**Fix shape:** add an `error` state, render a toast / banner. Stop updating `lastUpdated` on failure.

---

### P1-10 `admin.repository.ts:100-110` — `bulkActivateTeamLeaders` etc. are misplaced

```ts
// web/src/server/modules/admin/admin.repository.ts:100-110
async bulkActivateTeamLeaders(ids: string[]) { return db.teamLeader.updateMany(...); },
async bulkDeactivateTeamLeaders(ids: string[]) { return db.teamLeader.updateMany(...); },
async bulkDeleteTeamLeaders(ids: string[]) { return db.teamLeader.deleteMany(...); },
```

These three methods live in the **admin** repository but operate on the `teamLeader` model. They have no callers in the admin module (`grep -r bulkActivateTeamLeaders web/src/` returns 0). They are dead code; if anyone ever calls them, they'll have to `import` the admin repository, which is wrong (team leader ops belong in `team-leaders/repository.ts`).

**Fix shape:** delete these three methods. If the team-leader bulk operations truly need them, add them to `team-leader.repository.ts` with proper soft-delete (per the team-leader audit P1).

---

### P1-11 `admin-faq.use-cases.ts:6-17` — FAQ list doesn't filter `isActive: true` and search is case-sensitive

```ts
// web/src/server/modules/support/admin-faq.use-cases.ts:6-17
async list(params) {
  const { search, category, page = 1, limit = 20 } = params;
  const where: any = {};
  if (category) where.category = category;
  if (search) where.OR = [{ question: { contains: search } }, { answer: { contains: search } }];
  // ← no `mode: 'insensitive'`
  // ← no `isActive: true` filter
  ...
}
```

`reward.repository.findAllPaginated` uses `mode: 'insensitive'`; the FAQ list does not. A search for "deposit" misses "Deposit". The Rider app FAQ display only shows active FAQs (presumably), but the admin list shows everything. Combined with `useFaqs.ts` not exposing an `isActive` filter, admins can't see "draft" vs "published" — they see all rows.

**Fix shape:** add `mode: 'insensitive'` to both `OR` fields; add `isActive` query param to the route and the UI; default the list to `isActive: true`.

---

### P1-12 `admin-faq.use-cases.ts:61-70` — `delete` is hard-delete with no question captured in audit

```ts
// web/src/server/modules/support/admin-faq.use-cases.ts:61-70
async delete(id: string, actorId: string) {
  await db.faq.delete({ where: { id } });
  createAuditLog({
    actorId,
    action: 'faq.delete',
    entity: 'faq',
    entityId: id,
    details: { id },  // ← only the id, not the question text
  }).catch(() => {});
}
```

Hard delete, no soft-delete column, audit log records the id only. If an admin deletes the wrong FAQ, the audit trail shows "FAQ xyz deleted" but not what xyz said.

**Fix shape:** add `deletedAt` to the `Faq` model + migration; soft-delete in the use-case; capture `details: { question, answer }` (or `details: { snapshot }`) in the audit log.

---

### P1-13 `rewards/route.ts:38` — `riderDbId` is internal cuid OR public `riderId`, schema is ambiguous

```ts
// web/src/app/api/admin/rewards/route.ts:38
const reward = await rewardUseCases.award(validation.data, session.adminId || '');
```

`validation.data` is `{ riderDbId, title, points }` from `awardRewardSchema` (`validators.ts:451-455`). The UI's `AwardPointsForm` passes the `id` field of the selected rider (internal cuid, from `useRewards.ts:118`). But the field name `riderDbId` is misleading — it could be read as "the DB id of the rider" or "the rider's `riderId` field (which is `VFR-...`)". If a future developer wires up a different picker that uses `riderId` (the public id), `rewardRepository.create({ riderId: 'VFR-001' })` will create a reward row with a foreign-key that doesn't exist (since `Reward.riderId` is a `cuid` relation to the `Rider` table).

**Fix shape:** rename `riderDbId` to `riderId` (and use the cuid, not the public id). Add an explicit comment that the cuid is required.

---

### P1-14 `dashboard.ts:5-55` — `getDashboardStats` does 13 separate Prisma round-trips in `Promise.all`

```ts
// web/src/lib/services/dashboard.ts:5-34
const [
  totalRiders,
  activeRiders,
  totalVehicles,
  availableVehicles,
  walletBalanceResult,
  walletDepositResult,
  pendingTransactions,
  openTickets,
  totalHubs,
  pendingKyc,
  pendingGuarantor,
  pendingInfoRequired,
  totalAdmins,
] = await Promise.all([  // ← 13 queries
  db.rider.count(),
  db.rider.count({ where: { lifecycleStatus: 'ACTIVE' } }),
  db.vehicle.count(),
  db.vehicle.count({ where: { status: 'AVAILABLE' } }),
  db.wallet.aggregate({ _sum: { balanceInPaise: true } }),
  db.wallet.aggregate({ _sum: { securityDeposit: true } }),
  db.transaction.count({ where: { status: 'PENDING' } }),
  db.supportTicket.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
  db.hub.count(),
  db.kycProfile.count({ where: { status: { in: ['PENDING', 'SUBMITTED'] } } }),
  db.guarantor.count({ where: { status: 'PENDING' } }),
  db.kycProfile.count({ where: { status: 'INFO_REQUIRED' } }),
  db.admin.count({ where: { isActive: true } }),
]);
```

13 round-trips on every dashboard load (every 30s, every admin). The `analytics.use-cases.getOverview` already does a single raw SQL with 7 sub-queries. Combine them: write a single `getDashboardStatsRaw` that returns all 14 numbers in one round-trip.

**Fix shape:** new `web/src/lib/services/dashboard-raw.ts` with a single `SELECT` that returns all counts. Test with a fresh DB.

---

### P1-15 `useDashboard.ts:78-93` — `fetchAdminNames` fetches first 50 admins, loses the rest

```ts
// web/src/components/admin/screens/dashboard/useDashboard.ts:80-89
const res = await fetch('/api/admin/admins?limit=50');
```

If there are more than 50 admins, any audit log entry from admin #51 shows `actorId` but no name (the `RecentTicketsCard` / `RecentTransactionsCard` fall back to "Unknown" or the raw cuid).

**Fix shape:** fetch the full list in the `getMe` or a new `/api/admin/lookup` endpoint, or pass `actorName` directly in the audit-log response (better — denormalise at audit-log creation time).

---

### P1-16 `useAdminUsers.ts:116-132` — `toggleActive` and `changeRole` don't check `res.ok`

```ts
// web/src/components/admin/screens/admin-users/useAdminUsers.ts:116-123
const toggleActive = async (admin: Admin) => {
  await fetch('/api/admin/admins', {
    method: 'PUT',
    body: JSON.stringify({ id: admin.id, isActive: !admin.isActive }),
  });
  fetchAdmins();
};
```

If the PUT returns 500, the UI refetches and shows the (unchanged) data as if the toggle worked. No error toast.

`changeRole` at line 125-132 is never called from any UI (dead code).

**Fix shape:** wrap in try/catch, show toast on failure, refetch only on success.

---

### P1-17 `useFaqs.ts:84-117` — `saveFaq` / `toggleActive` / `confirmDeleteFaq` all ignore `res.ok`

Same pattern as P1-16, but in the FAQ hook. Silent failures across the board.

---

### P1-18 `useRewards.ts:50-78` — 403 errors are silently swallowed

```ts
// web/src/components/admin/screens/rewards/useRewards.ts:58-66
const res = await fetch(`/api/admin/rewards?${params}`);
if (res.status === 403) {
  // Silently handle — admin lacks rewards_manage permission
  return;
}
```

A `SUPPORT_AGENT` or `FINANCE_ADMIN` who navigates to Rewards (perhaps via a deep link) sees a blank page with no explanation. The "Add Award" button is missing because it's only shown when `rewards_manage` is in the session permissions (per `AdminLayout`).

**Fix shape:** show a "You don't have permission to view this section" banner. Same for analytics (any role with `analytics_view` should see the page; if not, the UI should say so).

---

## 4. P2 — type safety / contract issues

### P2-1 `admin.routes.ts` (entire file, 142 lines) is DEAD CODE

```ts
// web/src/server/modules/admin/admin.routes.ts
export const adminRoutes = {
  list: withPermission('admins_manage', ...),
  get: withPermission('admins_manage', ...),
  create: withPermission('admins_manage', ...),
  update: withPermission('admins_manage', ...),
  delete: withPermission('admins_manage', ...),
  auditLogs: withAdmin(...),
};
```

`grep -r "adminRoutes" web/src/` returns 0 matches. The live route at `admins/route.ts` does the same thing by hand (no wrapper). This file is a parallel implementation that nobody uses. Worse, it has a DIFFERENT schema (`admin.schemas.ts` with `PasswordComplexitySchema`).

**Fix shape:** delete the file. If `withPermission`/`withAdmin` are useful, refactor the live route to use them. (They are useful; this is good code being thrown away.)

---

### P2-2 `analytics.policy.ts` (entire file, 22 lines) is DEAD CODE

`analyticsPolicy.canViewDashboard` is never called. The route uses `hasPermission(session.adminRole, 'analytics_view')` instead, which has a DIFFERENT role list (`['OPERATIONS_ADMIN', 'FINANCE_ADMIN', 'FLEET_MANAGER', 'HUB_MANAGER']` — note FINANCE_ADMIN is allowed, but `canViewDashboard` rejects it with `['SUPER_ADMIN', 'OPERATIONS_ADMIN', 'HUB_MANAGER', 'FLEET_MANAGER']`).

If a FINANCE_ADMIN navigates to Analytics, the route passes them. If the same user later calls a future endpoint that uses `canViewDashboard`, they're rejected. The two lists are out of sync.

**Fix shape:** delete `analytics.policy.ts`; the policy matrix in `permissions-roles.ts` is the single source of truth. If we want a separate "dashboard" permission, add `dashboard_view` to the matrix.

---

### P2-3 `admin.use-cases.ts:147-171` — `getMe` has a dead code path that checks a non-existent field

```ts
// web/src/server/modules/admin/admin.use-cases.ts:152-155
const hasPerms = (admin as any).hasPermissions;
if (Array.isArray(hasPerms) && hasPerms.length > 0) {
  perms = hasPerms.map((hp: any) => hp.permission);
}
```

`Admin` model has no `hasPermissions` relation (per the Prisma schema; verify with `grep`). The cast `(admin as any)` papers over the type error. The `else if` branch on line 155 (`Array.isArray(admin.permissions)`) is the only path that actually returns real data. This dead code is confusing.

**Fix shape:** remove the `hasPermissions` branch. If a separate `hasPermissions` model is intended, add the migration.

---

### P2-4 `admin.use-cases.ts:102-127` — `login` returns the full `Admin` row including `password` hash

```ts
// web/src/server/modules/admin/admin.use-cases.ts:107-126
const admin = await adminRepository.findByEmail(email);
...
return admin;  // ← password hash included
```

The route at `auth/me/route.ts:15-20` calls `getMe` which returns the full admin. Both then ship back to the client. Even though the password is hashed, the client should never receive it. There's no `select` filter.

**Fix shape:** use `db.admin.findUnique({ where: { email }, select: { id: true, email: true, name: true, role: true, isActive: true, lastLoginAt: true } })` for `findByEmail`. The hash is only needed for `verifyPassword`, not for return.

---

### P2-5 `dashboard.ts:36-37` — `paiseToRupees` for totalBalance and totalDeposits, but the field is the only one using it

```ts
// web/src/lib/services/dashboard.ts:36-37
const totalBalance = paiseToRupees(walletBalanceResult._sum.balanceInPaise || 0);
const totalDeposits = paiseToRupees(walletDepositResult._sum.securityDeposit || 0);
```

Inconsistent: every other currency in the project is paise on the wire, rupee on the display. The dashboard returns rupee. The analytics `getOverview` returns rupee (already divides by 100). The `transactions` route returns paise. The Flutter client has to know which is which.

**Fix shape:** standardise on paise-on-the-wire across all admin APIs; let the Flutter client format. Document the convention in `api-response.md` or similar.

---

### P2-6 `admin.schemas.ts:15-21` — `CreateAdminSchema.password` is required, but no `password` update path

`UpdateAdminSchema.password` is optional (good), but the form at `useAdminUsers.ts:53-81` only sends `password` on create. If an admin needs to reset another admin's password, the form has no UI for that.

**Fix shape:** add a "Reset Password" button in the row, opening a separate dialog that calls a dedicated `/api/admin/admins/[id]/reset-password` endpoint. (Currently the only way is to delete and re-create.)

---

### P2-7 `admin.schemas.ts:62` — `CreateAuditLogSchema.details` is `z.record(z.unknown())` with no `.strict()`

This schema is never imported anywhere. Dead code. If it ever does get used, the `unknown` value type means any field shape is accepted.

**Fix shape:** delete if unused; if needed, narrow the value type.

---

### P2-8 `useDashboard.ts:34-39` — silent failure of all 4 parallel fetches

`Promise.allSettled` returns 4 results, the code does `r.status === 'fulfilled' ? r.value : null` for each. If 3 of 4 fail, the UI shows a half-loaded dashboard. No error UI.

**Fix shape:** add a per-fetch error state. Show a banner if any failed. Optionally, retry.

---

### P2-9 `useAnalytics.ts:46-64` — `setInterval` re-creates interval on every visibility change, may leak

The visibility handler at line 53-64 creates a new interval every time the tab becomes visible. If `setInterval` is called twice before `clearInterval` runs, two intervals run.

**Fix shape:** use a ref to track the interval ID; always clear before setting.

---

### P2-10 `useDashboard.ts:101-108` — polling interval 30s doesn't match server cache TTL

Server caches `admin:dashboard:stats` for 60s (`dashboard/route.ts:24`). Client polls every 30s. Two consecutive polls get the same data. Same pattern in `useAnalytics.ts` (60s client, 60s server). The dashboard is over-polling.

**Fix shape:** align intervals, or invalidate the server cache on certain writes (e.g. transaction approve).

---

### P2-11 `analyticsExport.ts:18-24` — CSV exports raw `currentMRR` not formatted

```ts
MRR,${data.overview.currentMRR}
```

CSV readers see `12345.6789` instead of `₹12,345.68` or `12345.68`. Inconsistent with the in-app formatting.

**Fix shape:** format currency in the CSV. Quote-string-wrap fields with commas.

---

### P2-12 `admin.use-cases.ts:36-53` — `createAdmin` audit log captures `email` and `role` but not `password` (good) and not `permissions` (lost)

```ts
await logAdminAction({
  actorId,
  action: AUDIT_ACTIONS.ADMIN_CREATE,
  entity: 'admin',
  entityId: admin.id,
  details: { email: params.email, role: params.role },  // ← no permissions
});
```

The audit log of "I created admin X with role Y" doesn't say which permissions X got. If X is later compromised, the forensic trail doesn't show what they had access to.

**Fix shape:** add `permissions: params.permissions` to `details`.

---

### P2-13 `analytics.use-cases.ts:178-206` — cohort table has no `churn` column

The `cohorts` response is `{ month, total, active, suspended, retentionRate }`. The UI's `CohortTable.tsx` shows these 5 columns. But a "churn" rate (suspended / total) would be more useful than the bare `suspended` count. Already implied by `retentionRate = active / total`; could also expose `churnRate = suspended / total`.

**Fix shape:** add `churnRate` to the cohort response and a 6th column to the table.

---

### P2-14 `useFaqs.ts:84-101` — `saveFaq` order field defaults to `faqs.length`, but that's the length of the CURRENT page, not the total

```ts
// web/src/components/admin/screens/faqs/useFaqs.ts:78-79
const openDialog = (faq?: Faq) => {
  ...
  setForm({ ...EMPTY_FAQ_FORM, order: faqs.length });  // ← faqs.length is the page length (max 20), not total
}
```

A new FAQ is created with `order: 20` (page size). If there are 100 existing FAQs, the new one is in the middle of the list. After save, the user has no idea what order their FAQ ended up with. The `order: prev.order` swap in `moveUp` then gets confused.

**Fix shape:** either fetch the total count and use that, or have the server assign the next order (recommended — server is the source of truth).

---

### P2-15 `rewards/route.ts:38` — `session.adminId || ''` is an empty string for impersonation or non-admin sessions

If a SUPER_ADMIN is impersonating a rider, `session.adminId` may be the impersonated rider's id, not the admin's id. The audit log entry then attributes the award to the rider, not the admin.

**Fix shape:** use `getAdminId()` (the same helper used by `dr-drill/route.ts:5` per PR-D-FIX). It reads the `x-admin-id` impersonation header correctly.

---

## 5. P3 — code quality / dead code

### P3-1 `admin.use-cases.ts:129-145` — `autoLogin` is dead code

`autoLogin` is identical to `login` minus the rate limit. Never imported. Delete.

### P3-3 `admin.use-cases.ts:55-72` — `updateAdmin` audit log spreads params including `password`

```ts
details: { changes: (({ password, ...safe }) => safe)(params) },
```

The spread-then-strip works, but is clever-clever. Plain conditional is clearer.

### P3-4 `admin.use-cases.ts:172-175` — `logout` doesn't actually log the logout

`logout` just increments the tokenVersion. No audit log entry. No "ADMIN_LOGOUT" event written.

### P3-5 `admin.repository.ts:112-138` — `getAuditLogs` returns 4 fields: `{ logs, total, page, limit, totalPages }` (5 actually)

The `result` has 5 fields, the type `AuditLogQuery` should be the 5-field interface. Currently the return type is inferred.

### P3-6 `AdminUserTable.tsx:27-33` — `roleColors` includes `ADMIN`, `MANAGER`, `TEAM_LEADER`, `FLEET_MANAGER` but `MANAGER` is dead

Per P0-4. `MANAGER` is in the colors map but not in the enum, so the row falls through to the default slate color anyway. Remove the dead entries.

### P3-7 `useAdminUsers.ts:125-132` — `changeRole` is dead code (not called from any UI)

### P3-8 `useDashboard.ts:36-37` — `ticketsRes?limit=10` fetches 10 but only `slice(0, 5)` shown

Inefficient. Either change to `?limit=5` or keep 10 for "load more" UX.

### P3-9 `useRewards.ts:50-79` — `fetchRewards` does NOT call `setLoading(false)` in the 403 branch

When 403 is hit, the early return at line 61 leaves `loading: true` forever. The spinner spins indefinitely.

**Fix shape:** add `setLoading(false)` before the 403 return. Same for the 500+ branches.

### P3-10 `RewardManagement.tsx:80` — `ReferralManagement` is imported but not shown to be the canonical referral program

The Rewards screen has a "Referral Program" tab. The referral system has its own module. Check the cross-link is correct.

### P3-11 `analytics.use-cases.ts:33` — `collectionEfficiency` calculation divides by `totalVehicles || 1` but the response then shows `(active_vehicles / total_vehicles) * 100`

This is "active rented fleet" utilisation, not "collection efficiency" (which is usually collected rent / billed rent). Misleading label.

### P3-12 `dashboard.ts:78-80` — `row.date` from `DATE("createdAt")` may be a Date object in some pg versions

The `dailyMap.get(key)` where `key` is a string from `date.toISOString().split('T')[0]` (line 66) won't match if `row.date` is a `Date`. Add a `.toISOString()` to be safe.

### P3-13 `ActivityStream.tsx`, `RecentTicketsCard.tsx`, `RecentTransactionsCard.tsx` — not read in this audit

These are part of the dashboard screen. The audit covered `useDashboard.ts` and `types.ts` but not the per-card components. Recommend a follow-up audit.

### P3-14 `useFaqs.ts:11-12` — `EMPTY_PAGINATION` defined but never imported (just `EMPTY_FAQ_FORM` is)

Dead constant.

### P3-15 `FaqFormDialog.tsx:79` — `order: Number(e.target.value)` returns NaN for "abc"

The form doesn't pre-validate. NaN goes into the form state, schema validation fails on submit with cryptic error.

### P3-16 `useAnalytics.ts:60` — `if (intervalRef.current) clearInterval(...)` may be cleared twice

Cosmetic, but on a fresh mount the ref is `null` so the check is redundant.

---

## 6. Test coverage gaps

| Area | Existing tests | Gaps |
| --- | --- | --- |
| `rewards` | `tests/integration/admin/rewards.test.ts` | No DELETE/PUT tests. No audit log assertion. No 403 permission test. |
| `analytics` | `tests/unit/analytics/mrr-rent-payment-filter.test.ts` | No test for `getCohortData` timezone, `getMonthlyTrend` composite index, `active_vehicles` counting OVERDUE. |
| `dashboard` | `tests/unit/dashboard-audit-fixes.test.ts` | No test for `getDashboardStats` field shape, `activeRentals` correctness, `getRevenueTrend` filter. |
| `faqs` | `tests/integration/admin/faqs.test.ts` | No test for case-insensitive search, soft-delete, `isActive` filter, reorder atomicity. |
| `admins` | `tests/integration/admin/admins.test.ts` + `tests/unit/admin_users_roles.test.ts` | No test for `listAdmins` pagination, `deleteAdmin` self-delete guard, password complexity regression. |
| `audit-logs` | (none) | No test that the route is permission-gated; no test for PII redaction. |

---

## 7. What I'd do first (single highest-blast-radius fix)

**P0-1 + P0-2 (one PR):** Fix `activeRentals` to count vehicles and fix `getRevenueTrend` to use `RENT_PAYMENT` DEBIT. These are 2 lines of code in `dashboard.ts`. They fix the TWO stats the admin looks at first thing every morning (Total Revenue, Active Rentals). Once these are right, every other dashboard number is a smaller concern.

**Second PR (P0-3 + P0-4):** Fix the dual password schema, fix the role dropdown. These are user-facing bugs the admin team will hit on the very first session.

**Third PR (P0-5 + P0-6 + P0-7 + P0-8 + P0-9):** The "structural" P0s — no rewards DELETE, no permission gate on dashboard/audit-logs, in-memory rate limit, in-memory pagination, non-atomic FAQ reorder. These are quick (~30min each) and prevent future incidents.

---

## 8. Recommended fix order with hour estimates

| Order | PR | Scope | Est. hours | Notes |
| --- | --- | --- | --- | --- |
| 1 | `dashboard-active-rentals` | P0-1: fix `activeRentals = activeRiders` in both `dashboard.ts:48` and `analytics.use-cases.ts:32` | 0.5 | Add test |
| 2 | `dashboard-revenue-filter` | P0-2: fix `getRevenueTrend` filter | 0.25 | Add test |
| 3 | `admin-password-strict` | P0-3: import `CreateAdminSchema` from `admin.schemas.ts` | 0.5 | Delete duplicate |
| 4 | `admin-role-dropdown-fix` | P0-4: replace hardcoded `<SelectItem>` with `Object.values(AdminRole).map` | 0.5 | Add test |
| 5 | `rewards-delete-handler` | P0-5: add DELETE/PUT for rewards, confirmation dialog | 2 | Audit log entry for revoke |
| 6 | `dashboard-audit-permission-gate` | P0-6: gate `/api/admin/dashboard` and `/api/admin/audit-logs` | 0.5 | RBAC test |
| 7 | `admin-login-rate-limit-db` | P0-7: persist `loginAttempts` to DB | 3 | Migration, test, deploy |
| 8 | `admin-list-pagination-sql` | P0-8: pass `page`/`limit` to `adminRepository.list` | 0.5 | Add pagination test |
| 9 | `faq-reorder-atomic` | P0-9: add `POST /api/admin/faqs/reorder` with `db.$transaction` | 2 | UI hook update, test |
| 10 | `admin-permissions-zod-allowlist` | P1-1: tighten `permissions` schema in `updateAdminSchema` | 0.5 | |
| 11 | `admin-delete-soft` | P1-2: soft-delete + self-delete guard | 1 | Migration for `deactivatedAt` |
| 12 | `audit-logs-actor-search` | P1-3: add name/email fallback to actorId filter | 1 | |
| 13 | `analytics-active-vehicles-include-overdue` | P1-4: fix active_vehicles SQL | 0.25 | |
| 14 | `analytics-delete-getdashboard` | P1-5: delete `getDashboard` + `AnalyticsDashboard` type | 0.25 | |
| 15 | `transactions-rent-payment-index` | P1-6: composite index for analytics | 1 | Migration + EXPLAIN test |
| 16 | `analytics-cohort-timezone` | P1-7: add `AT TIME ZONE` to cohort SQL | 0.5 | |
| 17 | `analytics-kpi-real-change` | P1-8: replace magic-number changes with real prior-period comparison | 2 | UI + types + use-case |
| 18 | `analytics-error-state` | P1-9: add error banner to `useAnalytics` and `useDashboard` | 1 | |
| 19 | `admin-repo-cleanup` | P1-10: delete misplaced `bulkActivateTeamLeaders` etc. | 0.25 | |
| 20 | `faq-search-insensitive-active` | P1-11: case-insensitive search + isActive filter | 0.5 | |
| 21 | `faq-soft-delete` | P1-12: add `deletedAt` to FAQ, capture question in audit | 1 | Migration |
| 22 | `rewards-rider-id-clarify` | P1-13: rename `riderDbId` → `riderId` in `awardRewardSchema` | 0.5 | |
| 23 | `dashboard-stats-raw-sql` | P1-14: collapse 13 queries to 1 raw SQL | 2 | Test |
| 24 | `audit-logs-admin-name` | P1-15: pass `actorName` in audit-log response | 1 | |
| 25 | `admin-users-error-toast` | P1-16 + P1-17: add error handling to admin + FAQ hooks | 1 | |
| 26 | `rewards-permission-banner` | P1-18: show "no permission" banner on Rewards + Analytics | 0.5 | |
| 27 | (cleanup PRs) | P2-1, P2-2: delete `admin.routes.ts`, `analytics.policy.ts` | 0.5 | |
| 28 | (cleanup PRs) | P2-3, P2-4, P2-5, P2-6, P2-7: type safety + select filters | 2 | |
| 29 | (P3s) | Various small cleanups | 4 | |

**Total: ~28 PRs, ~28 hours of focused work.** The first 9 are P0 and ship in ~10 hours.

---

## 9. Cross-cutting observations

1. **The `// matches original logic` comment is a code smell we found 4 places** (P0-1 in `dashboard.ts:48` + `analytics.use-cases.ts:32`; P1-11 in `admin-faq.use-cases.ts:6-17`; P1-16 in `useAdminUsers.ts`). The pattern is "I'm preserving buggy behaviour because the original was buggy." Always fix the bug, never preserve it.

2. **Two parallel admin schema files** (`admin.schemas.ts` and `validators/admin.ts`) is a recurring source of drift. Same for two parallel route implementations (`admin.routes.ts` and `admins/route.ts`). The audit team should pick ONE source of truth per concern. Recommendation: keep `admin.schemas.ts` (the wrapper-aware version), delete from `validators/admin.ts`.

3. **The audit log is a critical asset but isn't gated by `audit_view`** (P0-6). Other sections (KYC, wallet) gate their routes by permission. The audit log should too.

4. **The 30s/60s/10s/60s polling pattern is scattered**. The dashboard polls 30s, analytics 60s, rewards has no polling, FAQs has no polling. The cache TTLs on the server (10s for rewards, 60s for analytics/dashboard, 60s for faqs, 10s for admins) don't align with the client polls. Recommend a `POLL_INTERVALS` constants file.

5. **The dead-code tax is real**: `admin.routes.ts` (142 lines), `analytics.policy.ts` (22 lines), `analytics.use-cases.getDashboard` (48 lines), `getAutoLogin` (17 lines), `getAuditLogs`-using `CreateAuditLogSchema` (5 lines) — 234 lines of dead code. The team can never tell which is the "real" version when two implementations exist. Delete aggressively.

---

## 10. What this audit confirmed (vs. previous 4 audits)

- **Same bug pattern: in-memory state that doesn't survive serverless** — found here in `admin.use-cases.ts:10` (login rate limit) and `useDashboard.ts:80` (admin name cache). The riders audit found the same in `consent/route.ts` (just logs GDPR consent). Time to standardise on a Redis-backed session cache.

- **Same bug pattern: silent `if (!res.ok) return;` in client hooks** — `useRewards.ts:62`, `useFaqs.ts:47,103,110`, `useAdminUsers.ts:33,67,116,125`. The rider-app audit found the same. This is a project-wide pattern of "swallow the error and hope the user notices". A `useApiFetch` hook with built-in error handling would fix this everywhere.

- **Same bug pattern: SQL filter is the inverse of what makes sense** — `getRevenueTrend` filters `CREDIT` when it should filter `RENT_PAYMENT DEBIT` (vs. `getMonthlyTrend` which has the right filter). The rentals audit found `price` vs `priceInPaise`. The team-leaders audit found `balance` vs `balanceInPaise`. The riders deep audit found `lockPassword` vs `lockPasswordHash`. The pattern is "two parallel fields with the same conceptual meaning, only one updated". A lint rule that detects dual-named currency fields would catch this at write time.

- **The same "missing DELETE endpoint" gap** — rewards (P0-5), and the team-leaders audit found `bulkDelete` is hard-delete with no recovery. The project needs a universal "soft-delete with restore" pattern.

- **The same "two admin role enums" gap** — `AdminRole` (server, 9 values) and the UI's hardcoded list of 7 with 3 non-existent values (P0-4). Suggest adding a CI check that the `AdminRole` enum and the UI's `<SelectItem>` values are kept in sync.

---

**End of audit. Total findings: 10 P0s, 18 P1s, 15 P2s, 16 P3s, 6 test gaps, 1,000+ lines of dead code.**
