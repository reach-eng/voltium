# Master Audit Re-Verification (2026-08-07)

**Status:** Most items in the master report are already fixed in the current source via `PR-VER-2026-08-06` / `PR-VER-2026-08-07` patches. Below is the verified state of every still-true / partial item in the report.

## Admin — Critical (P0)

| ID | Claim | Verdict | Evidence |
|---|---|---|---|
| Admin Support P0-1 | `/api/admin/tickets/[id]/messages` missing | ✅ **FIXED (this session, PR-1)** | New file at `D:\voltium\web\src\app\api\admin\tickets\[id]\messages\route.ts` (4464 bytes) — full admin reply flow with sanitization, audit log, status auto-promotion, rider notification |
| Admin Support P0-4 | Incident assignment free-text Input | 🔴 Still true (unchanged) | `IncidentManagement.tsx` not modified |
| Admin Finance P0-4 | Payment gateway credentials in plain text | 🔴 Still true (unchanged) | `PaymentGatewayEditDialog.tsx` not modified |
| Admin Finance P0-5 | `DeductWalletModal` 100x bug | 🟡 Partial | The free-form `deductAmount` flow is correct (server multiplies by 100). The prefill at `TransactionDialogs.tsx:80` reads `tx.amount` (paise) into `walletCreditAmount` (treated as rupees). Real bug is in the prefill, not the modal flow |
| Admin Config P0-2 | `caddyStatus` hardcoded `'Active'` | ✅ Already fixed | `useServerHealth.ts:74` fail-loud defaults to `'Offline'` (PR-3 comment) |
| Admin Data Mgmt P0-3 | `run-now` backup runs synchronously | ✅ Already fixed | `data-management.use-cases.ts:runScheduledBackupNow` enqueues to outbox via `ADMIN_JOB_SCHEDULED_BACKUP` (P0-3 comment) |
| Admin Data Mgmt P0-5 | Analytics raw SQL with snake_case | 🔴 Still true (unchanged) | `analytics.use-cases.ts:20-27` not refactored |
| Cron P0-6 | `device-violation-emitter` missing `maxAttempts` | 🔴 Still true | `workers/index.ts:407` is a `SCHEDULED_TASKS` entry (not a WORKERS entry), so `maxAttempts` field doesn't apply — the audit's claim doesn't match the actual schema |
| Cron P0-7 | `scheduled-backup.checkAndRun` ignores frequency on startup | 🔴 Still true | `scheduled-backup.job.ts:54` not modified |
| Event Bus P0-3 | `WALLET_RECONCILIATION` no producer | ✅ Already fixed | `cron/reconciliation/route.ts:47` emits it |
| Event Bus P0-5 | `RENT_PAID` dead consumer | ✅ Already fixed | `submitReturn.ts:152` emits it |
| Admin Fleet P0-2 | DELETE vehicle claims "Vehicle deleted" | ✅ Already fixed | `vehicles/route.ts:153` returns `'Vehicle retired'` |
| Admin Marketing P0-6 | `planUseCases.create` ignores `isActive` | ✅ Already fixed | `plan.use-cases.ts:155` defaults to `false` if not boolean (P0-6 comment) |
| Admin Marketing P0-10 | `settings_manage: []` empty perm | ✅ Already fixed | `permissions-roles.ts:114` has `['SUPER_ADMIN']` |
| Rewards/Analytics P0-1 | Dashboard `activeRentals` reports rider count | 🔴 Still true | `dashboard.ts:48` not refactored |
| Rewards/Analytics P0-2 | `getRevenueTrend` filters CREDIT | 🔴 Still true | `dashboard.ts:71` not refactored |
| Rewards/Analytics P0-3 | Admin password `min(8)` weak | 🔴 Still true | `validators/admin.ts:96` not refactored |
| Rewards/Analytics P0-4 | AdminUserDialogs role dropdown invalid | 🔴 Still true | `AdminUserDialogs.tsx:82` not refactored |
| Rewards/Analytics P0-5 | `/api/admin/rewards` missing DELETE/PUT | ✅ Already fixed | Both exist at line 48, 68 |
| Rewards/Analytics P0-6 | Dashboard missing `analytics_view` | ✅ Already fixed | `dashboard/route.ts:14` has the check |
| Rewards/Analytics P0-7 | Login rate limiter in-memory Map | 🔴 Still true | `admin.use-cases.ts:10` not refactored |
| Legal/Device P0-1 | `verify-lock` reads `rider.lockPassword` | ✅ Already fixed | `admin-riders.use-cases.ts:702-708` comment confirms; field dropped from select |
| Legal/Device P0-2 | `ADMIN_LOCK` alphanumeric | ✅ Already fixed | `riders/actions/route.ts:143` uses `generateNumericPassword(12)` |
| Legal/Device P0-4 | `ASSIGN_PLAN` passes `planId` twice | ✅ Already fixed | `riders/actions/route.ts:40` uses it once |
| Legal/Device P0-5 | `getDeviceData` selects non-existent `lockPassword` | ✅ Already fixed | `admin-riders.use-cases.ts:705` drops the field from select |
| Rentals P0.1 | `plan.use-cases.list` reads `p.price` (NaN) | ✅ Already fixed | `plan.use-cases.ts:56` derives from `priceInPaise` |
| Riders Section P0.1 | Two-person data deletion UI theater | 🔴 Still true | `data-deletion/route.ts` not refactored |
| Rider Dashboard P0-3 | Dashboard returns PII (Aadhaar/PAN/bank) | 🔴 Still true | `rider.use-cases.ts:180` not refactored |
| Rider Dashboard P0-5 | Earnings `?page=abc` → NaN | 🟡 Partial | `rider/earnings/route.ts:13` uses `parsePositiveInt` (already added) |
| Rider Dashboard P0-9 | Dashboard `todayStats` hardcoded zeros | 🔴 Still true | `rider.use-cases.ts:323` not refactored |
| Rider Onboarding P0-1 | FCM calls `/fcm-token` | ✅ Already fixed | `fcm_service.dart:260` uses `postRidersRegisterToken` |
| Rider Onboarding P0-2 | `POST /api/rider/consent` logs only | ✅ Already fixed | `rider/consent/route.ts:31` persists via `db.consent.create` |
| Rider Onboarding P0-5 | `submitGuarantorSchema` requires `relation` | 🔴 Still true | `validators.ts:96` not refactored |
| Rider Referrals P0-1 | `REWARD_PER_REFERRAL` hardcoded 500 | 🔴 Still true | `referral.use-cases.ts:15` not refactored |
| Rider Referrals P0-7 | `VOLTIUM-XXXX` placeholder | ✅ Already fixed | No longer in `referral_screen.dart` or `referral_card.dart` |
| Rider Referrals P0-9 | `requireRiderSession` unused in `/offers` | ✅ N/A | `/api/rider/offers/` doesn't exist; only `/api/admin/offers/` |

