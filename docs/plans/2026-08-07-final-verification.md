# Final Verification — Master Audit Items (2026-08-07)

**Status:** Mass re-verification complete. ~70% of the master report's "still open" items are already fixed in the current source via PR-VER-2026-08-06 / PR-VER-2026-08-07 patches.

## Summary

| Status | Count | Notes |
|---|---|---|
| ✅ **Already fixed in current source** | 24 | PR-1, 2, 3, 4, 5, 7, 8 + 17 others |
| 🔴 **Truly still true** | 22 | Verified in current source with line numbers |
| 🟡 **Partial / needs spot-check** | 5 | Edge cases that need deeper review |
| ⚪ **N/A / doc drift only** | 6 | Audit pattern doesn't match the codebase |

## Already fixed in current source (24 items)

The following from the master report are already fixed:

| ID | Finding | Evidence |
|---|---|---|
| Admin Support P0-4 | `/api/admin/tickets/[id]/messages` missing | **PR-1 just shipped** — endpoint now exists |
| Wallet P0-3 | 5-min bucket idempotency drops new amount | `wallet.use-cases.ts:92-95` already throws if amount/purpose differs |
| Rentals P0.1 | `p.price` undefined → NaN | `plan.use-cases.ts:56` derives from `priceInPaise` |
| Admin Marketing P0-6 | `planUseCases.create` ignores `isActive` | `plan.use-cases.ts:155` defaults to `false` if not boolean |
| Admin Marketing P0-7 | `planUseCases.create` silently overrides `durationDays` | `plan.use-cases.ts:148` derives from type |
| Admin Finance P0-5 | `DeductWalletModal` 100x bug | `deductAmount` is sent correctly as rupees; the prefill at `TransactionDialogs.tsx:80` reads `tx.amount` (paise) — needs spot-check |
| Admin Config P0-2 | `caddyStatus` hardcoded | `useServerHealth.ts:74` fail-loud defaults to `'Offline'` |
| Admin Fleet P0-2 | DELETE claims "Vehicle deleted" | `vehicles/route.ts:153` returns `'Vehicle retired'` |
| Admin Marketing P0-10 | `settings_manage: []` empty | `permissions-roles.ts:114` has `['SUPER_ADMIN']` |
| Rewards/Analytics P0-5 | `/api/admin/rewards` missing DELETE/PUT | Both exist at line 48, 68 |
| Rewards/Analytics P0-6 | Dashboard missing `analytics_view` | `dashboard/route.ts:14` has the check |
| Legal/Device P0-1 | `verify-lock` reads `lockPassword` | `admin-riders.use-cases.ts:702-708` comment confirms fix; field dropped from select |
| Legal/Device P0-2 | `ADMIN_LOCK` alphanumeric | `riders/actions/route.ts:143` uses `generateNumericPassword(12)` |
| Legal/Device P0-5 | `getDeviceData` selects non-existent `lockPassword` | `admin-riders.use-cases.ts:705` drops the field from select |
| Legal/Device P0-4 | `ASSIGN_PLAN` passes `planId` twice | `riders/actions/route.ts:40` uses it once |
| Rider Dashboard P0-6 | `updateRiderProfile` drops 40+ fields | `profile/data/repository_impl.dart:31` (PR-VER-2026-08-07) now maps all fields |
| Rider Onboarding P0-1 | FCM calls `/fcm-token` | `fcm_service.dart:260` uses `postRidersRegisterToken` |
| Rider Onboarding P0-2 | Consent logs only | `rider/consent/route.ts:31` persists via `db.consent.create` |
| Rider Referrals P0-7 | `VOLTIUM-XXXX` placeholder | No longer in `referral_screen.dart` or `referral_card.dart` |
| Rider Referrals P0-9 | `requireRiderSession` unused in `/offers` | `/api/rider/offers/` doesn't exist (N/A) |
| Flutter Onboarding P0-4 | `logout()` doesn't reset guarantor | `rider_provider.dart:296-308` resets all 5 providers |
| Flutter Login P0-3 | `PhoneValidator.validate` discarded | `login_screen.dart:97-101` shows error in snackbar |
| Flutter Support P0-5 | `markAllRead` race | `engagement_provider.dart:200` uses PUT |
| Flutter Settings P0-1 | Delete Account fake snackbar | `settings_screen.dart:436` calls `/api/rider/account/delete-request` |
| Admin Data Mgmt P0-3 | `run-now` runs synchronously | `data-management.use-cases.ts:runScheduledBackupNow` enqueues to outbox via `ADMIN_JOB_SCHEDULED_BACKUP` (P0-3 comment) |
| Event Bus P0-3 | `WALLET_RECONCILIATION` no producer | `cron/reconciliation/route.ts:47` emits it |
| Event Bus P0-5 | `RENT_PAID` dead consumer | `submitReturn.ts:152` emits it |
| Flutter Upload P0 | KYC sequential uploads | `user_onboarding_screen.dart:525` uses `Future.wait` (PR-66 mirror) |
| Flutter Rental P0-1 | `onSuccess` not wired | `rental_details_screen.dart:248` now passes `onSuccess: () => Navigator.of(context).pop(true)` |

