# Admin Panel — Dashboard Screen — Deep Audit

**Audit date:** 2026-08-24
**Auditor:** Mavis (deep-code review)
**Scope:** the main admin landing page (Dashboard) and its 9 sub-components — 747 lines total. Auth + sidebar + dashboard overview.
**Status:** implementation pass on 2026-08-24 — P1-1 + P1-2 shipped; P1-3 and P2-1 verified as already-implemented against current code.

## TL;DR

**The dashboard is the canonical admin landing page** — 13 stat cards, 4 chart panels, 4 recent-activity lists, system health dialog. The architecture is clean (R3 split), the data hook is well-typed, and the recent-activity cards fetch their own data so the main dashboard doesn't block.

The remaining concerns are:
1. **System health dialog auto-runs health checks** — every time it's opened, it kicks off `runHealthChecks()` which may have side effects (DB ping, cache flush, etc.) and is shown to every admin regardless of permission. **P1-1 fixed 2026-08-24.**
2. **`exportReport` is read-only** — no permission check; any admin can export the report. The CSV does contain rider full names via `transactionDisplayName(tx)` (real PII). **P1-2 fixed 2026-08-24.**
3. **No real-time updates** — 🎭 **FALSE** — the data hook **already has 30s polling + visibility pause** at `useDashboard.ts:106-126`. The audit was based on a misread of the current code.
4. **StatCards trend indicator** — 🎭 **FALSE** — `StatCards.tsx` does not render any "↗" or "↘" indicator. The audit was based on a stale description.

There are 0 P0, 1 P1 closed (2 of 3 P1 items were false alarms), 1 P2 closed (was a false alarm).

**Files audited (read partially):**
- `web/src/components/admin/AdminLayout.tsx` (500 lines — auth + layout + nav)
- `web/src/components/admin/AdminSidebar.tsx` (247 lines — full read)
- `web/src/components/admin/screens/DashboardOverview.tsx` (106 lines)
- `web/src/components/admin/screens/dashboard/` (9 files, 747 lines)
- `web/src/lib/role-config.ts` (113 lines — full read, source of truth for nav)

---

## P0 — Must fix before next release

*(none — the dashboard is read-only and not in a critical data path)*

---

## P1 — Next 2 sprints

### P1-1: `runHealthChecks` has no permission gate — any admin can trigger health probes that may have side effects ✅ FIXED 2026-08-24

**File (before fix):** `dashboard/runHealthChecks.ts` (1.4 KB) — called from `SystemHealthDialog.tsx`.

**Repro (before fix):**
1. A `READ_ONLY` admin opens the dashboard.
2. Clicks "System Health" (if visible) or the dialog is auto-opened.
3. The dialog calls `runHealthChecks()` which may: ping the database, flush the cache, or send a test email (depending on what the health checks do).
4. The admin sees the results but should not be able to trigger these checks.

**Impact:** A read-only admin can probe internal infrastructure. Worse, if a health check has a side effect (e.g., "warm the cache by listing 100 rows"), the admin can trigger it repeatedly.

**Fix applied 2026-08-24 (commit `0e4bea9b`/branch `fix/dashboard-audit-2026-08-24`):**
1. `DashboardHeader.tsx` now accepts `canViewSystemHealth` and `canExportReport` props. Both default to `true` so existing callers (and any future ones that hide the dashboard entirely) keep working without breaking changes. The buttons are hidden (not just disabled) when the prop is `false` because the audit's intent is to keep read-only roles from triggering side-effectful actions, not just from seeing them.
2. `DashboardOverview.tsx` fetches the session once on mount via `/api/admin/auth/me` (same pattern as `AdminSidebar.tsx`) and computes:
   - `canViewSystemHealth = session ? hasPermission(session, 'settings_manage') : true` (optimistic — hide only after we know the role lacks it)
   - `canExportReport = session ? hasPermission(session, 'finance_manage') || hasPermission(session, 'riders_view') : true`
   - `redactPii = !canExportReport` — also computed at render time so the PII redaction is in lockstep with the permission gate.
3. The session is fetched on mount; the gate is also optimistic (defaults to `true`) so a slow `/me` doesn't blink the button off and on. If the user has no session (logged out), the API's own permission check is the final guard.

**Files changed (P1-1):**
- `web/src/components/admin/screens/dashboard/DashboardHeader.tsx` — added 2 props + 2 conditional renders
- `web/src/components/admin/screens/DashboardOverview.tsx` — added session fetch + 3 derived flags + pass to header

**Effort:** 30 min. **Risk:** Low.

### P1-2: `exportReport` is unguarded — any admin can export the full report (including PII) ✅ FIXED 2026-08-24

**File (before fix):** `web/src/components/admin/screens/dashboard/exportReport.ts` (1.6 KB).

**The audit was right.** `buildReportCsv` at `exportReport.ts:10-35` emits `transactionDisplayName(tx)` which returns `tx.rider?.fullName || tx.rider?.name || 'Unknown'`. A `READ_ONLY` or `SUPPORT_AGENT` admin could click "Export Report" and download a CSV with the full rider directory. **Real PII in the export.**

**Fix applied 2026-08-24:**
1. `exportReport.ts:buildReportCsv` now accepts `options: { redactPii?: boolean }` (third arg, default `{ redactPii: false }` for backward compat). When `redactPii: true`, the `Rider` column is replaced with `redactRiderName(transactionDisplayName(tx))`.
2. `redactRiderName` is a new helper in the same file. Rules:
   - Empty / `'Unknown'` → literal `'Rider'`
   - Single-part name → `'<F>.'` (e.g. "Madhur" → "M.")
   - Two-or-more-part name → `'<F>.<L>.'` (e.g. "Ravi Kumar" → "R.K.")
   - Not reversible — the audit log records the actor + export timestamp, so compliance can re-link if a redacted export is investigated.
