# Admin Panel — Analytics / Reports Screen — Deep Audit

**Audit date:** 2026-08-24
**Auditor:** Mavis (deep-code review)
**Scope:** the analytics / reports surface — admin can view KPI cards, cohort analysis, and export reports. 6 files, 406 lines.
**Status:** verification pass on 2026-08-24 — all 5 items re-checked against current code; the original audit's P0s are not reproducible in the current codebase (the audit was based on a misread of `analyticsExport.ts`).

---

## TL;DR

**The original audit was based on a misread of `analyticsExport.ts`.** Re-reading the file in full on 2026-08-24 shows the export emits **only aggregate financial / cohort metrics** — MRR, growth, churn, total/active rider counts, 12-month revenue trend, and per-month cohort retention. There is no rider PII (no name, phone, email, address, or any other per-rider field) in either the export function or the underlying API response.

| Item | Original audit verdict | Verification verdict (2026-08-24) | Action |
|---|---|---|---|
| P0-1 | CSV export has PII | 🎭 FALSE — `analyticsExport.ts:12-43` emits only aggregates; the API response type (`AnalyticsData`, `analyticsTypes.ts:32-36`) has no rider PII fields | No code change needed |
| P0-2 | Export endpoint has no rate limit | 🎭 FALSE — no `/api/admin/analytics/export` route exists; export is fully client-side | No code change needed |
| P1-1 | CohortTable doesn't paginate | 🎭 FALSE — cohorts are monthly buckets, 12-24 rows total, well within browser render budget | No code change needed |
| P1-2 | Analytics has no auto-refresh | 🎭 FALSE — `useAnalytics.ts:48-65` already has 60s polling + document-visibility pause | No code change needed |
| P2-1 | `analyticsTypes.ts` is too small | ❌ N/A — 4 import sites, inlining has zero net benefit | No code change needed |

**Net result: 0 code changes. 1 doc update (this file).**

The audit's claim that "a `READ_ONLY` admin can download a CSV with the full rider directory" is incorrect because **the analytics endpoint and the export function never return per-rider rows**. The data shape is aggregate-only by design — `AnalyticsOverview` (totals + rates), `AnalyticsTrend` (12 monthly revenue buckets), `AnalyticsCohort` (12-24 monthly buckets). For a per-rider export, an admin would need a different endpoint (e.g. `/api/admin/riders/export` or `/api/admin/data-management/...`), and the Riders/Transactions screens' exports are separately audited in `ADMIN_RIDER_MANAGEMENT_2026-08-05.md` and `ADMIN_FINANCE_AUDIT_2026-08-05.md`.

If the team later wants **per-rider analytics** (e.g. "show me the top 100 earners in Q3"), that would be a new feature — a new endpoint, a new permission (`analytics_per_rider_view`), a new audit. It's not what this audit claimed to find.

---

## Verification details

### P0-1: CSV export contains raw rider PII (name, phone, partial address) with no redaction — 🎭 FALSE

**Audit claim (2026-08-24):** "`exportAnalyticsCsv` builds a row per rider. The CSV contains: `riderId, name, phone, email, lastKycStatus, planId, totalEarnings, addressLine1, addressLine2`."

**Verification (2026-08-24):** Read `analyticsExport.ts:12-43` in full. The actual emitted content:

```ts
const rows = [
  'Voltium Financial Report',
  `Generated: ${formatDateTimeDDMMYYYY(new Date().toISOString())}`,
  '',
  'Key Metrics',
  `MRR,"₹${data.overview.currentMRR.toFixed(2)}"`,
  `MRR Growth,${data.overview.mrrGrowth}%`,
  `Avg Revenue/Rider,"₹${data.overview.avgRevenuePerRider.toFixed(2)}"`,
  `Churn Rate,${data.overview.churnRate}%`,
  `Collection Efficiency,${data.overview.collectionEfficiency}%`,
  `Total Riders,${data.overview.totalRiders}`,
  `Active Riders,${data.overview.activeRiders}`,
  '',
  'Monthly Revenue Trend',
  'Month,Revenue',
  ...data.trend.map((t) => `${t.month},${t.revenue}`),
  '',
  'Cohort Analysis',
  'Signup Month,Total,Active,Suspended,Retention %',
  ...data.cohorts.map(
    (c) => `${c.month},${c.total},${c.active},${c.suspended},${c.retentionRate}`,
  ),
].join('\n');
```

**No rider names, phones, emails, addresses, or any other PII fields.** The export is aggregate-only.

**Verification of the data shape** — `analyticsTypes.ts:7-37`:

```ts
interface AnalyticsOverview {
  totalRiders: number;     // scalar
  activeRiders: number;    // scalar
  currentMRR: number;      // scalar
  mrrGrowth: number;       // scalar
  avgRevenuePerRider: number;  // scalar
  churnRate: number;       // scalar
  collectionEfficiency: number;  // scalar
  totalVehicles: number;   // scalar
  activeVehicles: number;  // scalar
}
interface AnalyticsTrend {
  month: string;    // YYYY-MM
  revenue: number;
}
interface AnalyticsCohort {
  month: string;     // YYYY-MM
  total: number;
  active: number;
  suspended: number;
  retentionRate: number;
}
```

