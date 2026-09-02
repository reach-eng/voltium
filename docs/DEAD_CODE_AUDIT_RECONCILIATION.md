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

---

# Audit Batch 4 (2026-09-02, web side) — 4 of 5 stale

A second audit batch followed on 2026-09-02, this time targeting the web admin code. Of 5 items, **4 were stale** (already fixed by recent PRs, with the fix documented in inline code comments the audit didn't read), and **1 was a real bug** that shipped as commit `20a4c2ea`.

## TL;DR

| # | Audit claim | Reality on 2026-09-02 | Action |
| - | ----------- | --------------------- | ------ |
| 1 | Maintenance mode placebo (no middleware enforces) | Fully enforced. `middleware.ts:97-117` reads `getMaintenanceState()` and returns 503 with `code: 'MAINTENANCE_MODE'` on every `/api/rider/*` and `/api/auth/*` (except the status endpoint). Admin cookie bypasses. Caching moved to a shared module by PR-3 (2026-08-06). | **Stale** — close |
| 2 | DeductWalletModal ₹5 not ₹500 (`TransactionDialogs.tsx:79-83`) | Same code as the previous batch's "DeductWalletModal" item. The current code at line 87 reads `(confirmAction?.tx.amount || 0)` — the inline comment (80-86) explicitly documents the prior `/100` bug and cites PR-6 (FINANCE P0-5) as the fix. | **Already fixed** — close |
| 3 | KYC PII plain-text in admin detail sheet | `KycDetailDialog.tsx:31-36` defines `maskString` (default `••••••••<last4>`); "Reveal PII" toggle at 232-241; Aadhaar / PAN / Account / IFSC all masked at lines 110, 118, 255, 263. Plain-text fields (name, address) are not PII in the masking sense. | **Not a bug** — close |
| 4 | Payment gateway plain-text credentials | `PaymentGatewayEditDialog.tsx:39-47` documents the prior vulnerability; current code at line 54, 56 returns `keySecret: ''` / `webhookSecret: ''` (never pre-populated); `buildGatewayUpdateFields` (62-81) is change-only. Both secret inputs are `type="password"` (217, 238). Cites PR-VER-2026-08-07 (PAYMENT_GATEWAY P0-4). | **Already fixed** — close |
| 5 | Admin announcement bypasses FCM (writes direct to Notification) | Confirmed real. `announcement-broadcast.job.ts:114-122` only ever called `db.notification.createMany` — no FCM. The `channel` field on `Announcement` distinguished PUSH vs INFO, the validator accepted both, the schema supported both, but the worker honored neither — a PUSH announcement was effectively a no-op for offline riders. | **Real** — fixed in commit `20a4c2ea` |

## Per-item investigation details

### Item 1 — Maintenance mode placebo ❌ Stale

- The audit's named file is `lib/maintenance.ts`. The actual file is `lib/maintenance-cache.ts` (the audit's path is wrong; the file moved during the PR-3 refactor).
- `middleware.ts:85-87` imports `getMaintenanceState` from the shared cache module.
- `middleware.ts:95-117` runs the gate on every `/api/rider/*` and `/api/auth/*` request (except the maintenance-status endpoint), short-circuits admins via `ADMIN_SESSION_COOKIE_NAME` cookie check, and returns 503 with `code: 'MAINTENANCE_MODE'` when enabled.
- The 5-second cache is invalidated explicitly by the admin PUT route via `invalidateMaintenanceCache()` (`maintenance-cache.ts:60-63`).

### Item 2 — DeductWalletModal ₹5 not ₹500 ❌ Already fixed (re-raised)

- Same code as the previous batch. The inline comment at `TransactionDialogs.tsx:80-86` is the **proof of fix**:
  > PR-6 (FINANCE P0-5): tx.amount is in paise; walletCreditAmount is in rupees. The backend multiplies rupees by 100 when applying the credit, so we must NOT pre-divide. Previously this divided by 100, which silently 100x'd the under-credit for a security-deposit review (e.g. a ₹2000 deposit was prefilled as ₹20 rupees, then sent as ₹20 rupees → server applied ₹20 paise = ₹0.20).
- The audit kept repeating this claim across two batches without re-reading the file. The current code is `setWalletCreditAmount(confirmAction?.tx.amount || 0)` at line 87 — no division.