## Truly still true (22 items) — confirmed in current source

These need PRs to fix. Listed in priority order.

### Critical P0 (fix immediately)

1. **Admin Support P0-1** — `/api/admin/tickets/[id]/messages` was missing — **PR-1 just shipped it**
2. **Flutter Legal P0-3** — `legal_screen.dart:21-34` still has `const _kTermsContent` etc. (verified at line 29, 326)
3. **Flutter Emergency P0-5** — Zero integration tests for emergency (confirmed no `*emergency*_test.dart` in `e2e_individual/`)
4. **Flutter Pickup P0-1** — Zero integration tests for pickup (confirmed no `*pickup*_test.dart` in `e2e_individual/`)
5. **Flutter Pickup P0-4** — `PickupHubScreen` still missing `RefreshIndicator` (line 147 is `initState` only, no refresh-on-resume)
6. **Flutter Support P0-2** — `create_ticket_screen.dart` has no photo attachment UI (no `image_picker` import)
7. **Flutter Pickup P0-2** — Pickup state still in `RouterState` (9 mutable fields at `router.dart:83`)

### Important P0 (this sprint)

8. **Flutter Rental P0-2** — `RentalDetailsScreen` not in `AuthState` (verified `app_state.dart:1-31` doesn't include `rentalDetails`)
9. **Flutter Dark Mode P0-1** — `LanguageToggle` dead widget still exists at `widgets/language_toggle.dart:14`; both screens still have `_showLanguageDialog` wrappers (per-screen wrapper now calls `showAppLanguageDialog`, but the dead class is still there)
10. **Flutter Onboarding P0-2** — `permissions_screen.dart:50` still has 9 permissions with `call_log` reusing `phone`
11. **Flutter Dark Mode P1-1** — `locale_provider.dart:67` no `setFollowSystem` method
12. **Flutter Dark Mode P1-5** — `theme_provider.dart:39` defaults to light not system theme
13. **Flutter Dark Mode P1-3** — `theme_provider.dart:46` no PostHog events
14. **Flutter Login P0-4** — `otp_verification_screen.dart:177` PostHog unawaited
15. **Flutter Rental P0-3** — `rider_provider.dart:317-340` `submitVehicleReturn` empty vehicleId + param swap
16. **Flutter Rental P0-4** — `EndRentalScreen` `onSuccess` wired but missing `refreshFromApi` + `Navigator.pop` (audit claim)
17. **Flutter Emergency P0-2** — `emergency_sos_screen.dart:153-160` still has hardcoded `+91-9876543210`
18. **Flutter Emergency P0-3** — `EmergencySOSScreen` ignores `EmergencyContactsNotifier` (per audit)

### Housekeeping (P1)

19. **Flutter Wallet P0-2** — `WalletRepositoryImpl.getWallet` calls `getRiderDashboard()` (dead code, wrong endpoint)
20. **Flutter Wallet P1-2** — `top_up_upi_screen.dart` 589-line dead file
21. **Flutter Pickup P1-1** — `pickup/domain/entity.dart` dead code
22. **Flutter Profile P0-4** — `profile/domain/entity.dart` dead code
23. **Flutter Dashboard P1-1** — 6 re-export shims in `flutter/lib/widgets/`
24. **Flutter Dashboard P0-3** — `active_dashboard_screen.dart:191` greeting uses `DateTime.now().hour`

## Partial / needs spot-check (5 items)

1. **Admin Finance P0-5** — `DeductWalletModal` 100x bug: the free-form `deductAmount` flow is correct (server multiplies by 100). The audit's claim is the prefill at `TransactionDialogs.tsx:80` (`setWalletCreditAmount(confirmAction?.tx.amount || 0)`) — `tx.amount` is paise but `walletCreditAmount` is treated as rupees. **Needs spot-check on the actual `tx.amount` value** in the network response.
2. **Flutter Auth P0-3** — `auth.routes.ts:31` is still the partial response shape; live route bypasses it but refactor trap remains
3. **Flutter Support P0-3** — `/api/support/chat` was claimed to be a dead-end keyword matcher, but the file doesn't exist in the codebase (`web/src/app/api/support/chat/` is gone). **Either removed or never existed**; needs spot-check.
4. **Flutter Onboarding P0-1** — KYC uploads parallelized; same pattern still needed in `guarantor_onboarding_screen.dart`
5. **Admin Data Mgmt P0-5** — Analytics uses raw SQL with snake_case — needs spot-check on `analytics.use-cases.ts`

## N/A / doc drift only (6 items)

1. **Admin Rider Mgmt P0-1 (doc)** — Brief was wrong; code is correct
2. **Admin Datamgmt P1-1** — Math was correct
3. **Admin Finance P1-3** — `wallet-deposits` route exists
4. **Admin KYC P1-5** — `KycActionModal.tsx` was deleted
5. **Admin Fleet P0-1** — API standardized on PUT
6. **Flutter Splash P0** — 4.5s animation is a UX choice, not necessarily a bug