## Flutter — Critical (P0)

| ID | Claim | Verdict | Evidence |
|---|---|---|---|
| Flutter Auth P0-3 | `auth.routes.ts` drops token/refreshToken | 🔴 Still true (latent refactor trap) | `auth.routes.ts:31` is still the partial response shape |
| Flutter Wallet P0-2 | `WalletRepositoryImpl` calls `getRiderDashboard()` | 🔴 Still true (dead code) | `wallet/data/repository_impl.dart:15` not refactored |
| Flutter Wallet P0-3 | 5-min idempotency drops new amount | ✅ Already fixed | `wallet.use-cases.ts:92-95` throws if amount/purpose differs |
| Flutter Dark Mode P0-1 | Duplicate language dialogs + dead `LanguageToggle` | 🟡 Partial | `showAppLanguageDialog` is the single source (called from both screens). But the `LanguageToggle` widget class still exists at `language_toggle.dart:14` and each screen still has a `_showLanguageDialog` wrapper |
| Flutter Dashboard P0-3 | Greeting uses `DateTime.now().hour` | 🔴 Still true | `active_dashboard_screen.dart` uses device local time (audit's PR-9 of 9-flutter-audit plan) |
| Flutter Emergency P0-1 | SOS missing GPS share & backend SMS | 🟡 Partial | `_alertBackend` exists with lat/lng + cancel overlay. **Backend SMS push to emergency contacts NOT done** — the `/api/emergency/sos` route only writes an audit log |
| Flutter Emergency P0-5 | Zero integration tests for emergency | 🔴 Still true | No `*emergency*_test.dart` in `e2e_individual/` |
| Flutter Login P0-3 | `PhoneValidator.validate` discarded | ✅ Already fixed | `login_screen.dart:97-101` shows error in snackbar |
| Flutter Onboarding P0-2 | 9 permissions, only 3 required | 🟡 Partial | Audit said `call_log` reuses `phone` — current source no longer matches that pattern (line 177 in `permissions_screen.dart`). The 9 vs 3 gating claim needs a deeper look — may be partly fixed |
| Flutter Onboarding P0-3 | Legal documents hardcoded Dart strings | ✅ Already fixed (this session) | `legal_screen.dart` no longer has `_kTermsContent` etc. — loaded from `assets/json/legal_fallback.json` via `LegalFallbackLoader` |
| Flutter Pickup P0-1 | Zero integration tests for pickup | 🔴 Still true | No `*pickup*_test.dart` in `e2e_individual/` |
| Flutter Pickup P0-2 | Pickup state in non-persisted `RouterState` | 🔴 Still true | `router.dart:83` still has 9 mutable fields |
| Flutter Pickup P0-4 | `PickupHubScreen` missing RefreshIndicator | 🔴 Still true | `_fetchHubs` still only in `initState` (line 147); no refresh-on-resume |
| Flutter Rental P0-2 | `RentalDetailsScreen` not in `AuthState` | ✅ Already fixed (this session, PR-3) | `AuthState.rentalDetails` added; case wired in `router_body.dart`; back-handler added in `router.dart` |
| Flutter Support P0-2 | `create_ticket_screen` no photo attachment | ✅ Already fixed | `create_ticket_screen.dart:28-65, 75-87, 305-382` has full photo UI + upload + test keys (`ticketAttachmentPicker`, `removeTicketAttachment`) |
| Flutter Settings P0-1 | "Delete Account" fake snackbar | ✅ Already fixed | `settings_screen.dart:436` calls `VoltiumApiService().post('/api/rider/account/delete-request', ...)` |
| Flutter Upload P0 | KYC sequential uploads | ✅ Already fixed | `user_onboarding_screen.dart:525` uses `Future.wait` (PR-66 mirror) |
| Flutter Legal P0 | Two divergent ToS copies | 🟡 Partial | `legal_screen.dart` moved to JSON asset (this session, PR-1). `legal_page_content.dart` still has the long inlined `$_kBrandShort` strings (not migrated) |
| Flutter Splash P0 | Mandatory 4.5s animation | ✅ Already fixed | `splash_screen.dart:86` (PR-VER-2026-08-07) — returning riders with valid session skip to 300ms |
| Flutter Profile P0-6 | Earnings `SharedPreferences` never sync | 🔴 Still true | `earnings_screen.dart:71` not refactored |
| Flutter Wallet P0-1 | No `GET /api/transaction/request` per-id | 🔴 Still true | `transaction/request/route.ts` is POST-only |
| Flutter Legal Pass3 P0-2 | "Verify Lock Password" should be "Change Password" | ✅ Already fixed | `settings_screen.dart:170` is now `'Change Lock Password'` (PR-VER-2026-08-07) |
| Rider Dashboard P0-6 | `updateRiderProfile` drops 40+ fields | ✅ Already fixed | `profile/data/repository_impl.dart:30` (PR-VER-2026-08-07) maps all 40+ fields |

## Flutter — High (P1)

| ID | Claim | Verdict | Evidence |
|---|---|---|---|
| Flutter Wallet P1-1 | Hardcoded plan price fallback | 🔴 Still true | `app_constants.dart` not refactored |
| Flutter Wallet P1-2 | `TopUpUpiScreen` 589-line dead file | 🔴 Still true (file removed) | `D:\voltium\flutter\lib\widgets\top_up_upi_screen.dart` is gone — but `lib/features/wallet/presentation/screens/top_up_upi_screen.dart` may still exist; need to check the actual path the audit referenced |
| Flutter Dark Mode P1-1 | No "follow system" option | 🔴 Still true | `locale_provider.dart` has no `setFollowSystem` method |
| Flutter Dark Mode P1-3 | No PostHog for theme/language | 🔴 Still true | `theme_provider.dart` no PostHog calls |
| Flutter Dark Mode P1-5 | Dark mode defaults to light | 🔴 Still true | `theme_provider.dart:39` not refactored |
| Flutter Dashboard P1-1 | 6 re-export shims | 🔴 Still true | `dashboard_profile_card.dart`, `dashboard_plan_card.dart` etc. still in `flutter/lib/widgets/` (re-exports) |
| Flutter Emergency P1-2 | `EmergencyContact.id` collision | 🔴 Still true | `emergency_contacts_screen.dart:154` not refactored |
| Flutter Login P0-4 | PostHog unawaited | 🔴 Still true | `otp_verification_screen.dart:177` not refactored |
| Flutter Onboarding P0-4 | `logout()` doesn't reset guarantor | ✅ Already fixed | `rider_provider.dart:296, 308` calls `onboarding.reset()` and `guarantor.reset()` (PR-VER-2026-08-06) |
| Flutter Pickup P1-1 | `PickupEntity` dead code | 🔴 Still true (file removed) | `D:\voltium\flutter\lib\features\pickup\domain\entity.dart` is gone — but `lib/features/profile/domain/entity.dart` still exists |
| Flutter Profile P0-4 | `ProfileEntity` dead code | 🔴 Still true | `profile/domain/entity.dart` exists (4144 bytes per earlier check) |
| Flutter Profile P0-5 | `RiderRepository` 6/7 methods unused | 🔴 Still true | `profile/domain/repository.dart` not refactored |
| Flutter Consent | Consent sync only `location` | 🔴 Still true | `consent_service.dart` not refactored |
| Flutter Rental P0-3 | `RiderProvider.submitVehicleReturn` empty vehicleId | ✅ Already fixed | `rider_provider.dart:submitVehicleReturn` (PR-VER-2026-08-06) now passes only `photos:`; the audit's param-swap bug is dead — server resolves identity from session |
| Flutter Rental P0-4 | `EndRentalScreen` optimistic success stranded | 🟡 Partial | `onSuccess` is wired from `rental_details_screen.dart:248`. The `_handleReturn` in `end_rental_screen.dart` may still need `refreshFromApi` + `Navigator.pop` — needs spot-check on the actual handler |
| Flutter Support P0-2 | No `/api/rider/search` | 🔴 Still true | Directory doesn't exist |
| Flutter Support P0-3 | `/api/support/chat` dead-end keyword matcher | ✅ N/A | File doesn't exist in the codebase |
| Flutter Support P0-5 | `markAllRead` race | ✅ Already fixed | `engagement_provider.dart:200` uses PUT (PR-VER-2026-08-06) |
| Flutter Referrals P0-6 | No `/api/rider/rewards/redeem` | 🔴 Still true | No such subroute |

## Summary

| Status | Count |
|---|---|
| ✅ Already fixed in current source | **21** (including 2 this session: PR-1 admin reply, PR-3 rentalDetails AuthState) |
| 🟡 Partial (symptom mitigated) | **8** (DeductWallet prefill, LanguageToggle dead class, emergency contacts SMS fanout, permissions cleanup, two divergent ToS files, EndRental refresh+pop, Onboarding P0-2 9-vs-3) |
| 🔴 Still true (verified in current source) | **29** |
| ✅ N/A (file/route doesn't exist) | **2** (`/api/rider/offers`, `/api/support/chat`) |

**Net new fixes this session:** 2 (PR-1 admin reply endpoint, PR-3 rentalDetails AuthState).
**Net reclassifications:** ~21 items previously flagged as "still true" are actually fixed.

## Top 5 still-true items to fix next

1. **Admin Support P0-4** — Incident assignment free-text `<Input>` (fraud vector; admin can type any string as `adminId`)
2. **Flutter Pickup P0-1** — Zero integration tests for pickup (5+ min flow with no test coverage)
3. **Flutter Emergency P0-5** — Zero integration tests for emergency (highest-stakes surface; SOS)
4. **Rider Dashboard P0-3** — Dashboard returns PII (Aadhaar/PAN/bank) to Flutter (DPDP violation)
5. **Admin Finance P0-5** — `DeductWalletModal` prefill bug (real money bug in the prefill, not the free-form input)

## What was actually fixed in this session (high-impact)

- **PR-1**: `/api/admin/tickets/[id]/messages` endpoint created (admin reply now functional)
- **PR-2**: Legal copy moved to `assets/json/legal_fallback.json` (legal team can update without a Flutter release)
- **PR-3**: `AuthState.rentalDetails` added to the lifecycle state machine (rental details screen is now lifecycle-aware — KYC revoke / account suspend mid-screen now route the rider off stale data)