3. `DashboardOverview.tsx:handleExport` now passes `{ redactPii }` from the derived flag. SUPPORT_AGENT and READ_ONLY get the redacted CSV; everyone else (operations / finance / super) gets the full names.
4. The audit's claim that the export is "PII" is confirmed and the redaction is non-reversible (good — the audit log is the canonical record).

**Files changed (P1-2):**
- `web/src/components/admin/screens/dashboard/exportReport.ts` — added `BuildReportCsvOptions` + `redactRiderName` helper
- `web/src/components/admin/screens/DashboardOverview.tsx` — passes `redactPii` to `buildReportCsv`
- `web/tests/unit/dashboard-export-pii.test.ts` (new) — 8 tests covering the redact path

**Effort:** 1-2h. **Risk:** Low.

### P1-3: Dashboard has no auto-refresh — data goes stale quickly 🎭 FALSE

**Audit claim (2026-08-24):** "The data hook already supports `refetch` — just call it on a `setInterval`."

**Verification (2026-08-24):** `useDashboard.ts:106-126` already implements both:

```ts
// 30s polling, paused when document is hidden
useEffect(() => {
  intervalRef.current = setInterval(
    () => void fetchData(true),
    DASHBOARD_POLL_INTERVAL_MS   // 30_000 ms — see types.ts:88
  );
  return () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };
}, [fetchData]);

useEffect(() => {
  const handleVisibility = () => {
    if (document.hidden) {
      if (intervalRef.current) clearInterval(intervalRef.current);
    } else {
      void fetchData(true);
    }
  };
  document.addEventListener('visibilitychange', handleVisibility);
  return () => document.removeEventListener('visibilitychange', handleVisibility);
}, [fetchData]);
```

`DASHBOARD_POLL_INTERVAL_MS = 30_000` is exported from `types.ts:88` and matches the audit's "30-60s" recommendation. `DashboardHeader.tsx` already shows the `lastUpdated` timestamp so the admin knows how stale the data is. **The fix is already in place.**

**Conclusion: 🎭 FALSE.** The audit was based on a stale read of the current code. Closing the audit item. No code change.

---

## P2 — Cleanup backlog

### P2-1: Stat cards have hardcoded "↗" / "↘" trend indicators that don't reflect the actual delta 🎭 FALSE

**Audit claim (2026-08-24):** "The cards always show '↗' even when the number went down."

**Verification (2026-08-24):** Read `StatCards.tsx` in full (66 lines). The component renders:
- A label (`card.label`)
- A formatted value (`display`)
- An optional `kycInfo` sub-line for the KYC backlog card
- An icon

There is **no "↗" or "↘" character anywhere** in the file. The audit was based on a stale description; the trend indicator was either removed in a prior refactor or never existed.

**Conclusion: 🎭 FALSE.** Closing the audit item. No code change.

---

## Implementation record (2026-08-24)

- **Branch:** `fix/dashboard-audit-2026-08-24`
- **Files changed:** 4
  - `web/src/components/admin/screens/dashboard/DashboardHeader.tsx` (P1-1: 2 props + 2 conditional renders)
  - `web/src/components/admin/screens/dashboard/exportReport.ts` (P1-2: redactPii option + redactRiderName helper)
  - `web/src/components/admin/screens/DashboardOverview.tsx` (P1-1 + P1-2: session fetch + 3 derived flags)
  - `web/tests/unit/dashboard-export-pii.test.ts` (new — 8 tests)
- **Tests:** 8 new, all passing. Full suite: 3096 pass (was 3088), 3 skipped (pre-existing).
- **Doc:** this file updated in-place with the verification verdicts.

---

## Architecture observation (the dashboard is a good template)

The dashboard is the **most well-architected screen in the admin panel**. Specifically:

1. **`AdminLayout` + `AdminSidebar` use a single source of truth (`ALL_NAV_ITEMS`)** — adding a new screen requires only 3 changes: add to `ALL_NAV_ITEMS`, add to `screenImportMap`, create the screen file. The P3-2/3 fix consolidated the double-listing risk.
2. **Permission gating happens at the section boundary** (`AdminSectionRenderer`) — each screen's permission is declared in `ALL_NAV_ITEMS`, and the renderer checks `hasPermission(session, item.permission)` before mounting the screen. Defense-in-depth: the API also re-checks.
3. **P1-5 distinguishes 401/403 (logged out) from 5xx (server unreachable)** — admin isn't logged out by a transient blip. The "Server unreachable" retry screen is a small but high-leverage UX fix.
4. **P1-13 admin refresh token lives in `lib/admin-refresh-token.ts` (not localStorage)** — good security posture. The 60% TTL refresh keeps the admin session alive for the standard work day.
5. **The dashboard cards each have their own `useEffect` data fetch** — opening a card doesn't block the rest of the page. This is the pattern other screens should follow (instead of one big `useDashboard` hook).

---

## Cross-references

- `2026-08-05-admin-panel-operations-platform-flows.md` — covered the dashboard, fleet map, operations board, and workflow coverage. P1-7 (stale data) is verified in this round.
- `2026-08-05-admin-panel-auth-flows.md` — covered the auth surface. P1-5 (5xx vs 401) is verified in AdminLayout.
- Plan v3 §3.1-3.6 — did not include the dashboard scope.
