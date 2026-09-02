# Dead Code Audit Reconciliation — 2026-09-02

The follow-up cleanup PR for the rider app (`chore/dead-code-removal-2026-09-02`) was scoped against a 5-item stale-audit list. After investigation on 2026-09-02, **3 of 5 items referenced files or classes that don't exist** in the tree. This note records the reconciliation so the next audit pass doesn't repeat the same false positives.

## TL;DR

| # | Audit claim | Reality on 2026-09-02 | Action |
| - | ----------- | --------------------- | ------ |
| 1 | `RiderRepository` has 6 unused methods (test-only) | 5 unused methods (not 6); `RiderRepository` is in `lib/features/profile/domain/repository.dart`, not `repositories/` | **Real** — removed in commit `98ec25a1` |
| 2 | `TopUpUpiScreen` is 589 lines of dead widget | The file does not exist. Closest matches (`top_up_proof_screen.dart`, `top_up_amount_screen.dart`, `top_up_flow.dart`) are all in active use by the router, providers, and screens | **Stale** — no file to remove |
| 3 | `RaiseTicketCard` + `TicketListItem` + `TopActionCard` are 430 lines dead | `RaiseTicketCard` and `TicketListItem` are real dead code in `support_widgets.dart` (477 lines → 47). `TopActionCard` was fictional — already removed in DARK-MODE-AUDIT 2026-08-14 PR2 (file ends with a comment explaining the removal) | **Partial** — 2 of 3 widgets removed in commit `8cb9399d` |
| 4 | `PickupEntity` / `DashboardEntity` / `GuarantorEntity` / `KycEntity` dead domain classes | `PickupEntity`, `GuarantorEntity`, `KycEntity` do not exist anywhere in the tree. Only `DashboardEntity` exists — and it was dead, removed in commit `cecb3d0a` | **Stale** — only 1 of 4 names existed |
| 5 | `BentoGrid` / `KpiGrid` / `DashboardEarningsCard` / `DashboardRentPromptCard` dead widgets | The audit's class names don't match the code. The actual dead widgets are `BentoGrid` (in `dashboard_bento_grid.dart`) and `GlassKpiTile` (in `dashboard_kpi_tile.dart`). `DashboardEarningsCard` and `DashboardRentPromptCard` are alive and used by the active dashboard | **Real, partial** — 2 of 4 removed in commit `cecb3d0a` |

## Per-item investigation details

### Item 1 — `RiderRepository` unused methods ✅ Real

- **File**: `flutter/lib/features/profile/domain/repository.dart` (audit said `repositories/rider_repository.dart` — wrong path; was renamed/restructured under `features/profile/`)
- **Interface size**: 7 methods (audit said 6 — off by one)
- **Used in production**: `getRiderProfile` (called by `rider_provider.dart:272`) and `registerFCMToken` (called by `rider_provider.dart:400`)
- **Removed**: `updateRiderProfile`, `syncDeviceData`, `getEarnings`, `getSettings`, `getDeviceDetails` (5 methods)
- **Important caveat**: the underlying `VoltiumApiClient` methods (`putRiderProfile`, `postRiderSyncDeviceData`, `getRiderEarnings`, `getRiderSettings`) are **still used** by direct calls in `kyc_repository.dart`, `earnings_screen.dart`, `edit_profile_screen.dart`, `guarantor_onboarding_screen.dart`, and `device_data_service.dart`. Only the repository wrapper was dead.
- **Followed up**: dropped the dead `ApiClient _client` field on `RiderRepositoryImpl` (it was only used by the removed `getDeviceDetails`). Constructor simplified to `RiderRepositoryImpl(this._apiClient)`. Mirrors the wallet fix in commit `305aa707`.
- **Test surface**: 2 impl test files (`test/features/profile/data/repository_impl_test.dart`, `test/repositories/profile_repository_test.dart`) slimmed to just the 2 surviving methods. 3 mock classes (`router_pickup_draft_test.dart`, `logout_reset_test.dart`, `rider_provider_test.dart`) lost the 5 dead `@override`s.

### Item 2 — `TopUpUpiScreen` ❌ Stale

- `flutter/**/top_up_upi*` returns no matches.
- Closest matches:
  - `flutter/lib/features/wallet/presentation/screens/top_up_proof_screen.dart` (referenced by `router.dart`, `top_up_proof_provider.dart`, `top_up_amount_screen.dart` — active)
  - `flutter/lib/features/wallet/presentation/screens/top_up_amount_screen.dart` (referenced by 5+ places — active)
  - `flutter/lib/features/wallet/presentation/providers/top_up_flow.dart` (state machine for the top-up wizard — active)
- **No deletion made.** Audit appears to have referenced a file from a prior design that was renamed.

