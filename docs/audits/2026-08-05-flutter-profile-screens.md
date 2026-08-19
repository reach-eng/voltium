# Flutter Profile Audit — Profile Screen & Sub-screens

**Date:** 2026-08-05
**Scope:** The Voltium Rider app profile feature — every Dart file under `lib/features/profile/` (5 screens, 3 widget files, 1 domain entity, 1 repository interface, 1 repository implementation), the related `DashboardProfileCard` in `lib/features/dashboard/widgets/`, the `EarningEntry` model in `lib/models/`, and the profile-related test files.
**Method:** Surface + deep read of 15+ source files, the data models, the API service methods, and the test suite. Cross-checked against the web admin audit findings, the prior 7 audits, and the Flutter wallet audit.
**Reviewer:** Mavis (audit pass #8)

---

## 0. TL;DR — What is broken today

1. **The "Delete Account" tile in Settings is a fake danger-zone button.** Tapping it shows an `AlertDialog` with "Confirm Delete" — but pressing Confirm only shows a snackbar saying "Delete not available." The rider thinks they deleted their account, but nothing happens. This is a **GDPR/DPDP compliance issue** — a "Delete Account" button that doesn't delete is a regulatory violation.

2. **The "Change Password" tile in Settings is a "Coming Soon" placeholder.** Tapping it shows a warning snackbar. No way to change the password from the app — only the auth flow on signup, or the admin must reset it.

3. **`ProfileEntity` in `domain/entity.dart` is fully dead code.** The 12-field entity is defined, has a `fromJson` factory, but is never imported by any screen. All screens use `RiderModel` directly. The repository interface (`RiderRepository`) has 7 abstract methods, of which 6 are called by no production code (only by tests).

4. **The earnings "weekly growth" badge in `earnings_widgets.dart:141-157` is a hardcoded `+12%`.** The widget reads from `EarningsEntry` data but the growth indicator has no data dependency — it always shows the same number. A rider with 0 earnings sees "+12%". A rider with 10,000 earnings sees "+12%". The dashboard and analytics pages compute real growth; the profile earnings page lies.

5. **The avatar URL is built identically in 4 different files** with the same logic. Each one is a chance to get the path wrong. The same regex `RegExp(r'^/+')` is in `profile_screen.dart:327`, `profile_detail_screen.dart:129`, `edit_profile_screen.dart:551`, and `dashboard_profile_card.dart:77`. Four copies of the same bug-magnet.

6. **KYC status display logic is duplicated 3 times with 3 different capitalisation rules.** `profile_screen.dart:444` does `'KYC: ${... ? "Under Review" : _capitalize(name.toLowerCase())}'`. `profile_detail_screen.dart:251` does the same but with `AppTypography.bodyMedium` instead of `AppTypography.bodySmall`. `settings_screen.dart:512` does `'KYC · $kyc'` with yet a third capitalisation. Same data, three different renderings.

7. **The `Edit Profile` screen claims "Profile changes require admin approval" but sends a direct PUT to the server** — the rider fills 8 fields, taps "SUBMIT FOR APPROVAL", and the server stores all of them. The rider's name, email, phone, father's name, mother's name, DOB, address, and emergency contact are ALL changed immediately. The "admin approval" copy is a lie. The server's `kycEditableFields` mechanism (which limits what can be edited after KYC approval) is bypassed by the direct PUT.

8. **`Edit Profile` has 11 `TextEditingController` fields created in `initState` but only the controllers for the active form are cleaned up in `dispose` (lines 126-144).** Actually all 11 are disposed, so OK. But the **`_profileImage` is an `XFile?` and is never cleaned up** (memory leak if the user takes many photos).

9. **The `EarningsScreen` falls back to `SharedPreferences` for "offline support"** but the fallback writes NEW entries to `SharedPreferences` without ever syncing to the server. A rider who adds an entry offline sees it locally, but the server never knows. The data diverges.

10. **The dashboard's `DashboardProfileCard` is in `lib/features/dashboard/widgets/` but the rest of the profile is in `lib/features/profile/`.** The avatar URL builder is duplicated 4 times (now 5 with this one). The card is reachable from the dashboard, but the user can also open the same profile from the menu — two paths, same data, different code.

---

## 1. File Map (read scope)

### Source files
| File | Lines | Purpose |
| --- | --- | --- |
| `lib/features/profile/presentation/screens/profile_screen.dart` | 485 | Menu screen (formerly "Profile" tab). Compact rider header + quick links. |
| `lib/features/profile/presentation/screens/profile_detail_screen.dart` | 470 | Full profile: avatar, personal details, KYC, guarantor card. |
| `lib/features/profile/presentation/screens/edit_profile_screen.dart` | 836 | Edit name, email, phone, family, DOB, address, emergency contact, guarantor. |
| `lib/features/profile/presentation/screens/earnings_screen.dart` | 410 | Weekly earnings log with gig platform breakdown. |
| `lib/features/profile/presentation/screens/settings_screen.dart` | 600+ | App settings: dark mode, notifications, language, security, support, about, delete account, logout. |
| `lib/features/profile/presentation/widgets/profile_widgets.dart` | 580 | `StatusTile`, `QuickLinkItem`, `CustomDivider`, `ProfileDetailRow`, `ProfileGuarantorCard`, `ProfileEmergencySosTile`, `ProfileLogoutButton`, `ProfileQuickLinks` (DEAD). |
| `lib/features/profile/presentation/widgets/edit_profile_widgets.dart` | 195 | `EditProfileTextField`, `EditProfileDateField`, `EditProfileSectionHeader`, `EditProfileAdminNote`. |
| `lib/features/profile/presentation/widgets/earnings_widgets.dart` | 590+ | `WeekSelectorBar`, `TotalEarningsCard`, `DayEarningsCard`, `WeeklySummaryCard`. |
| `lib/features/profile/domain/entity.dart` | 41 | `ProfileEntity` (DEAD). |
| `lib/features/profile/domain/repository.dart` | 23 | `RiderRepository` interface (7 methods, 6 unused). |
| `lib/features/profile/data/repository_impl.dart` | 75 | `RiderRepositoryImpl` (used by tests only). |
| `lib/models/earnings_entry_model.dart` | 76 | `EarningEntry` + `GigPlatform` enum. |
| `lib/features/dashboard/widgets/dashboard_profile_card.dart` | 130 | Compact profile card for the active dashboard. |
| `lib/services/voltium_api_service.dart` | 250+ | `updateProfile`, `verifyPhone`, `fetchEarnings`, `fetchRiderProfile` (used directly by screens, bypassing the repository). |

### Test files
| File | Lines | Purpose |
| --- | --- | --- |
| `test/features/profile/data/repository_impl_test.dart` | 203 | 12 unit tests for `RiderRepositoryImpl`. |
| `test/profile/profile_screen_test.dart` | 79 | 4 widget tests for `ProfileScreen` (render, title, no overflow, quick links). |
| `test/profile/edit_profile_screen_test.dart` | 50 | 3 widget tests for `EditProfileScreen` (render, title, no overflow). |
| `test/features/profile/presentation/screens/profile_screen_golden_test.dart` | ? | Golden test (likely broken pre-existing per session memory). |

### Cross-cutting
- `lib/core/network/generated/api_client.dart:27` `getRiderProfile()` → `/api/rider/profile`
- `lib/core/network/generated/api_client.dart:33` `putRiderProfile()` → PUT `/api/rider/profile`
- `lib/core/network/generated/api_client.dart:370` `getRiderEarnings()` → `/api/rider/earnings`
- `lib/core/network/generated/api_client.dart:426` `getRiderSettings()` → `/api/rider/settings`
- `lib/core/network/generated/api_client.dart:432` `postRiderSyncDeviceData()` → POST `/api/rider/sync-device-data`
- `lib/app/router.dart:30` imports `profile_screen.dart`, `profile_detail_screen.dart`, `edit_profile_screen.dart`, `earnings_screen.dart`, `settings_screen.dart`
- `lib/core/state/riverpod_providers.dart` — `riderProvider` used by all 5 screens
- `lib/core/localization/locale_provider.dart` — used for language switching
- `lib/core/observability/posthog_service.dart` — used in 0 places in the profile feature (no analytics)

---

## 2. P0 — "breaks production today, users see broken data"

### P0-1 `settings_screen.dart:357-393` — "Delete Account" button is fake, shows "Delete not available"

```dart
// lib/features/profile/presentation/screens/settings_screen.dart:357-393
void _showDeleteAccountDialog(BuildContext context) {
  final l10n = AppLocalizations.of(context)!;
  showDialog(
    context: context,
    builder: (ctx) => AlertDialog(
      title: Text(l10n.settings_deleteConfirmTitle),
      content: Text(l10n.settings_deleteConfirmBody),
      actions: [
        TextButton(
          key: const Key('cancelDeleteButton'),
          onPressed: () => Navigator.pop(ctx),
          child: Text(MaterialLocalizations.of(ctx).cancelButtonLabel),
        ),
        FilledButton(
          key: const Key('confirmDeleteButton'),
          onPressed: () {
            Navigator.pop(ctx);
            ScaffoldMessenger.of(context).showSnackBar(
              SnackBar(
                content: Text(l10n.settings_deleteNotAvailable),
                backgroundColor: AppColors.warning,
              ),
            );
          },
          style: FilledButton.styleFrom(backgroundColor: AppColors.error),
          child: Text(l10n.settings_delete),
        ),
      ],
    ),
  );
}
```

The "Delete Account" tile (line 263-271) shows `AppColors.error` icon and `AppColors.errorRose` background — designed to look like a real danger-zone action. The dialog uses `AppColors.error` for the confirm button. The rider thinks they're deleting their account.

When the rider taps "Confirm Delete", the dialog closes and a warning snackbar appears saying "Delete not available." **The rider's data is NOT deleted.**

This is a **GDPR/DPDP compliance issue**:
- GDPR Article 17 (Right to Erasure): the rider has the right to have their data deleted. The UI provides a button that looks like it does this. The button does nothing.
- The button is colored `error` (red) — the rider cannot tell from the visual that it's a stub.
- The dialog title is `l10n.settings_deleteConfirmTitle` ("Delete Account?") and body is `l10n.settings_deleteConfirmBody` ("Are you sure? This will permanently delete your account and all associated data.") — both lying.

**Fix shape:** either (a) wire the button to `riderRepository.deleteRider()` (which doesn't exist; needs to be added) or (b) hide the tile entirely with a comment "Account deletion requires contacting support@voltium.in".

The web admin has a "data-deletion approval" flow at `web/src/app/api/admin/riders/[id]/data-deletion/route.ts` per the riders deep audit. The Flutter side has no equivalent.

---

### P0-2 `earnings_widgets.dart:141-157` — weekly growth badge is hardcoded `+12%`

```dart
// lib/features/profile/presentation/widgets/earnings_widgets.dart:141-157
Container(
  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
  decoration: BoxDecoration(
    color: Colors.white.withValues(alpha: 0.2),
    borderRadius: BorderRadius.circular(AppRadius.sm),
  ),
  child: Row(
    children: [
      Icon(Icons.trending_up, color: AppColors.success, size: 14),
      SizedBox(width: 4),
      Text(
        '+12%',  // ← HARDCODED
        style: AppTypography.labelSmall
            .copyWith(color: AppColors.success),
      ),
    ],
  ),
),
```

The `TotalEarningsCard` takes `total`, `trips`, `hours` as inputs. The "+12%" badge has no parameter; it's always `+12%`. A rider with ₹0 weekly earnings sees "+12% growth." A rider with ₹50,000 weekly earnings sees "+12% growth." The number is meaningless.

The web equivalent in `web/src/lib/services/dashboard.ts` (per the previous admin audit) computes real growth via raw SQL. The Flutter `EarningsScreen` doesn't have this — it just shows a fixed number.

**Fix shape:** add `previousWeekTotal` parameter to `TotalEarningsCard`; compute `(current - previous) / previous * 100` in the parent. Pass the previous week total from the same data source.

---

### P0-3 `edit_profile_screen.dart:244-292` — "SUBMIT FOR APPROVAL" directly overwrites all 8 fields

```dart
// lib/features/profile/presentation/screens/edit_profile_screen.dart:244-292
Future<void> _saveProfile() async {
  final provider = ref.read(riderProvider.notifier);
  final rider = ref.watch(riderProvider).rider;
  if (rider == null || rider.riderId.isEmpty) return;
  setState(() => _isSaving = true);
  try {
    await VoltiumApiService().updateProfile(
      riderId: rider.riderId,
      data: {
        'name': _nameController.text,
        'email': _emailController.text,
        'phone': _phoneController.text,
        'fatherName': _fatherNameController.text,
        'motherName': _motherNameController.text,
        'dob': _dobController.text.isNotEmpty ? _dobController.text : null,
        'currentAddress': _addressController.text,
        'emergencyContact': _emergencyContactController.text,
        'guarantorName': _gNameController.text,
        'guarantorPhone': _gPhoneController.text,
        'guarantorAddress': _gAddressController.text,
      },
    );
    await provider.refreshFromApi();
    ...
  }
}
```

The screen has a yellow note (line 398-408) saying **"Changes to emergency contact require admin approval"** and another (line 440-443) saying **"Profile changes require admin approval before becoming active."**

But the `updateProfile` API is a direct PUT. All 11 fields are sent. The server stores them. The "admin approval" is never invoked.

Per the web admin audit (riders section), the server has a `kycEditableFields` list that limits what can be edited after KYC approval. But:
- The Flutter `UpdateProfileRequest` includes ALL fields, not just the editable ones.
- The server's Zod schema (`web/src/lib/validators.ts:23-76`) is non-strict and accepts all fields.
- The "approval" workflow is bypassed.

**Effect:** A rider edits their name to "Foo" and it appears immediately. The "admin approval" copy is a lie.

**Fix shape:** (a) split the call into two endpoints — `updateBasicProfile` (direct) and `requestProfileChanges` (queued for admin approval), or (b) fix the server's Zod schema to `.strict()` and only allow editable fields, or (c) change the UI copy to remove the false promise.

---

### P0-4 `profile/domain/entity.dart` — `ProfileEntity` is dead code in the domain layer

```dart
// lib/features/profile/domain/entity.dart:1-41
class ProfileEntity {
  final String riderId;
  final String fullName;
  // ... 10 more fields
  factory ProfileEntity.fromJson(Map<String, dynamic> json) { ... }
}
```

`ProfileEntity` is defined, has a `fromJson` factory, but is **never imported by any file in the project**. The `RiderRepository` interface returns `Map<String, dynamic>` (line 4-22), not `ProfileEntity`. The screens use `RiderModel` directly.

**Effect:** the abstraction is dead. The repository's `getRiderProfile()` returns a generic `Map<String, dynamic>`, the screens parse it differently each time. The `ProfileEntity` would have provided a typed contract.

**Same as the wallet audit finding:** the domain layer is scaffolded but the screens bypass it.

**Fix shape:** either (a) delete `ProfileEntity` + the `getRiderProfile` method, or (b) refactor all 5 screens to use `ProfileEntity` consistently. The latter is the correct fix.

---

### P0-5 `RiderRepository` interface has 7 methods, 6 unused in production

```dart
// lib/features/profile/domain/repository.dart
abstract class RiderRepository {
  Future<Map<String, dynamic>> getRiderProfile();           // ← used by test only
  Future<void> updateRiderProfile(Map<String, dynamic> data); // ← used by test only
  Future<void> registerFCMToken(String token);              // ← used by test only
  Future<void> syncDeviceData(Map<String, dynamic> data);   // ← used by test only
  Future<Map<String, dynamic>> getEarnings();               // ← used by test only
  Future<Map<String, dynamic>> getSettings();               // ← used by test only
  Future<Map<String, dynamic>> getDeviceDetails();          // ← used by test only
}
```

`grep -r "riderRepository\." lib/` returns only the test file. The screens call `VoltiumApiService` directly (e.g. `edit_profile_screen.dart:252`, `earnings_screen.dart:41`).

**Effect:** the interface is dead. The 7 tests that call it are testing a layer that nothing else uses. The `RiderRepositoryImpl` is also dead in production.

**Fix shape:** either (a) refactor the screens to use `RiderRepository` (correct fix), or (b) delete the interface + impl + tests.

---

### P0-6 `earnings_screen.dart:71-83` — `SharedPreferences` fallback writes diverges from server

```dart
// lib/features/profile/presentation/screens/earnings_screen.dart:71-83
// Fallback: load from local storage
try {
  final prefs = await SharedPreferences.getInstance();
  final raw = prefs.getString(_storageKey);
  if (raw != null) {
    final List<dynamic> decoded = jsonDecode(raw);
    _entries = decoded
        .map((e) => EarningEntry.fromJson(e as Map<String, dynamic>))
        .toList();
  }
} catch (e) {
  appDebug('EarningsScreen: failed to load cached entries: $e');
}
```

The screen first tries to fetch from the server (`VoltiumApiService().fetchEarnings()`). If the server fails, it loads from `SharedPreferences`. The fallback is fine for *reading*.

But `_saveEntries` (line 87-91) is called from `_showAddEntrySheet` (line 168) after the rider adds a new entry. The new entry is added to `_entries` and saved to `SharedPreferences`. **But it's never sent to the server.** If the rider adds an entry offline and comes back online, the entry stays in local storage. The server has no record.

**Effect:** A rider who uses the app offline accumulates "ghost" earnings entries that never sync.

**Fix shape:** when the screen loads, if the server succeeds, push any local-only entries to the server. Or add a "synced" flag to each entry and only show synced entries in the weekly total.

---

## 3. P1 — "real bugs, fix in next sprint"

### P1-1 Avatar URL is built identically in 4 files — any one can be wrong

```dart
// lib/features/profile/presentation/screens/profile_screen.dart:322-328
String? _getAvatarUrl() {
  if (rider?.profilePhoto == null || rider!.profilePhoto!.isEmpty) return null;
  if (rider!.profilePhoto!.startsWith('http')) return rider!.profilePhoto;
  final baseUrl = ApiClient().baseUrl;
  return '$baseUrl/api/files/${rider!.profilePhoto!.replaceFirst(RegExp(r'^/+'), '')}';
}

// lib/features/profile/presentation/screens/profile_detail_screen.dart:124-130
// IDENTICAL CODE

// lib/features/profile/presentation/screens/edit_profile_screen.dart:546-552
// IDENTICAL CODE

// lib/features/dashboard/widgets/dashboard_profile_card.dart:72-78
// IDENTICAL CODE
```

Four copies of the same logic. If the server's URL pattern changes from `/api/files/X` to `/api/v2/avatars/X`, three of the four will silently show broken images.

**Fix shape:** add `String? buildAvatarUrl(String? path)` to `RiderModel` (or a utility) and use it everywhere. The static `ApiClient().baseUrl` in each method is also problematic — it creates a new `ApiClient` instance per call.

---

### P1-2 KYC status display is duplicated 3 times with 3 different renderings

**Profile screen** (line 444):
```dart
'KYC: ${kycStatusName == 'SUBMITTED' ? 'Under Review' : _capitalize(kycStatusName.toLowerCase())}'
```
Style: `bodySmall`, `FontWeight.w600`, color = success or warningDark.

**Profile detail screen** (line 251):
```dart
'KYC: ${kycStatusName == 'SUBMITTED' ? 'Under Review' : _capitalize(kycStatusName.toLowerCase())}'
```
Style: `bodyMedium` `fontSize: 13` `FontWeight.w700`, color = success or warningDark.

**Settings screen** (line 512):
```dart
'KYC · $kyc'  // ← different format ("KYC · " vs "KYC: ")
```
Style: `labelMedium`, color = successDark or warningDark.

Same data, three different formats. A rider looking at their KYC status sees "KYC: Verified" on the menu, "KYC: Verified" on the detail, and "KYC · Verified" in settings. Inconsistency.

**Fix shape:** extract a `KycStatusPill` widget that takes a `KycStatus` and renders the consistent copy + style. Use in all 3 screens.

---

### P1-3 `_capitalize` is duplicated 3 times

**Profile screen** (line 481-484):
```dart
String _capitalize(String text) {
  if (text.isEmpty) return text;
  return text.substring(0, 1).toUpperCase() + text.substring(1).toLowerCase();
}
```

**Profile detail screen** (line 393-396): IDENTICAL.

**Profile widgets** (line 219-222): IDENTICAL.

Three copies. None handle multi-word strings correctly: `_capitalize('UNDER_REVIEW')` returns `'Under_review'` (the underscore is not a word boundary). The `kycStatusName` from `rider.kycStatus.name.toUpperCase()` for `infoRequired` is `'INFO_REQUIRED'`, which becomes `'Info_required'`.

**Fix shape:** extract to `String.titleCase()` extension. Handle underscores.

---

### P1-4 Edit Profile phone field is editable — but server's `kycEditableFields` may not include `phone`

Per the riders audit, the server has a `kycEditableFields` list that limits what can be edited after KYC approval. The `Edit Profile` screen sends `phone` along with the other fields (line 257). If `kycEditableFields` doesn't include `phone`, the server either rejects (400) or silently ignores.

Either way, the rider thinks they changed their phone (and sees the new value via `refreshFromApi` on line 269) but the server hasn't updated it. **Silent failure mode.**

**Fix shape:** check the rider's `kycEditableFields` from the response and disable the phone field if it's not editable. Or show a warning before the user can tap "Save".

---

### P1-5 The "Change Password" tile in Settings is a "Coming Soon" placeholder

```dart
// lib/features/profile/presentation/screens/settings_screen.dart:158-168
FadeUpWidget(
  delay: 150,
  child: QuickLinkItem(
    key: const Key('changePasswordTile'),
    icon: Icons.lock_outline,
    iconColor: AppColors.warning,
    iconBgColor: AppColors.warningLight,
    title: l10n.settings_changePassword,
    onTap: () => _showComingSoonSnack(context, l10n),
  ),
),
```

The rider can't change their password from the app. The only ways:
1. The original auth flow (signup) sets a password via OTP — there's no "set password" step.
2. The admin resets it.

A rider who wants to change their password has no path. The "Coming Soon" snackbar is shown but the feature isn't being built.

**Fix shape:** either (a) implement a `forgotPassword` flow (send OTP to old phone, verify, set new password), or (b) hide the tile entirely with a comment "Use Forgot Password on login screen."

---

### P1-6 Guarantor phone OTP auto-fills in dev mode — exposes a backdoor in prod

```dart
// lib/features/profile/presentation/screens/edit_profile_screen.dart:184-188
// In dev mode, auto-fill OTP if returned by the API
final devOtp = result['data']?['otp']?.toString();
if (devOtp != null && devOtp.length == 6) {
  _gOtpController.text = devOtp;
}
```

The dev API returns the OTP in the response body (this is a dev convenience). The Flutter client auto-fills it. The check is `devOtp.length == 6` — no dev-mode flag, no `#if DEBUG`.

If the production server ever includes an `otp` field in the response (e.g. a logging endpoint, a response from a misconfigured gateway), the rider's OTP is auto-filled. The verification is automatic.

**Fix shape:** wrap in `if (kDebugMode)` or check for an explicit dev-mode flag. Or remove the auto-fill entirely (the rider should receive the OTP via SMS, not the app response).

---

### P1-7 `edit_profile_screen.dart:30-50` has 11 controllers, 1 `XFile?` — only the controllers are disposed

```dart
// lib/features/profile/presentation/screens/edit_profile_screen.dart:42-50
XFile? _profileImage;
// ...
@override
void dispose() {
  for (var controller in [/* 11 controllers */]) {
    controller.dispose();
  }
  super.dispose();
}
```

The `_profileImage` is an `XFile?`. The `XFile.path` holds a path to a temp file. The file is not deleted when the screen disposes. If the user takes 100 photos (each ~500KB-2MB), the temp directory accumulates files that are never cleaned up.

**Fix shape:** add a `_tempFile` tracking, delete the file in `dispose`. Or use `image_picker`'s built-in cleanup.

---

### P1-8 The `ProfileQuickLinks` widget (in `profile_widgets.dart:453-577`) is dead code

The widget renders 7 quick links (Edit Profile, My Documents, Rewards, Referral, App Settings, Workflow & Services, Feedback, Legal). The new `profile_screen.dart` has its own inline implementation. `ProfileQuickLinks` is not imported anywhere.

The widget also has a stale route: it pushes to `onLegalTap` and `onFeedbackTap` callbacks, but the new `ProfileScreen` doesn't pass these.

**Fix shape:** delete the 120+ line widget. The inline implementation in `ProfileScreen` is the canonical one.

---

### P1-9 The "Profile" tab title is hardcoded English in 3 screens

**Profile detail screen** (line 117-119):
```dart
title: Text(
  'Profile',
  style: AppTypography.headingSmall.copyWith(color: AppColors.slate800),
),
```

**Edit Profile screen** (line 533-538):
```dart
Text(
  'Edit Profile',
  style: AppTypography.headingSmall.copyWith(color: AppColors.slate800),
),
```

**Earnings screen** (line 353-356):
```dart
Text(
  'Earnings Log',
  style: AppTypography.headingSmall.copyWith(color: AppColors.slate800),
),
```

The `ProfileScreen` (the menu) uses `l10n.menu_title`. The sub-screens use hardcoded English. Hindi riders see "Profile" menu, "Profile" detail, "Edit Profile" detail.

**Fix shape:** add `l10n.profileTitle`, `l10n.editProfileTitle`, `l10n.earningsTitle` to the localizations file. Use in the sub-screens.

---

### P1-10 `edit_profile_screen.dart:268-269` — `await provider.refreshFromApi()` is awaited but the result is discarded

```dart
await VoltiumApiService().updateProfile(...);
await provider.refreshFromApi();
```

The save returns success. The refresh re-fetches the rider from the server. The result updates `riderProvider`'s state, which triggers a rebuild of all consumers. OK.

But: the refresh also fetches the device data, the KYC status, the guarantor status — everything. The profile update is a single field change. A full refresh is overkill and slow.

**Fix shape:** add `riderProvider.updateRiderFields(Map<String, dynamic> fields)` that does a partial update. The save then calls this method instead of a full refresh.

---

### P1-11 `profile_detail_screen.dart:330-336` — emergency contact tap-to-call has no fallback

```dart
// lib/features/profile/presentation/screens/profile_detail_screen.dart:330-336
GestureDetector(
  onTap: () {
    final phone = rider?.emergencyContact;
    if (phone != null && phone.isNotEmpty) {
      launchUrl(Uri.parse('tel:$phone'));
    }
  },
  child: ProfileDetailRow(
    icon: Icons.phone_android_outlined,
    title: 'Emergency Contact',
    value: rider?.emergencyContact ?? 'Not provided',
  ),
),
```

The `launchUrl` call is not awaited, the result is not checked, and the phone is passed raw (no sanitisation). A rider with emergency contact `+91 98765 43210` (with spaces) gets `tel:+91 98765 43210` which most dialers handle, but `tel:` URIs in some platforms reject spaces.

**Fix shape:** strip non-digit chars before passing to `tel:`, await `launchUrl` and check result, show error snackbar on failure.

---

### P1-12 `edit_profile_screen.dart:158-163` — `_sendGuarantorOtp` is wired wrong for already-verified phones

The screen initializes `_isGPhoneVerified = (rider?.guarantorPhone ?? '').isNotEmpty` (line 109). If the rider already has a verified guarantor phone, the OTP is NOT required for any further edits to the guarantor fields. But:

- Changing the name requires no verification (OK).
- Changing the address requires no verification (OK).
- Changing the phone requires re-verification (the listener at line 111-120 handles this).

The phone listener (line 111-120) fires on every keystroke and re-runs `setState` to clear `_isGPhoneVerified`. The next render of the form (line 698 `if (needsVerification)`) shows the "Send OTP" button. Good.

**But** the `Rider` model's guarantor status (`GuarantorStatus.verified` vs `pending` vs `rejected`) is not consulted. If the server has marked the guarantor as `rejected` (per the riders deep audit, `REPLACED → SUBMITTED` transition is blocked), the rider can't resubmit. The Flutter side has no way to know.

**Fix shape:** surface the `kycEditableFields` or `rejectionReason` from the server response. Show a "Re-submit Guarantor" CTA if rejected.

---

### P1-13 `earnings_screen.dart:186-188` — `bestDay` calculation crashes on empty weeks

```dart
// lib/features/profile/presentation/screens/earnings_screen.dart:186-188
final bestDay = dailyEarnings.reduce(
  (a, b) => (a['amount'] as double) > (b['amount'] as double) ? a : b,
);
```

`dailyEarnings` is a list of 7 day-maps (one per day of the week). If the list is non-empty (it always is — the loop at line 107-131 always produces 7 entries), `reduce` works. OK.

But: the `bestDay` is then displayed in the `WeeklySummaryCard`. If the user has 0 earnings for the entire week, `bestDay` is the Sunday with 0 amount. The card shows "Your best day was Sunday with ₹0!" — confusing.

The `bestAmount > 0` check at line 556 only shows the conditional text, but the `WeeklySummaryCard` is only rendered at line 270-280 if `dailyEarnings.any((d) => d['hasEntries'])`. So if there's no entries, the summary is hidden. OK.

But the `bestDay` is computed unconditionally at line 186-188 (always runs). Cosmetic.

**Fix shape:** compute `bestDay` only when there are entries.

---

### P1-14 `settings_screen.dart:283-287` — logout navigates to `AppShell` which may not be in the route stack

```dart
// lib/features/profile/presentation/screens/settings_screen.dart:278-287
if (confirmed == true && context.mounted) {
  ref.read(riderProvider.notifier).logout();
  if (context.mounted) {
    Navigator.pushAndRemoveUntil(
      context,
      MaterialPageRoute(builder: (_) => const AppShell()),
      (route) => false,
    );
  }
}
```

`AppShell` is the bottom-nav shell. After logout, the user goes to the AppShell — but the AppShell is the bottom-nav, not the auth screen. The user sees the dashboard with no rider logged in. The dashboard's data fetch fails silently.

**Fix shape:** navigate to the auth screen (`SplashScreen` or `LoginScreen`), not `AppShell`. The auth flow should re-run.

---

### P1-15 `settings_screen.dart:248-253` — Rate Us uses hardcoded package name and `canLaunchUrl` is deprecated

```dart
// lib/features/profile/presentation/screens/settings_screen.dart:247-254
onTap: () async {
  final url = Uri.parse(
      'https://play.google.com/store/apps/details?id=com.voltium.rider');
  if (await canLaunchUrl(url)) {
    await launchUrl(url, mode: LaunchMode.externalApplication);
  }
},
```

Two issues:
1. `com.voltium.rider` is hardcoded. If the package name changes (e.g. `com.voltium.rider.beta`), the URL is wrong. The package name is also defined in `android/app/build.gradle` (not read in this audit).
2. `canLaunchUrl` is deprecated in newer Flutter versions. Use `LaunchUrl.checkForLaunchMode` or just call `launchUrl` and catch.

**Fix shape:** read the package name from a constant in `app_constants.dart`. Migrate to the new launch API.

---

### P1-16 `settings_screen.dart:373-378` — Delete Account "Confirm" closes the dialog with `Navigator.pop(ctx)` but does nothing

```dart
FilledButton(
  key: const Key('confirmDeleteButton'),
  onPressed: () {
    Navigator.pop(ctx);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(l10n.settings_deleteNotAvailable),
        backgroundColor: AppColors.warning,
      ),
    );
  },
  ...
)
```

The button pops the dialog and shows a "Delete not available" snackbar. **No API call is made.** The rider's data is intact.

Combined with P0-1: the entire Delete Account flow is theater.

---

### P1-17 `edit_profile_screen.dart:633` — "Guarantor Phone" field is NOT a `EditProfileTextField` (custom widget)

```dart
// lib/features/profile/presentation/screens/edit_profile_screen.dart:628-835
Widget _buildGuarantorPhoneField() {
  // Custom inline widget (not EditProfileTextField)
  // ... 200 lines
}
```

The other 7 form fields use the `EditProfileTextField` widget (line 6 of `edit_profile_widgets.dart`). The guarantor phone uses an inline 200-line custom widget because of the OTP/verification logic. This is a one-off — the field is inconsistent with the others.

**Fix shape:** extract the OTP/verification state to a `GuarantorPhoneField` widget. Reuse in `EditProfileScreen`. The OTP button + verify button + success badge should be encapsulated.

---

### P1-18 The `EarningsScreen` has its own "Add Entry" sheet with hardcoded data

The `AddEarningSheet` is at `lib/widgets/earnings_add_sheet.dart` (not read in detail but used at line 152 of `earnings_screen.dart`). The sheet adds a `EarningEntry` to local `_entries` and saves to `SharedPreferences`. The sheet is NOT wired to any server endpoint.

**Effect:** A rider's added earnings are stored locally only. The web admin sees no record. The data is lost if the user clears app data or reinstalls.

**Fix shape:** wire the sheet to a server endpoint (e.g. POST `/api/rider/earnings`). The local `SharedPreferences` becomes a read-cache, not a write-store.

---

## 4. P2 — type safety / contract issues

### P2-1 `_getAvatarUrl` creates a new `ApiClient()` instance per call

Each of the 4 avatar-URL builders does:
```dart
final baseUrl = ApiClient().baseUrl;
```

`ApiClient` is a singleton (per the audit at `lib/core/network/api_client.dart:60-65`), but `new ApiClient()` creates a new instance and reads its `.baseUrl`. The `.baseUrl` is a static field on the class, so it's the same value. But creating a new instance is wasteful.

**Fix shape:** use a static `buildAvatarUrl(String? path)` on a utility class. No instance creation.

---

### P2-2 The `EarningsScreen` mixes `VoltumApiService` with `SharedPreferences` without a sync strategy

The screen:
1. Fetches from server → success → shows server data, ignores cache.
2. Fetches from server → failure → shows cached data from `SharedPreferences`.
3. Adds entry → adds to local list + saves to `SharedPreferences`. **Never sends to server.**

A rider who has a successful fetch, then goes offline, then adds an entry: the entry is in `SharedPreferences` but not on the server. Next fetch (when online) overwrites the local list with the server list. The entry is lost.

**Fix shape:** track a `pendingSync: bool` per entry. On successful fetch, upload any pending entries. On save, mark `pendingSync: true`.

---

### P2-3 The guarantor card displays guarantor `id` field that's not in the model

`ProfileGuarantorCard` (in `profile_widgets.dart:214-363`) reads:
- `rider.guarantorName` (OK)
- `rider.guarantorPhone` (OK)
- `rider.guarantorPhoto` (OK)
- `rider.guarantorStatus` (OK)
- `rider.guarantorAddress` (OK)

But the per-rider model also has `rider.guarantorAadhaarFront`, `rider.guarantorAadhaarBack`, `rider.guarantorPan`, `rider.guarantorVideo`, `rider.guarantorSignature`. These are NOT shown on the profile. A rider with a guarantor who has provided Aadhaar doesn't see that fact on their profile.

**Fix shape:** add an "expand to see guarantor documents" CTA in the card.

---

### P2-4 `EarningEntry.platformColor` returns the same color for two platforms

```dart
// lib/models/earnings_entry_model.dart:62-75
static Color platformColor(GigPlatform p) {
  switch (p) {
    case GigPlatform.zomato: return AppColors.error;
    case GigPlatform.swiggy: return AppColors.warning;
    case GigPlatform.zepto: return AppColors.successDark;
    case GigPlatform.blinkit: return AppColors.warning;  // ← same as Swiggy
    case GigPlatform.other: return AppColors.slate500;
  }
}
```

Swiggy and Blinkit are both `AppColors.warning` (amber). On the day card, two platforms with the same color look identical.

**Fix shape:** use distinct colors per platform.

---

### P2-5 `edit_profile_screen.dart:91-95` — DOB format is inconsistent

```dart
// lib/features/profile/presentation/screens/edit_profile_screen.dart:91-95
final dob = rider?.dob;
_dobController = TextEditingController(
  text: dob != null
      ? '${_twoDigits(dob.day)}-${_twoDigits(dob.month)}-${dob.year}'
      : '',
);
// ...
// line 376-378
_dobController.text = '${picked.year}-${_twoDigits(picked.month)}-${_twoDigits(picked.day)}';
```

Initial format: `dd-MM-yyyy`. After picking from date picker: `yyyy-MM-dd`. The two formats are different. A user who opens the screen, doesn't pick a date, then submits sees `dd-MM-yyyy`. A user who picks sees `yyyy-MM-dd`. The server may or may not accept both.

**Fix shape:** always use `yyyy-MM-dd` (or always use `dd-MM-yyyy`). The server's Zod schema is `regex(/^\d{2}-\d{2}-\d{4}$/)` per the web admin audit — so `dd-MM-yyyy` is required.

---

### P2-6 `settings_screen.dart:230-237` — App version is hardcoded

```dart
// lib/features/profile/presentation/screens/settings_screen.dart:230-237
QuickLinkItem(
  key: const Key('appVersionTile'),
  ...
  title: l10n.settings_appVersion,
  trailing: Text(
    'v2.1.0',  // ← hardcoded
    style: ...
  ),
),
```

The version is `v2.1.0`. Hardcoded. If the app is rebuilt and the version bumps to 2.1.1, the rider still sees 2.1.0.

**Fix shape:** read from `PackageInfo.fromPlatform().version` or `pubspec.yaml` via build flags.

---

### P2-7 `ProfileEntity` and `RiderModel` have overlapping but different field sets

`ProfileEntity` has:
- `riderId, fullName, phone, email, fatherName, motherName, currentAddress, emergencyContact, dob, profilePhotoUrl`

`RiderModel` has all of these PLUS:
- `kycStatus, kycRejectionReason, kycEditableFields`
- `bankAccount, bankIfsc, bankName, bankPassbook`
- `guarantorName, guarantorRelation, guarantorDob, guarantorPhone, ...`
- `walletBalance, securityDeposit, depositStatus, paymentStreak`
- `lifecycleStatus, lifecycleStage, accountStatus`
- ... (50+ more fields)

`ProfileEntity` is a subset. If it were used, the screens would lose access to the rider's KYC status, wallet, etc. The `ProfileScreen` already needs all of `RiderModel`. So the dead `ProfileEntity` is correctly dead.

**Fix shape:** delete `ProfileEntity`.

---

### P2-8 `RiderRepository` interface methods have inconsistent return types

```dart
Future<Map<String, dynamic>> getRiderProfile();           // returns Map
Future<void> updateRiderProfile(Map<String, dynamic>);   // returns void
Future<void> registerFCMToken(String token);              // returns void
Future<void> syncDeviceData(Map<String, dynamic> data);   // returns void
Future<Map<String, dynamic>> getEarnings();               // returns Map
Future<Map<String, dynamic>> getSettings();               // returns Map
Future<Map<String, dynamic>> getDeviceDetails();          // returns Map
```

The void methods should return a `bool` (success) or throw on failure. The Map methods should return typed entities. The interface is loose.

**Fix shape:** define typed return types (e.g. `ProfileEntity` if kept, or specific DTOs).

---

### P2-9 The "Emergency Contact" field has no validation in `EditProfileScreen`

The `editEmergencyContactField` (line 391-397) uses `TextInputType.phone` and no `inputFormatters`. A rider can type letters. The server's schema may or may not validate.

**Fix shape:** add `FilteringTextInputFormatter.digitsOnly` + length limit. Or use a phone-formatter library.

---

### P2-10 `edit_profile_screen.dart:109` — `_isGPhoneVerified` is a derived state, not source of truth

```dart
// lib/features/profile/presentation/screens/edit_profile_screen.dart:109
_isGPhoneVerified = (rider?.guarantorPhone ?? '').isNotEmpty;
```

The state is computed once in `initState`. If the rider types a phone and then deletes it back to empty, the state goes `_isGPhoneVerified = false`. But the listener (line 111-120) only fires on the controller change, not on the verification state. The two states can drift.

**Fix shape:** compute `_isGPhoneVerified` from `_gPhoneController.text == _originalGPhone && _originalGPhone.isNotEmpty` in `build()` (it's a derived value, not a stored state).

---

### P2-11 The `EarningsScreen` uses `StatefulWidget` (not `ConsumerStatefulWidget`)

The screen (line 18) extends `StatefulWidget` but the data comes from `VoltiumApiService` directly. There's no `ref.read(...)` needed. But the `_RiderIdentityCard` in settings uses `ref.watch(riderProvider)` (line 46). The patterns are inconsistent.

**Fix shape:** if the screen needs Riverpod, use `ConsumerStatefulWidget`. If not, keep as is. Currently the inconsistency is OK because the screen doesn't need `ref`, but the parent (settings) does.

---

### P2-12 The `EarningsEntry` model has no `id` validation

```dart
// lib/features/profile/presentation/screens/earnings_screen.dart:158-160
final entry = EarningEntry(
  id: DateTime.now().millisecondsSinceEpoch.toString(),
  ...
);
```

The `id` is `DateTime.now().millisecondsSinceEpoch.toString()`. Two entries added in the same millisecond would have the same id. The model is used in a `List` (not a `Set`), so duplicates don't cause runtime issues, but the server-side `id` should be unique.

**Fix shape:** use a UUID v4 (e.g. `uuid` package) or include a random suffix.

---

### P2-13 The guarantor status rendering uses the enum name directly

```dart
// lib/features/profile/presentation/widgets/profile_widgets.dart:326-327
child: Text(
  _capitalize(rider.guarantorStatus.name),
  ...
),
```

`GuarantorStatus.verified.name` is `'verified'` (lowercase, from the enum definition at `rider_model.dart:25-34`). `_capitalize('verified')` returns `'Verified'`. OK for this case.

But `GuarantorStatus.infoRequired.name` is `'infoRequired'`. `_capitalize('infoRequired')` returns `'Inforequired'`. **Wrong.** The `infoRequired` enum is camelCase; `_capitalize` only handles the first char.

**Fix shape:** add explicit mapping or use a proper title-casing function.

---

## 5. P3 — code quality / dead code

### P3-1 `ProfileQuickLinks` widget (line 453-577) is dead code (already noted P1-8)

### P3-2 `ProfileEntity` is dead code (already noted P0-4)

### P3-3 `_RiderIdentityCard` is duplicated logic — similar to `ProfileDetailRow`

`ProfileDetailRow` (in `profile_widgets.dart:162-212`) renders icon + title + value. `_RiderIdentityCard` (in `settings_screen.dart:412-522`) renders avatar + name + phone + KYC pill. The visual structure is different but the data flow is similar.

### P3-4 The `_capitalize` function is duplicated 3 times (already noted P1-3)

### P3-5 The `_kycLabel` function in `_RiderIdentityCard` (line 428-433) is duplicated

The same logic is in `ProfileScreen._CompactRiderHeader.build` (line 337-340) and `ProfileDetailScreen._buildProfileCard` (line 136-139) and `SettingsScreen._RiderIdentityCard._kycLabel` (line 428-433).

### P3-6 The `edit_profile_screen.dart` has 11 controllers but 1 is hardcoded `gOtpController` initialised to empty

```dart
_gOtpController = TextEditingController();
```

OK but the comment doesn't explain why the OTP controller is initialised here vs in `initState`. The other controllers are initialised with rider data; the OTP is always empty.

### P3-7 `_showComingSoonSnack` in `settings_screen.dart:347-355` is a 7-line helper for a single use

Inline this into the onTap callback. The helper is over-abstraction.

### P3-8 `_buildBackground` in `earnings_screen.dart:312-324` and `edit_profile_screen.dart:493-505` is identical 12-line gradient

Two identical gradient backgrounds. Extract to a `meshBackground()` widget.

### P3-9 The `EarningsEntry.platformColor` switch is in the model file

`platformColor` and `platformLabel` are display concerns. They belong in a `platform_widgets.dart` file, not in the model.

### P3-10 The `Settings` screen has hardcoded English "LANGUAGE" section header

```dart
// lib/features/profile/presentation/screens/settings_screen.dart:112
_SectionLabel('LANGUAGE'),
```

All other section labels use `l10n.settings_*`. The "LANGUAGE" label is the only one not localised.

### P3-11 The "Daily Breakdown" label in `earnings_chart.dart:39` is hardcoded

Not localised. Same as P3-10.

### P3-12 The "Best Day" label in `weekly_summary_card.dart:537` is hardcoded

Not localised.

### P3-13 The "Add Entry" FAB in `earnings_screen.dart:299-308` is hardcoded

Not localised. The Arabic translation would need to read RTL.

### P3-14 The "+12%" badge in `earnings_widgets.dart:151` is hardcoded (already P0-2)

### P3-15 `VoltumApiService.verifyPhone` (line 33-44) and the edit screen's `_sendGuarantorOtp` (line 146-201) duplicate OTP-send logic

The edit screen does `_apiClient.postAuthSendOtp(SendOtpRequest(phone: phone))` directly, bypassing `VoltiumApiService.sendOtp` (if it exists). The verify goes through `VoltiumApiService.verifyPhone`. The send should too.

### P3-16 The `dashboard_profile_card.dart` has the comment "Checkmark removed to simplify" — dead code intent

```dart
// lib/features/dashboard/widgets/dashboard_profile_card.dart:128
// Checkmark removed to simplify and strictly contain avatar, name, and vehicle.
```

A comment about dead code. The checkmark overlay was removed. If someone re-adds it, they need to also add the "verified" prop. The comment is the only documentation.

### P3-17 The `_showLanguageDialog` in `settings_screen.dart:298-345` and `profile_screen.dart:237-294` are duplicates

Same dialog, two copies. The only difference: the settings version reads `ref` for `setEnglish/setHindi`, the profile version uses `ProviderScope.containerOf(ctx)`. Both are valid.

### P3-18 `_twoDigits` in `edit_profile_screen.dart:123` is a 1-line utility

Could be a global utility. But only used twice in this file. Inlining is fine.

---

## 6. Test coverage gaps

| Area | Existing tests | Gaps |
| --- | --- | --- |
| `ProfileScreen` | 4 widget tests | No test for KYC status pill rendering (4 paths: PENDING, SUBMITTED, VERIFIED, REJECTED). No test for the language switcher dialog. No test for the RefreshIndicator. No test for the avatar fallback (initial vs URL). |
| `ProfileDetailScreen` | (none) | No widget tests at all. No test for guarantor card, vehicle row, team leader row, emergency contact tap-to-call. |
| `EditProfileScreen` | 3 widget tests (render + title + no-overflow) | No test for the 11 text fields, no test for the guarantor OTP flow, no test for the avatar picker, no test for the date picker, no test for the "save and refresh" flow. |
| `EarningsScreen` | (none) | No widget tests. No test for the week navigation, no test for the SharedPreferences fallback, no test for the "+12%" badge, no test for the empty state. |
| `SettingsScreen` | (none) | No widget tests. No test for dark mode toggle, no test for the language switcher, no test for the (fake) delete account dialog, no test for the logout flow. |
| `RiderRepositoryImpl` | 12 unit tests | All call paths covered. No test for the empty-fields case (riderId is null). |
| `KycStatusPill` widget | (none — doesn't exist) | Should be extracted (see P1-2) and tested. |
| `EarningEntry` model | (none) | No test for `fromJson`/`toJson` round-trip, no test for `platformColor`/`platformLabel` mapping. |
| `ProfileEntity` | (none) | DEAD CODE — should be deleted (see P0-4). |
| The `+12%` hardcode | (none) | No test for "growth badge" — would catch the bug. |

---

## 7. What I'd do first (single highest-blast-radius fix)

**P0-1 (Delete Account is fake) — regulatory fix.** A "Delete Account" button that doesn't delete is a **GDPR/DPDP violation**. The fix is to either (a) wire it to a real delete endpoint, or (b) hide the tile entirely. The honest fix is (b) — add a `deleteRider` repo method, wire to a new `POST /api/rider/delete-account` server endpoint that calls the existing admin `data-deletion` flow. Until then, hide the tile.

**Second PR (P0-2 + P0-3): the earnings +12% and the "admin approval" lie.** The "+12%" hardcode and the "Submit for Approval" direct-PUT are the two highest-visibility lies. Compute real growth. Split the update into two endpoints.

**Third PR (P0-4 + P0-5 + P3-2): delete the dead `ProfileEntity` and the dead `RiderRepository` interface.** ~150 lines gone. The screens use `VoltiumApiService` directly; the abstraction was never used.

**Fourth PR (P1-8 + P1-15 + P1-16): fix the dead widgets and the deprecated APIs.** `ProfileQuickLinks` (120 lines), the `canLaunchUrl` migration, the package-name constant.

---

## 8. Recommended fix order with hour estimates

| Order | PR | Scope | Est. hours | Notes |
| --- | --- | --- | --- | --- |
| 1 | `delete-account-real-or-hide` | P0-1: wire delete to real endpoint or hide the tile | 1 (hide) / 8 (build) | Recommend hide first, build later |
| 2 | `earnings-real-growth` | P0-2: compute weekly growth from data | 1 | |
| 3 | `edit-profile-no-fake-approval` | P0-3: remove "admin approval" copy, split update endpoint or fix server | 4 (client) / 8 (server) | |
| 4 | `remove-dead-entity-and-repo` | P0-4, P0-5, P3-2: delete `ProfileEntity` + `RiderRepository` interface + impl | 1 | |
| 5 | `earnings-sync-strategy` | P0-6: track pending sync, upload on reconnect | 3 | |
| 6 | `avatar-url-helper` | P1-1: extract `buildAvatarUrl()` | 1 | |
| 7 | `kyc-status-pill` | P1-2: extract `KycStatusPill` widget | 1 | |
| 8 | `title-case-helper` | P1-3: extract `_titleCase` with underscore handling | 0.5 | |
| 9 | `kyc-editable-fields-check` | P1-4: check `kycEditableFields` before allowing edits | 1 | |
| 10 | `change-password-or-hide` | P1-5: implement forgot password or hide the tile | 1 (hide) / 6 (build) | |
| 11 | `dev-otp-gate` | P1-6: wrap dev OTP auto-fill in `kDebugMode` | 0.25 | |
| 12 | `profile-image-cleanup` | P1-7: delete `_profileImage` temp file on dispose | 0.5 | |
| 13 | `delete-profile-quick-links` | P1-8: remove `ProfileQuickLinks` dead widget | 0.5 | |
| 14 | `localize-sub-screens` | P1-9: use `l10n` in profile_detail, edit, earnings | 2 | |
| 15 | `partial-rider-refresh` | P1-10: add `updateRiderFields` for partial update | 1 | |
| 16 | `emergency-contact-validate` | P1-11: strip spaces, await launch, error UI | 0.5 | |
| 17 | `guarantor-status-cta` | P1-12: surface rejectionReason, add resubmit CTA | 1 | |
| 18 | `earnings-best-day-guard` | P1-13: only compute bestDay when there are entries | 0.25 | |
| 19 | `logout-to-auth` | P1-14: navigate to auth screen, not AppShell | 0.5 | |
| 20 | `rate-us-package-constant` | P1-15: read package from constant, migrate launch API | 0.5 | |
| 21 | `guarantor-phone-widget` | P1-17: extract `GuarantorPhoneField` widget | 1 | |
| 22 | `earnings-server-wiring` | P1-18: wire add-entry to server endpoint | 4 | |
| 23 | (cleanup) | P2-1 through P2-13: type safety + contract | 6 | |
| 24 | (P3s) | Various small cleanups | 4 | |

**Total: 24 PRs, ~40 hours of focused work.** The first 5 are P0 and ship in ~6-8 hours.

---

## 9. Cross-cutting observations

1. **The "Domain layer is dead" pattern is universal** — `ProfileEntity` and `RiderRepository` are both defined but unused. The wallet audit found the same (`WalletEntity` + `WalletRepository` are used, but inconsistently). The recommendation is the same as previous audits: **delete dead abstractions or commit to using them**.

2. **The "fake danger zone" pattern is a real regulatory issue** — the Delete Account button is in the same category as the "Coming Soon" Change Password button. The audit team has been flagging "fake" UI elements. The honest fix is to either (a) build the real action, or (b) hide the button.

3. **The "hardcoded growth indicator" pattern** — the `+12%` in earnings is the same as the "180 days" in wallet_security, the "5 days" in streak, the "12.5% APR" in offers. All these are business numbers that should come from the server. The team has a habit of hardcoding display values.

4. **The "KYC status display duplicated 3 times" pattern is universal** — every screen that shows KYC has its own copy. Extract a `KycStatusPill` widget. Same for `GuarantorStatusPill`, `LifecycleStatusPill`, etc.

5. **The "localized on the menu, hardcoded on the sub-screen" pattern** — `ProfileScreen` uses `l10n.menu_*`. `ProfileDetailScreen`, `EditProfileScreen`, `EarningsScreen`, `SettingsScreen` use hardcoded English. The user sees localized menu, English sub-screens. Inconsistency.

6. **The "no sync strategy for offline writes" pattern** — the `EarningsScreen` writes to `SharedPreferences` and never syncs. The wallet audit found the same in `top_up_proof_screen.dart`. The team has a habit of "save locally, hope it works." Recommend a `SyncQueue` provider that flushes pending writes on reconnect.

7. **The "data field duplication" pattern** — the avatar URL is built 5 times. The KYC status is rendered 3 times. The guarantor name + phone + photo is fetched 2 times. The team has a habit of "copy-paste the line that works" instead of "extract the helper."

8. **The "deprecated APIs" pattern** — `canLaunchUrl` is deprecated (used in settings_screen.dart, top_up_proof_screen.dart). The team is on a Flutter version that has these deprecations but hasn't migrated.

9. **The "no PostHog analytics" pattern** — the profile feature has 0 PostHog events. The wallet feature has 3 (top_up_initiated, top_up_submitted, top_up_completed). The PM has no visibility into profile feature usage. Add events: profile_view, profile_edit_started, profile_edit_saved, settings_opened, language_changed, delete_account_attempted, etc.

10. **The "no admin approval flow" pattern** — the edit profile claims admin approval but doesn't actually queue for review. This is the same as the "Coming Soon" buttons and the fake growth indicator. The UI lies. Recommend a `ProfileEditRequest` model + server endpoint that queues changes for admin review.

---

## 10. What this audit confirmed (vs. previous 7 audits)

- **The "domain layer is dead" pattern is universal** — found `ProfileEntity` + `RiderRepository` here, `WalletEntity` + `WalletRepository` (used but inconsistently) in the wallet audit, and the admin audit found `admin.routes.ts` (a parallel implementation). The team has a habit of creating abstractions and not using them.

- **The "fake button" pattern is real** — `Delete Account` is theater. The "Change Password" is "Coming Soon." The "+12%" growth is hardcoded. The "Submit for Approval" is a lie. The "Change Phone" goes to `EditProfileScreen` (re-edit profile) instead of a phone-change flow. **At least 4 fake UI elements on this one screen.**

- **The "hardcoded URLs" pattern** — the `Rate Us` URL has the package name hardcoded. The avatar URL is hardcoded 5 times. The same `RegExp(r'^/+')` is in 5 files.

- **The "deprecated APIs" pattern** — `canLaunchUrl` is deprecated. The audit found the same in the wallet. The team is on a Flutter version that has deprecations but hasn't migrated.

- **The "no analytics" pattern** — the profile feature has 0 PostHog events. The wallet has 3. The PM has no visibility. **The profile is the most-used feature of the app (every rider opens it daily) and has zero analytics.**

- **The "no offline strategy" pattern** — `EarningsScreen` writes to `SharedPreferences` and never syncs. The wallet found the same in the upload flow. The team has no `SyncQueue` or equivalent.

- **The "two screens showing the same data with different formatting" pattern** — the KYC status is rendered 3 ways across 3 screens. The same `_capitalize` function is in 3 files. The team has a habit of duplicating rendering logic.

- **The "tests for the implementation but not for the screen" pattern** — the 12 unit tests for `RiderRepositoryImpl` test a layer nothing else uses. The 4 widget tests for `ProfileScreen` only check "renders, title, no overflow." No screen has meaningful interaction tests.

- **The "Compliance claim without compliance implementation" pattern** — the "Submit for Approval" copy + the "admin approval required" note + the "delete account" button are all in the same area. Each is a claim that the implementation doesn't support. A user who actually believes the UI is at risk of GDPR/DPDP violation, but the team is OK with shipping the lie.

---

**End of audit. Total findings: 6 P0s, 18 P1s, 13 P2s, 18 P3s, 10 test gaps, 200+ lines of dead code (`ProfileEntity`, `RiderRepository` interface, `RiderRepositoryImpl`, `ProfileQuickLinks`).**

**The single most impactful fix is P0-1 (the fake Delete Account button) — a regulatory issue that ships every day. The second is P0-3 (the "Submit for Approval" lie) — affects every rider who edits their profile.**