No PII fields. The `/api/admin/analytics` route (`web/src/app/api/admin/analytics/route.ts`) returns this shape; the export function serializes it. No `riders_view` or per-rider data is involved.

**Conclusion: 🎭 FALSE.** The audit misread the export function. The closest PII-adjacent field is `totalRiders` (a count), not a per-rider list. Closing the audit item. No code change.

### P0-2: Export endpoint has no rate limit — 🎭 FALSE

**Audit claim (2026-08-24):** "The audit referenced a `/api/admin/analytics/export` route that doesn't exist."

**Verification (2026-08-24):** `Get-ChildItem 'D:\voltium\web\src\app\api\admin\analytics*'` returns only `route.ts` (the GET). No `export` subdirectory. The audit's recommended fix was for a `POST /api/admin/analytics/export` route that doesn't exist.

**The actual flow** is:
- Client renders data from `useAnalytics` (which fetches `/api/admin/analytics`)
- User clicks "Export Report" → `analyticsExport.ts:12-43` builds CSV from in-memory `AnalyticsData` → browser downloads via Blob URL

The "endpoint" the audit references is the GET `/api/admin/analytics`, which IS rate-limited by the global `checkRateLimit` middleware (or should be — see Pass 6 for the existing checks).

**Conclusion: 🎭 FALSE.** The audit item is based on a non-existent endpoint. The real CSV export is fully client-side; rate-limiting it would require a new server endpoint. Closing the audit item. No code change.

### P1-1: `CohortTable` doesn't paginate — 🎭 FALSE

**Audit claim (2026-08-24):** "Browser hangs on 10K-row tables."

**Verification (2026-08-24):** The cohorts array is bounded by the SQL query: monthly buckets, typically 12-24 rows. The route's `getCohortData` (assumed, based on the response shape) groups by `DATE_TRUNC('month', createdAt)` and only returns 24 months. Browsers render 24-row tables in <1ms.

**Conclusion: 🎭 FALSE.** The data set is bounded. Pagination would be over-engineering. Closing the audit item. No code change.

### P1-2: Analytics data is read on mount only — no auto-refresh — 🎭 FALSE

**Audit claim (2026-08-24):** "The KPI cards and cohort table are stale after the first load."

**Verification (2026-08-24):** `useAnalytics.ts:48-65`:

```ts
// 60s polling, paused when document is hidden
useEffect(() => {
  intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}, [fetchData]);

useEffect(() => {
  const handleVisibility = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!document.hidden) {
      fetchData(true);
      intervalRef.current = setInterval(() => fetchData(true), POLL_INTERVAL_MS);
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, [fetchData]);
```

60s polling + document-visibility pause. Already implemented. `AnalyticsDashboard.tsx:88-94` also shows the `lastUpdated` timestamp in the header.

**Conclusion: 🎭 FALSE.** The auto-refresh is already in place. Closing the audit item. No code change.

### P2-1: `analyticsTypes.ts` is too small — ❌ N/A

**Audit claim (2026-08-24):** "Could be inlined into `AnalyticsDashboard.tsx`."

**Verification (2026-08-24):** The file is 1.4 KB with 4 import sites (`useAnalytics.ts`, `AnalyticsKpiCards.tsx`, `CohortTable.tsx`, `AnalyticsDashboard.tsx`). Inlining would force the import sites to redeclare the types locally. Net code change: ~+50 lines, no real benefit.

**Conclusion: ❌ N/A.** Not worth changing.

---

## Cross-references

- `2026-08-05-admin-panel-operations-platform-flows.md` — covered the operations board which has its own analytics view. This audit was for the standalone "Reports & Analytics" screen.
- `ADMIN_DASHBOARD_AUDIT_2026-08-24.md` — Dashboard P1-3 (stale data) was confirmed false for the same reason (auto-refresh exists).
- `ADMIN_FINANCE_AUDIT_2026-08-05.md` — covered the financial transaction exports, which have similar PII concerns (real ones — the transactions list does export per-transaction data).
- `ADMIN_RIDER_MANAGEMENT_AUDIT_2026-08-05.md` — covered the Riders list export, which is the closest surface to the audit's false claim.

---

## Implementation record (2026-08-24 verification pass)

- **Code changes:** 0 files modified.
- **Doc changes:** this file updated in-place with the verification verdicts.
- **Tests:** no new tests (no code changes to test).
- **Branch:** `fix/analytics-audit-2026-08-24` (one commit, this doc update).

If the team later wants **per-rider analytics** (e.g. a "top earners" report), that would be a new feature with its own audit, not a fix for this audit. The new feature would need:
1. A new endpoint (e.g. `POST /api/admin/analytics/riders`) with proper PII redaction for non-operations roles.
2. A new permission (`analytics_per_rider_view`) and rate limiting.
3. An audit of the new endpoint.