### Item 3 — `RaiseTicketCard` / `TicketListItem` / `TopActionCard` ⚠️ Partial

- `RaiseTicketCard` and `TicketListItem` were confirmed dead in `flutter/lib/features/support/presentation/widgets/support_widgets.dart`. Defined but never imported anywhere — 0 references in `lib/` or `test/`.
- `TopActionCard` is **fictional** — it was already removed in DARK-MODE-AUDIT 2026-08-14 PR2. The current `support_widgets.dart` ends with a comment that explicitly explains the prior removal and tells future readers not to recreate it.
- **Out of audit scope but removed in the same commit**: `_getMonth` helper (only used by the deleted `TicketListItem`), and 2 stale imports (`theme/app_theme.dart`, `utils/toast.dart`) that the dead code was keeping alive.
- File: 477 lines → 47 lines.
- The audit also flagged `widgets/support/**` generically, which suggested the 12-widget `troubleshooter_widgets.dart` might be dead. **It is not** — all 12 widgets are actively used by `troubleshooter_screen.dart`. The 4-file grep that produced this hint was a substring false positive on `wallet_widgets.dart` (matched the word "tracker").

### Item 4 — `PickupEntity` / `DashboardEntity` / `GuarantorEntity` / `KycEntity` ❌ Stale (mostly)

- `PickupEntity` / `GuarantorEntity` / `KycEntity`: zero matches anywhere in the tree. The pickup, guarantor, and KYC features use different naming conventions (`PickupDraft`, `GuarantorFormEntity`, `KycDraft` if any; or they pass plain `Map<String, dynamic>`).
- `DashboardEntity`: confirmed dead. Defined in `flutter/lib/features/dashboard/domain/entity.dart`. Zero constructor calls in `lib/` or `test/`. The active dashboard reads state directly from `RiderProvider` / `active_dashboard_screen.dart`. **Removed** in commit `cecb3d0a`.
- The audit appears to have copy-pasted a list of "entities to check" without verifying any existed.

### Item 5 — `BentoGrid` / `KpiGrid` / `DashboardEarningsCard` / `DashboardRentPromptCard` ⚠️ Real, partial

- The audit's class names **do not match the code**:
  - `BentoGrid` lives in `flutter/lib/features/dashboard/widgets/dashboard_bento_grid.dart` (no `Dashboard` prefix). It is dead in production; only used by 1 self-referencing golden test.
  - `KpiGrid` does not exist. The actual class is `GlassKpiTile` in `flutter/lib/features/dashboard/widgets/dashboard_kpi_tile.dart`. It is dead in production; only used inside the file itself.
  - `DashboardEarningsCard` and `DashboardRentPromptCard` are **alive** — each is imported and rendered by `active_dashboard_screen.dart`. The audit's claim of "dead" is wrong for these two.
- **Removed**: `dashboard_bento_grid.dart`, `dashboard_kpi_tile.dart`, plus 3 golden tests (1 real + 2 placeholders that pumped a `Placeholder()` instead of the named widget).
- **Kept**: `dashboard_earnings_card.dart` and `dashboard_rent_prompt_card.dart`.

## Suggestions for the next audit pass

1. **Verify files exist before listing them.** A glob like `glob 'flutter/**/top_up_upi*'` (or `Get-ChildItem -Recurse`) takes 2 seconds and would have eliminated items 2 and 4 immediately.
2. **Verify classes exist before claiming they're dead.** A 1-line grep for the class name would have caught the `KpiGrid` / `TopActionCard` / `PickupEntity` mistakes.
3. **Use real production call sites, not test mocks, to determine liveness.** The 5-method RiderRepository removal found 5 dead methods; the test mocks were a red herring (they only mirror the interface).
4. **Match class names exactly.** The audit's `BentoGrid` is correct, but `KpiGrid` was a paraphrase, and `DashboardBentoGrid` was a guess that doesn't match.
5. **Prefer a tree-wide grep over a directory-level claim.** "Dead widgets in `widgets/dashboard/**`" was too broad; the right question is "which `class X` definitions in those directories have 0 production call sites?"

## What was actually shipped in this PR

| Commit | Subject | Files changed | Net lines |
| ------ | ------- | ------------- | --------- |
| `98ec25a1` | refactor(profile): drop 5 unused RiderRepository methods + dead ApiClient field | 9 | −316 |
| `8cb9399d` | refactor(support): remove dead RaiseTicketCard + TicketListItem (~430 lines) | 1 | −426 |
| `cecb3d0a` | chore(dashboard): remove dead BentoGrid, GlassKpiTile, DashboardEntity | 6 | −325 |
| **Total** | | **16** | **−1,067 lines** |

All commits verified: `flutter analyze` clean across `lib/` and `test/`; 9/9 + 21/21 tests pass across the 5 touched test files. No production API surface change. No new dependencies.
