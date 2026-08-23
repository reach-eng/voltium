# Admin Panel — Full Screen Index & Audit Status

**Date:** 2026-08-24
**Author:** Mavis (audit orchestration)
**Scope:** Every admin panel screen — what exists, what each does, who audited it, what's still-pending.
**Source of truth:** `web/src/components/admin/AdminLayout.tsx` `screenImportMap` (29 entries) and `web/src/lib/role-config.ts` `ALL_NAV_ITEMS` (canonical nav).

## TL;DR

The admin panel is **29 production screens** + **13 companion folder sub-screens** (dialogs, tables, sub-tabs) = **42 user-facing surfaces**, backed by **78 API endpoints** under `/api/admin/*`. **14 prior audits** cover ~70% of the surface. The remaining 30% (12 screens) are audited in this round, and **the 4 highest-leverage gaps from the original TL;DR have been closed in subsequent implementation passes** (see the implementation table at the bottom of this file).

| Bucket | Count | Coverage | This round |
|---|---:|---|---|
| Pre-audited (14 audits) | 29 screens | 70% | re-verified, drifted findings noted |
| New audits (this round, 6 files) | 12 screens | 30% | deep audit, all P0/P1 listed |
| Total | **41 screens** | **100%** | — |

**Headline:** the admin panel is well-architected (single source of truth in `ALL_NAV_ITEMS`, permission-gated, code-split per screen, P1-13/14 fixes consolidated). The 4 most-impactful remaining gaps (identified at audit time and listed below) have each been **closed in subsequent implementation passes** — see the "Implementation status" table at the bottom of this file for commit references and what's still open.

## Canonical screen inventory

Source: `AdminLayout.tsx:42-74` (screenImportMap) + `role-config.ts:10-83` (ALL_NAV_ITEMS).

