# Screen Workflow Coverage

This document is the source of truth for the admin console and rider app screens required to perform Voltium's public-beta workflows.

## Admin console sections

| Workflow area | Required screens/sections | Status | Test coverage |
|---|---|---|---|
| Dashboard | Dashboard overview, quick actions, backup/server status | Implemented | `web/tests/integration/admin/` (3 files) |
| Rider lifecycle | Riders, rider details, lifecycle timeline, documents, wallet, rentals, support, audit history | Implemented through Riders and linked detail flows | `web/tests/integration/rider/` + `web/tests/integration/rentals/` + `web/tests/integration/kyc/` |
| Verification | KYC Management, Guarantors, document viewer, decision history, field notes | Implemented | `web/tests/integration/kyc/` + `web/tests/integration/guarantor/` |
| Rental operations | Rentals, Pickup & Return, Operations Board, Fleet Map, Shifts, Team Leaders | Implemented/wired | `web/tests/integration/rentals/` + `web/tests/integration/fleet/` |
| Fleet | Vehicles, Hubs, Fleet Map, Device Tracking, maintenance/inspection views | Implemented/wired | `web/tests/integration/fleet/` |
| Money | Plans & Pricing, Wallet & Deposits, Payments / Top-ups, Reports | Implemented/wired | `web/tests/integration/wallet/` + `web/tests/integration/plans/` + `web/tests/integration/transaction/` |
| Engagement | Notifications, Bulk Messaging, Rewards, Referrals, Offers & Coupons | Implemented/wired | `web/tests/integration/notifications/` + `web/tests/integration/rewards/` |
| Support | Support Tickets, FAQ Management, Incidents & Fines, Legal Documents | Implemented/wired | `web/tests/integration/support/` + `web/tests/integration/incidents/` |
| Security | Admin Users, Roles & Permissions, Audit Logs, Feature Flags | Implemented/wired | `web/tests/integration/audit/` + `web/tests/unit/rbac.test.ts` |
| Laptop operations | System Settings, Server Health, Data Management, Maintenance Mode | Implemented/wired | `web/tests/integration/laptop/` + `web/tests/integration/system/` + `web/tests/integration/backups/` |
| Coverage map | Workflow Coverage | Implemented | Manual only (this doc) |

## Rider app screens

| Workflow area | Required screens | Status | Test coverage |
|---|---|---|---|
| Auth | Splash, legal consent, permissions, login, OTP, auth choice | Implemented | `flutter/integration_test/e2e_individual/{00,01,02,03,04,05,06,17,18,43}_*.dart` |
| Onboarding | Intent of use, rider profile, signature, documents, guarantor | Implemented and reachable | `flutter/integration_test/e2e_individual/{33,34,41,44,45}_*.dart` |
| Plan/deposit | Choose plan, plan success, top-up purpose, amount, UPI, proof upload, receipt | Implemented and routed | `flutter/integration_test/e2e_individual/12_wallet_topup_test.dart` + `37_wallet_topup_balance_test.dart` |
| Pickup/rental | Pickup hub, vehicle photos, pickup verification, pickup success, active dashboard, rental details, end rental | Implemented and reachable | `flutter/integration_test/e2e_individual/{32,39,46,47}_*.dart` (pickup smoke + rental end + vehicle return) |
| Wallet | Wallet, transaction history, security deposit, top-up flow | Implemented and reachable | `flutter/integration_test/e2e_individual/{11,12,13,37}_*.dart` |
| Support | Support center, checklist, FAQ, troubleshooter, feedback | Implemented and reachable | `flutter/integration_test/e2e_individual/{20,21,22,23}_*.dart` |
| Engagement | Notifications, smart notifications, preferences, rewards, referrals | Implemented and reachable | `flutter/integration_test/e2e_individual/{09,10,29,49}_*.dart` |
| Profile/safety | Profile, edit profile, app settings, legal, emergency SOS, emergency contacts | Implemented and reachable | `flutter/integration_test/e2e_individual/{14,15,16,24,25,26,35,38,48}_*.dart` |
| App coverage hub | Workflow & Services hub | Implemented | Manual only |

## Public beta rule

Do not add a business workflow without adding both:

1. A screen entry in the appropriate admin console section.
2. A rider app screen or rider app route when the workflow is rider-facing.

Every new row added to either table MUST also include a `Test
coverage` cell with a concrete file path (e.g.
`flutter/integration_test/e2e_individual/48_emergency_sos_test.dart`
or `web/tests/integration/wallet/`) — or `Manual only` if the
workflow is not yet exercised by an automated test. This is
the audit-traceability contract; the previous "Status" column
was a binary "yes/no" and told reviewers nothing about whether
the screen was actually covered.