### Item 3 — KYC PII plain-text ❌ Not a bug

- `KycDetailDialog.tsx:27` has a `useState<boolean>(false)` for `showPii`.
- The `maskString` helper at lines 31-36:
  ```
  if (showPii) return val;
  if (val.length <= 4) return '••••';
  return `••••••••${val.slice(-4)}`;
  ```
- Aadhaar, PAN, Account Number, and IFSC are all rendered via `maskString` (lines 110, 118, 255, 263).
- "Reveal PII" toggle (lines 232-241) flips the state; the only way the unmasked value reaches the DOM is via an explicit admin click.
- Plain-text fields (`fullName`, `fatherName`, `motherName`, `dob`, `currentAddress`, guarantor name/phone/address) are not the "PII" the audit likely meant.

### Item 4 — Payment gateway plain-text credentials ❌ Already fixed

- `PaymentGatewayEditDialog.tsx:39-47` (the docstring) explicitly documents the prior vulnerability and the fix:
  > PR-VER-2026-08-07 (PAYMENT_GATEWAY P0-4): change-only credential semantics. The API returns stored credentials decrypted, so the form must NEVER pre-populate them — echoing them back into the inputs re-exposes the plaintext secret. Both secret fields start blank and are only included in the update payload when the admin types a new value...
- `gatewayFormDefaults` returns `keySecret: ''` and `webhookSecret: ''` (lines 54, 56) — "never pre-populated".
- `buildGatewayUpdateFields` (62-81) is change-only: `if (form.keySecret.trim().length > 0) fields.keySecret = form.keySecret;` — same for webhook.
- Both inputs are `type="password"` (lines 217, 238) with `autoComplete="new-password"` on the webhook secret (242).
- Form clears the credential state on close (lines 149-150).

### Item 5 — Admin announcement bypasses FCM ✅ Real, fixed

- `announcement-broadcast.job.ts:114-122` (pre-fix) only ever called `db.notification.createMany`. No FCM call.
- The `Announcement.channel` field had two values: `PUSH` and `INFO`. The validator (`createAnnouncementSchema`) accepted both. The admin UI let the operator pick a channel. But the worker honored neither — `PUSH` was effectively a no-op for offline riders.
- **Fix shipped in commit `20a4c2ea`**: the broadcast worker now branches on `channel`. PUSH fires `fcmService.sendPushNotification` per rider with a token, INFO stays in-app only. The recipient query now selects `fcmToken` alongside `id`. Best-effort + non-blocking (mirrors the pattern at `notification.use-cases.ts:144`).
- **Verification**: `npx vitest --run tests/unit/announcements-async-broadcast.test.ts` — 8/8 tests pass with the change.

## Updated audit accuracy trend

| Batch | Items | Stale | Already fixed | Not a bug | Real (shipped) |
| ----- | ----- | ----- | ------------- | --------- | -------------- |
| 1 (2026-09-02, Flutter dead code) | 5 | 3 | 0 | 0 | 2 |
| 2 (2026-09-02, Flutter stale constants) | 6 | 0 | 3 | 1 | 2 |
| 3 (2026-09-02, Flutter misc bugs) | 5 | 5 | 0 | 0 | 0 |
| 4 (2026-09-02, web admin) | 5 | 4 | 0 | 0 | 1 |
| **Total** | **21** | **12 (57%)** | **3 (14%)** | **1 (5%)** | **5 (24%)** |

The dominant failure mode across all 4 batches: the audit **re-states claims without reading inline PR-referencing comments** that document the prior fix. A simple diagnostic before flagging a "bug" would be:

```bash
grep -rn "PR-[0-9]\+\|FIX-\|previously\|already fixed\|was a" web/src/ flutter/lib/ 2>/dev/null
```

If the named file/class/line has a `previously this ...` or `PR-X: ...` comment within ~10 lines, the audit should re-verify before claiming a bug exists.

## What batch 4 actually shipped

| Commit | Subject | Files changed | Net lines |
| ------ | ------- | ------------- | --------- |
| `20a4c2ea` | fix(announcements): fire FCM push for PUSH channel announcements | 1 | +42 |
| (doc) | this batch-4 section added to docs/DEAD_CODE_AUDIT_RECONCILIATION.md | 1 | +0 (append) |