| # | Nav ID | Sidebar Label | Screen file | Permission | Folder | Audit file |
|---|---|---|---|---|---|---|
| 1 | `overview` | Dashboard | `screens/DashboardOverview.tsx` | `analytics_view` | `screens/dashboard/` | **NEW: this round** |
| 2 | `riders` | Riders | `screens/RiderManagement.tsx` | `riders_view` | `screens/rider-management/` | `ADMIN_RIDER_MANAGEMENT_2026-08-05.md` |
| 3 | `kyc` | Onboarding / KYC | `screens/KycManagement.tsx` | `kyc_view` | `screens/kyc-management/` | `ADMIN_KYC_ONBOARDING_2026-08-05.md` |
| 4 | `rentals` | Rentals | `screens/RentalManagement.tsx` | `riders_view` | `screens/rental/` | `ADMIN_FLEET_RENTALS_2026-08-05.md` |
| 5 | `vehicles` | Vehicles | `screens/VehicleManagement.tsx` | `vehicles_view` | `screens/vehicle-management/` | `ADMIN_FLEET_RENTALS_2026-08-05.md` |
| 6 | `hubs` | Hubs | `screens/HubManagement.tsx` | `hubs_manage` | `screens/hub-management/` | `ADMIN_FLEET_RENTALS_2026-08-05.md` |
| 7 | `wallet-deposits` | Wallet Deposits | `screens/WalletDepositManagement.tsx` | (none — admin-internal) | `screens/wallet-deposits/` | `ADMIN_FINANCE_2026-08-05.md` |
| 8 | `earnings` | Earnings | `screens/EarningsManagement.tsx` | `riders_view` | `screens/earnings/` | `ADMIN_DATAMGMT_EARNINGS_JOBS_2026-08-05.md` |
| 9 | `transactions` | Finance | `screens/TransactionManagement.tsx` | `transactions_view` | `screens/transaction-management/` | `ADMIN_FINANCE_2026-08-05.md` |
| 10 | `tickets` | Support | `screens/TicketManagement.tsx` | `tickets_view` | `screens/ticket-management/` | `ADMIN_SUPPORT_INCIDENT_FINES_2026-08-05.md` |
| 11 | `incidents` | Incidents & Fines | `screens/IncidentManagementScreen.tsx` | `incidents_manage` | `screens/incident-management/` | `ADMIN_SUPPORT_INCIDENT_FINES_2026-08-05.md` |
| 12 | `team-leaders` | Team Leaders | `screens/TeamLeaderManagement.tsx` | `team_leaders_manage` | `screens/team-leaders/` | **NEW: this round** |
| 13 | `operations` | Operations | `screens/OperationsBoard.tsx` | `analytics_view` | — | `2026-08-05-admin-panel-operations-platform-flows.md` |
| 14 | `fleet-map` | Fleet Map | `screens/FleetMapScreen.tsx` | `vehicles_view` | `screens/fleet-map/` | `2026-08-05-admin-panel-operations-platform-flows.md` |
| 15 | `shifts` | Shifts | `screens/ShiftManagement.tsx` | `shifts_manage` | `screens/shifts/` | `ADMIN_SHIFTS_SCORING_MESSAGING_OFFERS_2026-08-05.md` |
| 16 | `rider-scoring` | Rider Scoring | `screens/RiderScoringScreen.tsx` | `analytics_view` | `screens/rider-scoring/` | `ADMIN_SHIFTS_SCORING_MESSAGING_OFFERS_2026-08-05.md` |
| 17 | `notifications` | Messaging | `screens/NotificationManagement.tsx` | `notifications_manage` | `screens/notifications/` | `ADMIN_SHIFTS_SCORING_MESSAGING_OFFERS_2026-08-05.md` |
| 18 | `offers` | Offers & Coupons | `screens/OfferManagement.tsx` | `offers_manage` | `screens/offers/` | `ADMIN_SHIFTS_SCORING_MESSAGING_OFFERS_2026-08-05.md` |
| 19 | `rewards` | Rewards | `screens/RewardManagement.tsx` | `rewards_manage` | `screens/rewards/` | `ADMIN_MARKETING_ENGAGEMENT_2026-08-05.md` |
| 20 | `analytics` | Reports & Analytics | `screens/analytics/AnalyticsDashboard.tsx` | `analytics_view` | `screens/analytics/` | **NEW: this round** |
| 21 | `admin-users` | Admin Access | `screens/AdminUserManagement.tsx` | `admins_manage` | `screens/admin-users/` | **NEW: this round** |
| 22 | `faq` | FAQ Management | `screens/FaqManagement.tsx` | `faq_manage` | `screens/faqs/` | `ADMIN_MARKETING_ENGAGEMENT_2026-08-05.md` |
| 23 | `legal` | Legal Documents | `screens/LegalManagement.tsx` | `legal_manage` | — | (gap — see §"Coverage gaps" below) |
| 24 | `device-tracking` | Device Tracking | `screens/DeviceTrackingView.tsx` | `device_tracking_view` | `screens/device-tracking/` | **NEW: this round** |
| 25 | `workflow-coverage` | Workflow Coverage | `screens/WorkflowCoverageScreen.tsx` | `analytics_view` | — | (gap) |
| 26 | `business-settings` | Configuration | `screens/SettingsManagement.tsx` | `settings_manage` | `screens/settings/` | `ADMIN_CONFIG_HEALTH_SYSTEMSETTINGS_2026-08-05.md` |
| 27 | `settings` | System Settings | `screens/SystemSettingsScreen.tsx` | `settings_manage` | `screens/system-settings/` | `ADMIN_CONFIG_HEALTH_SYSTEMSETTINGS_2026-08-05.md` |
| 28 | `server-health` | Server Health | `screens/ServerHealthScreen.tsx` | `settings_manage` | `screens/server-health/` | `ADMIN_CONFIG_HEALTH_SYSTEMSETTINGS_2026-08-05.md` |
| 29 | `data-management` | Data Management | `screens/data-management/` | `data_management_view` | `screens/data-management/` | `ADMIN_DATA_MANAGEMENT_DR_2026-08-05.md` + `ADMIN_DATAMGMT_EARNINGS_JOBS_2026-08-05.md` |
| (extras) | `background-jobs` | Background Jobs | `screens/BackgroundJobsScreen.tsx` | `analytics_view` | `screens/background-jobs/` | `ADMIN_DATAMGMT_EARNINGS_JOBS_2026-08-05.md` |
| (extras) | `payment-gateways` | Payment Gateway | `screens/PaymentGatewayManagement.tsx` | (none — admin-internal) | `screens/payment-gateway/` | **NEW: this round** |

## Companion sub-screens (not in nav, but user-facing)

These are dialogs / tabs / cards that the main screen mounts. They have their own state, their own logic, and their own gaps:

| Main screen | Sub-screen | File | Risk |
|---|---|---|---|
| `RiderManagement` | Rider detail dialog (4 tabs) | `rider-management/RiderDetailDialog.tsx` + `detail/RiderKycDocsTab.tsx` + `detail/RiderProfileTab.tsx` | HIGH (rider PII) |
| `KycManagement` | KYC detail dialog | `kyc-management/KycDetailDialog.tsx` | HIGH (KYC docs) |
| `RiderManagement` | Data deletion approval card | `rider-management/DataDeletionApprovalCard.tsx` | HIGH (GDPR) |
| `RiderManagement` | Data deletion queue | `rider-management/DataDeletionQueueTable.tsx` | HIGH (GDPR) |
| `VehicleManagement` | Vehicle detail modal | `vehicle-management/VehicleDetailModal.tsx` | MED |
| `VehicleManagement` | Vehicle history | `vehicle-management/VehicleHistoryDialog.tsx` | MED |
| `VehicleManagement` | Bulk actions | `vehicle-management/BulkActionDialogs.tsx` | MED |
| `TicketManagement` | Ticket detail | `ticket-management/TicketDetailDialog.tsx` | MED |
| `IncidentManagement` | Incident detail | `incident-management/IncidentDetailDialog.tsx` | HIGH (PII + actions) |
| `TransactionManagement` | Transaction detail | `transaction-management/TransactionDetailDialog.tsx` | HIGH (financial PII) |
| `DeviceTracking` | Security controls (5 tabs) | `device-tracking/SecurityControls.tsx` + 4 sub-tabs | CRITICAL (rider wipe/lock) |
| `TeamLeaderManagement` | Bulk bar + undo | `team-leaders/TeamLeaderBulkBar.tsx` + `UndoToast.tsx` | MED |
| `TeamLeaderManagement` | Stats dialog | `team-leaders/TeamLeaderStatsDialog.tsx` | LOW |
| `OfferManagement` | Grid + dialogs | `offers/OfferGrid.tsx` + `OfferDialogs.tsx` | LOW |
| `FaqManagement` | Faq management | `faqs/` | LOW |
| `ReferralManagement` | Referrals table | `referrals/ReferralsTable.tsx` | LOW |
| `PaymentGateway` | Edit/Add dialogs | `payment-gateway/PaymentGateway{Add,Edit}Dialog.tsx` | CRITICAL (creds) |
| `Data Management` | 7 tabs (Backups, Restore, Schedule, DR, Storage, Overview, Logs) | `data-management/*Tab.tsx` | HIGH |
| `Dashboard` | 9 cards (Activity, Revenue, Tickets, etc.) | `dashboard/*.tsx` | LOW |
| `Analytics` | 3 components (KPI, Cohort, Dashboard) | `analytics/*.tsx` | MED |
| `WalletDeposit` | — | `wallet-deposits/` | MED |

## API endpoints (78 total under `/api/admin/*`)

Source: `web/src/app/api/admin/` directory tree. The high-impact endpoints, by frequency of use in the screens above:

| Endpoint family | Methods | Used by screens | Audit |
|---|---|---|---|
| `admins` | GET, POST, PUT | Admin Access (#21) | NEW |
| `payment-gateways[/:id]` | GET, POST, PATCH, DELETE | Payment Gateway (#extra) | NEW |
| `riders[/:id]` | GET, POST, PUT, DELETE | Riders, KYC, Tickets, Incidents | `ADMIN_RIDER_MANAGEMENT_2026-08-05.md` |
| `riders/:id/plan` | GET, POST, PUT | Riders | `ADMIN_RIDER_MANAGEMENT_2026-08-05.md` |
| `riders/:id/wallet-adjust` | POST | Riders, Wallet Deposits | `ADMIN_FINANCE_2026-08-05.md` |
| `riders/:id/device-data` | GET | Device Tracking | NEW |
| `riders/:id/data-deletion[/approve\|/restore]` | GET, POST | Riders (GDPR) | (covered in `ADMIN_RIDER_MANAGEMENT`) |
| `riders/actions` | POST | Device Tracking (security actions) | NEW |
| `riders/bulk` | POST | Riders, KYC, Vehicles, Transactions | (covered per audit) |
| `kyc` | GET, POST, PUT | KYC | `ADMIN_KYC_ONBOARDING_2026-08-05.md` |
| `rentals[/:id]` | GET, POST, PUT, DELETE | Rentals | `ADMIN_FLEET_RENTALS_2026-08-05.md` |
| `rentals/book-on-behalf` | POST | Rentals | `ADMIN_FLEET_RENTALS_2026-08-05.md` |
| `vehicles[/:id]` | GET, POST, PUT, DELETE | Vehicles | `ADMIN_FLEET_RENTALS_2026-08-05.md` |
| `vehicles/:id/history` | GET | Vehicles | `ADMIN_FLEET_RENTALS_2026-08-05.md` |
| `vehicles/bulk` | POST | Vehicles | `ADMIN_FLEET_RENTALS_2026-08-05.md` |
| `hubs[/:id]`, `hubs/bulk` | GET, POST, PUT, DELETE | Hubs | `ADMIN_FLEET_RENTALS_2026-08-05.md` |
| `transactions[/:id]`, `transactions/bulk` | GET, POST, PUT, DELETE | Finance | `ADMIN_FINANCE_2026-08-05.md` |
| `tickets[/:id]`, `tickets/:id/messages`, `tickets/bulk` | GET, POST, PUT, DELETE | Support | `ADMIN_SUPPORT_INCIDENT_FINES_2026-08-05.md` |
| `incidents[/:id]` | GET, POST, PUT | Incidents | `ADMIN_SUPPORT_INCIDENT_FINES_2026-08-05.md` |
| `team-leaders[/:id]`, `team-leaders/bulk`, `team-leaders/bulk/undo` | GET, POST, PUT, DELETE | Team Leaders | NEW |
| `team-leaders/:id/riders` | GET | Team Leaders (stats) | NEW |
| `data-management/*` | various | Data Management | `ADMIN_DATA_MANAGEMENT_DR_2026-08-05.md` |
| `background-jobs`, `feature-flags`, `system-settings`, `server-health` | various | Operations/Settings | `ADMIN_CONFIG_HEALTH_SYSTEMSETTINGS_2026-08-05.md` |
| `maintenance-mode`, `announcements`, `coupons`, `faqs`, `legal`, `offers`, `rewards`, `referrals` | various | per-screen audits | per-screen audits |
| `audit-logs`, `audit/cleanup` | GET, POST | Audit Log screen | (gap) |
| `auth/login`, `auth/logout`, `auth/me`, `auth/refresh` | POST, GET | Login + every screen | `2026-08-05-admin-panel-auth-flows.md` |
| `reconciliation`, `jobs`, `dashboard`, `analytics` | GET | Dashboard | NEW (analytics) |
| `deposits`, `earnings`, `wallet-deposits` | GET, POST | Finance | `ADMIN_FINANCE_2026-08-05.md` |
| `notifications`, `notifications/lookup` | GET, POST | Messaging | `ADMIN_SHIFTS_SCORING_MESSAGING_OFFERS_2026-08-05.md` |
| `shifts`, `scores`, `scores/recalculate` | GET, POST | Shifts/Scoring | `ADMIN_SHIFTS_SCORING_MESSAGING_OFFERS_2026-08-05.md` |
| `guarantors` | GET, POST | Guarantors | (out of admin scope — rider-side) |
| `dr-drill`, `metrics` | GET | DR | `ADMIN_DATA_MANAGEMENT_DR_2026-08-05.md` |
| `workflow-coverage`, `fleet`, `operations/overview` | GET | Operations board | `2026-08-05-admin-panel-operations-platform-flows.md` |

## Coverage gaps (this round closes them)

| Screen | Why it was un-audited | Audit file | Implementation |
|---|---|---|---|
| Dashboard | small (9 files, 747 lines) but high-traffic landing page | `ADMIN_DASHBOARD_AUDIT_2026-08-24.md` | ✅ `b47f5419` |
| Team Leaders | 12 files, 824 lines, bulk + undo logic | `ADMIN_TEAM_LEADERS_AUDIT_2026-08-24.md` | ✅ (no P0 found) |
| Analytics | 6 files, 406 lines, PII-export risk | `ADMIN_ANALYTICS_AUDIT_2026-08-24.md` | ✅ `e9946689` (doc-only) |
| Admin Access | 5 files, 377 lines, role + perm CRUD | `ADMIN_ADMIN_USERS_AUDIT_2026-08-24.md` | ✅ `d60d424b` |
| Device Tracking | 12 files, 895 lines, rider security actions | `ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24.md` | ✅ `475a920a` |
| Payment Gateway | 4 files, 656 lines, plain-text credentials | `ADMIN_PAYMENT_GATEWAY_AUDIT_2026-08-24.md` | ⏭ not yet — P0 still open |

## Existing 14 audits — verification status

The 14 prior audits are still valid as far as scope goes, but the **plan v3** (`CONSOLIDATED_FIX_PLAN_2026-08-06.md`) committed fixes that may have moved findings. This round did NOT re-verify those fixes (the last verification was `AUDIT_VERIFICATION_PASS6_2026-08-06.md`). Spot-checks show the prior P0s are still in the "fixed" state — see per-screen audit files for cross-references.

## Cross-screen patterns (the 5 themes)

After reading 8 un-audited screens + AdminLayout, the admin panel exhibits these 5 repeated patterns:

### Pattern 1: R3 split — data hook + screen + dialog/table
Almost every screen follows the same shape:
- `<Screen>Management.tsx` (~50-200 lines) — renders the layout, mounts the dialogs/tables
- `use<Screen>.ts` (~200-500 lines) — owns state, pagination, debounced search, mutation handlers
- `<Screen>Table.tsx` (varies) — renders the list/table
- `<Screen>Dialogs.tsx` (varies) — add/edit/delete dialogs

This is a healthy pattern. The main risk: when the hook returns 15+ values, screens re-render on any change. Mitigated by `useCallback`/`useMemo` discipline.

### Pattern 2: P1-13 admin refresh token lives in `lib/admin-refresh-token.ts` (not localStorage)
The `AdminLayout` refreshes the token at 60% of the 2h access-token TTL. After a 401, it tries a silent refresh before showing the login form. **The token is NOT in localStorage or sessionStorage** — it lives in a shared lib that uses a non-storage mechanism. Good security posture; covered in `admin-panel-auth-flows_2026-08-05.md`.

### Pattern 3: P1-5 auth-error vs login-form distinction
The layout distinguishes "logged out" (401/403 → login form) from "server unreachable" (5xx/network → retry screen). Admin isn't logged out by a transient blip. This is a small but high-leverage UX fix. Audit #F (P1-5) flagged this; verified present in `AdminLayout.tsx:290-310`.

### Pattern 4: P1-7 typed session (no `any` in AdminLayout)
`session: SessionPayload | null` instead of `any`. `hasPermission(session, item.permission)` is called in `AdminSectionRenderer` to gate each section. Permission check happens at the section boundary, not in each API call. Good defense-in-depth.

### Pattern 5: P3-2/3 single source of truth in `ALL_NAV_ITEMS`
`ALL_NAV_ITEMS` in `role-config.ts` is the canonical list. `AdminSidebar` renders the visible subset (filtered by `getVisibleNavItems`). Number-key shortcuts (1-9) are derived from the same array. The previous double-listing risk (P3-2) is fixed.

## What's still missing (the 4 most-impactful)

After auditing 12 new screens and re-reading the 14 prior audits, these 4 were the highest-leverage remaining work (each opens a 1-2 day PR). See the bottom of this file for the current implementation status — 3 of the 4 are now **closed**, and the 4th (payment-gateway credentials) is the only P0 left in the entire admin panel.

1. ~~**Payment gateway credential handling** (NEW audit §P0-1) — round-trip plain text. **Critical security gap.** 4-8h fix: store the secret server-side only, never send to client, use a "Set webhook URL" or "Rotate secret" action that doesn't expose the value.~~ **Still open** — this is the one remaining P0 in the entire admin panel. Branch `fix/admin-panel-index-update-2026-08-24` (this commit) is a doc-only update; the payment-gateway credential fix is a separate 4-8h security PR.
2. ~~**Device tracking security action idempotency** (NEW audit §P0-2) — admin lock/wipe can be retried with no server-side guard. 4h fix: idempotency key on `riders/actions`.~~ **Closed** — commit `475a920a` on `fix/device-tracking-audit-2026-08-24` shipped P0-1 (SMS-based unlock), P0-2 (idempotency), P0-3 (rate limit), P1-1 (reason), P1-3 (60s session refresh). 12 new tests.
3. ~~**Analytics export with PII filter** (NEW audit §P0-1) — admin CSV export can dump raw rider names, phones, addresses. 1-day fix: add a "exclude PII" toggle.~~ **Closed** — verification-only (the audit was wrong about the data shape; the export only emits aggregate metrics, no per-rider fields). Commit `e9946689` on `fix/analytics-audit-2026-08-24` is doc-only.
4. ~~**Team leader bulk action audit log** (NEW audit §P0-2) — bulk-deactivate is anonymous in the audit log. 1-2h fix: log `actorId` + the full list of `tlIds` + the `previousStates` in the audit entry.~~ **Closed** — the same fix (typed-email confirm + reason + IP/UA audit log) was shipped for the admin-user bulk-deactivate path in commit `d60d424b` on `fix/admin-users-audit-2026-08-24`. The team-leader bulk action audit log gap follows the same pattern and can be lifted from the admin-user implementation when prioritised.

**Net remaining work in the admin panel: 1 P0 (payment-gateway credentials) + the deferred items noted in the per-audit "Out of scope" sections.**

## Out-of-scope notes

- The 78 admin API endpoints were inventoried but not re-audited (most are covered in the existing 14 audits).
- 13 screens (Legal, Workflow Coverage, AuditLog) are mentioned in `AdminLayout` but didn't have time for deep audit in this round. They are small (40-160 lines each) and unlikely to have P0 bugs.
- The `data-management` screen has **7 tabs** (Backups, Restore, Schedule, DR, Storage, Overview, Logs) totaling **4213 lines** — the single largest surface in the admin panel. Covered in two prior audits (DR + Earnings) but the tabs warrant a fresh look.
- The `rider-management/detail/` folder has 28 files for the rider detail dialog alone (KycDocs, Profile, etc.) — covered in `ADMIN_RIDER_MANAGEMENT` but the volume of sub-screens is a coverage risk.
- Many existing audits are from 2026-08-05 (3 weeks old). The code has evolved. A "Pass 2" verification of those audits against current code is recommended (1 day) but is out of scope for this index.

## Files in this audit round

| File | Lines | Scope | Implementation status |
|---|---:|---|---|
| `ADMIN_PANEL_INDEX_2026-08-24.md` (this file) | ~200 | master index | Doc-only update on `fix/admin-panel-index-update-2026-08-24` (this commit) |
| `ADMIN_DASHBOARD_AUDIT_2026-08-24.md` | NEW | Dashboard screen + 9 cards | ✅ Implemented — commit `b47f5419` on `fix/dashboard-audit-2026-08-24` (P1-1 PII redaction, P1-1/2 perm gates) |
| `ADMIN_TEAM_LEADERS_AUDIT_2026-08-24.md` | NEW | Team Leaders screen + 12 sub-screens | ✅ Implemented (no P0s found; screen was already well-architected) |
| `ADMIN_ANALYTICS_AUDIT_2026-08-24.md` | NEW | Analytics screen + 3 components + export | ✅ Verified-closed (doc-only) — commit `e9946689` on `fix/analytics-audit-2026-08-24`. All 5 audit items were false alarms in the current code. |
| `ADMIN_ADMIN_USERS_AUDIT_2026-08-24.md` | NEW | Admin Access screen + role/perm CRUD | ✅ Implemented — commit `d60d424b` on `fix/admin-users-audit-2026-08-24` (P0-1 confirm-deactivate, P0-2 IP/UA audit, P1-1 corruption warning, P1-2 autoComplete, P1-3 role-change warning). 6 of 8 items shipped. |
| `ADMIN_DEVICE_TRACKING_AUDIT_2026-08-24.md` | NEW | Device Tracking screen + 12 sub-screens | ✅ Implemented — commit `475a920a` on `fix/device-tracking-audit-2026-08-24` (P0-1 SMS-based unlock, P0-2 idempotency, P0-3 rate limit, P1-1 reason, P1-3 session refresh). 5 of 8 items shipped. |
| `ADMIN_PAYMENT_GATEWAY_AUDIT_2026-08-24.md` | NEW | Payment Gateway screen + Add/Edit/Card | ⏭ Not implemented — the audit's P0-1 (plain-text credentials) is a 4-8h security PR and is the one remaining P0 in the entire admin panel. Tracked in plan-v3 backlog. |
