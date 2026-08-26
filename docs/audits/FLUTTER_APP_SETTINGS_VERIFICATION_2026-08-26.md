# Flutter App Settings Screen — Data Population Verification

**Date:** 2026-08-26
**Auditor:** Mavis
**Scope:** the App Settings screen (`SettingsScreen` in `profile/presentation/screens/`) and its 5 sub-screens / sub-flows:
- `NotificationPreferencesScreen` (master + 6 category toggles)
- `language_toggle.dart` (in-dialog) + `localeProvider`
- `LegalPageScreen` (terms, privacy, refund, guarantor, rentalSafety)
- `EditProfileScreen` (already audited under profile-feature)
- `FeedbackScreen` (already audited under support-feature)
- `AppInfo` source (app version, build number)

**Method:** read each screen in full, trace the data flow from `riderProvider` / `SharedPreferences` / `LegalFallbackLoader` into the rendered widgets, and audit the write-back path (save / persistence / server sync).

## TL;DR

**The App Settings screen and all its sub-screens are populated correctly with real data.** No stale state, no wrong-list, no missing-fields. All audit fixes from prior sessions (2026-08-22 deep audit) are in place and reflected in the current code: lock-password step-up for account deletion, language-dialog consolidation (PR-VER-2026-08-07), notification OS-permission sync, AppInfo version source, and legal-document fallback loader.

| Surface | Data source | Status |
|---|---|---|
| `SettingsScreen` (parent) | `riderProvider.rider` (identity card) + 11 menu links | ✅ |
| `SettingsScreen` → Theme dialog (3-state) | `themeProvider.themeMode` (Provider) | ✅ |
| `SettingsScreen` → Language dialog | `localeProvider` (Provider) | ✅ |
| `SettingsScreen` → Notification preferences | SharedPreferences (7 booleans) + OS permission | ✅ |
| `SettingsScreen` → Edit Profile | `riderProvider.rider` | ✅ |
| `SettingsScreen` → Change Lock Password | `_showChangeLockPasswordDialog()` (post-verify) | ✅ |
| `SettingsScreen` → Feedback | `FeedbackScreen(onSubmit: ...)` | ✅ |
| `SettingsScreen` → Terms / Privacy | `LegalPageScreen(documentType: ...)` | ✅ |
| `SettingsScreen` → App version | `AppInfo.version` (from `package_info_plus`) | ✅ (was `v2.1.0` hardcoded; fixed in 2026-08-22 deep audit) |
| `SettingsScreen` → Rate us | `launchUrl(play.google.com/...)` | ✅ (silent-failure→`appDebug`; was `catch (_) {}`) |
| `SettingsScreen` → Delete Account | `_showDeleteAccountDialog` → `_submitAccountDeletionRequest` | ✅ (typed phrase `delete` + lock-password step-up) |
| `SettingsScreen` → Sign out | `ProfileLogoutButton` (T-112) | ✅ (`logout()` awaited; `popUntil`) |
| `NotificationPreferencesScreen` | 7 booleans in SharedPreferences | ✅ |
| `language_toggle.dart` (in-dialog) | `localeProvider` | ✅ (PR-8 consolidation) |
| `LegalPageScreen` | `LegalFallbackLoader` → `assets/json/legal_fallback.json` (PART-of-`legal_page_content.dart`) | ✅ (override map; `part` file as last-resort) |
| `FeedbackScreen` | already audited under support-feature (no mock data) | ✅ |

## Findings

### Finding F-1 (data flow, clean) — App version source is `AppInfo.version`, not hardcoded

**File:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart:281`

```dart
trailing: Text(
  // AUDIT FIX (2026-08-22): was a hardcoded 'v2.1.0' that
  // drifted from pubspec (1.0.0+1). Read from AppInfo.
  'v${AppInfo.version}',
  ...
)
```

**Status:** ✅ Reads from `package_info_plus` at runtime. The hardcoded `'v2.1.0'` is gone. The display always matches `pubspec.yaml`'s `version:` field.

### Finding F-2 (data flow, clean) — Notification preferences correctly sync with OS

**File:** `flutter/lib/features/notifications/presentation/screens/notification_preferences_screen.dart:46-67`

```dart
Future<void> _loadPreferences() async {
  try {
    final prefs = await SharedPreferences.getInstance();
    final storedPush = prefs.getBool(_keyPush) ?? true;
    // AUDIT FIX: reflect the REAL OS notification permission in the
    // master switch — a stored "on" with a revoked OS permission is
    // effectively off.
    final osGranted = await NotificationService().areNotificationsEnabled();
    ...
    setState(() {
      _pushEnabled = storedPush && osGranted;
      ...
    });
  } catch (e) {
    appDebug('Failed to load notification preferences: $e');
  }
}
```

**Status:** ✅ The master switch correctly ANDs the stored preference with the current OS permission state. If a user disables notifications in iOS Settings, the toggle snaps to off even if the local preference is on. The 4 category toggles (Payments, KYC, Maintenance, Announcements) are persisted to SharedPreferences only — server-side topic opt-out is future work (the AUDIT comment at line 187 explicitly notes this).

### Finding F-3 (data flow, clean) — Legal page uses fallback loader

**File:** `flutter/lib/features/onboarding/presentation/screens/legal_page_screen.dart:101-110`

```dart
late final Map<String, String> _override = {};

@override
void initState() {
  super.initState();
  // PR-29 (LEGAL P0): the inlined `$_k*` strings in
  // `legal_page_content.dart` are kept as a `part` file because they
  // need string interpolation (`$_kBrandShort`, `$_kBrandFull`).
  // But the *primary* source of truth for the document body is now
  // `assets/json/legal_fallback.json` (loaded by [LegalFallbackLoader]).
  // This map is populated in `initState` and used to override the
  // inlined content for any section that the JSON contains — the
  // `part` copy becomes a last-resort fallback when the asset is
```

**Status:** ✅ The legal documents load from `assets/json/legal_fallback.json` via `LegalFallbackLoader`. The inlined `part` file is the last-resort fallback. AppConfig's `supportEmail` / `supportPhone` (from the consolidated-fix) is the canonical source for the support contact.

### Finding F-4 (data flow, clean) — Delete Account has 2-factor verification

**File:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart:388-414`

```dart
void _showDeleteAccountDialog(BuildContext context) {
  showDestructivePhraseDialog(
    context: context,
    title: ...,
    message: ...,
    phrase: 'delete',  // ← user must TYPE this word
    confirmText: ...,
  ).then((confirmed) {
    if (!confirmed) return;
    if (!context.mounted) return;
    // After typed-phrase confirmation, chain lock-password step-up
    // (defense in depth).
    _showVerifyLockPasswordDialog(
      context,
      onVerified: () => _submitAccountDeletionRequest(context, l10n),
    );
  });
}
```

**Status:** ✅ Two independent safety mechanisms: (1) typed phrase `delete` confirms intent; (2) lock-password step-up confirms identity. Both must succeed before the request is sent. The previous audit-finding fix (F-007) is in place.

### Finding F-5 (UX, low priority) — Logout button uses `popUntil` not `pushAndRemoveUntil`

**File:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart:329-340`

```dart
FadeUpWidget(
  delay: 325,
  child: ProfileLogoutButton(
    onTap: () async {
      final confirmed = await showLogoutConfirmation(context);
      if (confirmed == true && context.mounted) {
        await ref.read(riderProvider.notifier).logout();
        if (context.mounted) {
          Navigator.of(context).popUntil((route) => route.isFirst);
        }
      }
    },
  ),
)
```

**Status:** ⚠️ Fine, but the **route order is**: `await logout()` first, then `popUntil`. The `popUntil` runs synchronously while the FCM token unregister + cache clear from `logout()` are racing. The audit comment at line 334 says "logout() is async — await it so popUntil can't race the session teardown / cache wipe" which is correctly handled by the `await`. **Acceptable.**

### Finding F-6 (data flow, clean) — Theme dialog state is 3-state (System / Light / Dark)

**File:** `flutter/lib/features/profile/presentation/screens/settings_screen.dart:456-525`

```dart
showDialog(
  context: context,
  builder: (ctx) => AlertDialog(
    title: Text(l10n?.settings_appearance ?? 'Appearance'),
    content: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        ListTile(title: ..., leading: Radio<ThemeMode>(value: ThemeMode.system, ...)),
        ListTile(title: ..., leading: Radio<ThemeMode>(value: ThemeMode.light, ...)),
        ListTile(title: ..., leading: Radio<ThemeMode>(value: ThemeMode.dark, ...)),
      ],
    ),
  ),
);
```

**Status:** ✅ Reads from `themeProvider.themeMode` (Riverpod state). Writes via `setThemeMode(...)`. The 3 states match the theme_provider's enum. The trailing chip in the Settings list shows the human-readable label via `_themeModeLabel` (System → "Follow system", Light → "Light mode", Dark → "Dark mode").

### Finding F-7 (data flow, clean) — Sign Out is a separate component with full async handling

**File:** `flutter/lib/features/profile/presentation/widgets/profile_widgets.dart` (referenced in settings_screen)

**Status:** ✅ `ProfileLogoutButton` is a separate widget, fully async with proper `mounted` checks. Covered in the profile-feature audit.

## Out of scope

- `EditProfileScreen` — covered in `FLUTTER_PROFILE_SCREENS_AUDIT_2026-08-05.md` (the profile-feature audit) and the prior deep-audit PR (`0e25d4d6`).
- `FeedbackScreen` — covered in `FLUTTER_SUPPORT_SCREENS_AUDIT_2026-08-05.md`.
- The 5 sections inside `legal_page_content.dart` (the `part` file) — the JSON fallback overrides these. The JSON is the source of truth; the `part` file is the last-resort fallback when the asset is missing.

## Conclusion

**All 4 main Settings sub-screens and the 5 settings sub-flows (theme dialog, language dialog, notification preferences, legal pages, app info) are populated correctly with real data.** No stale state, no wrong-list, no missing-fields. The prior 2026-08-22 deep-audit fixes (F-007 delete-account 2FA, F-063 lock-password step-up, F-059 typed-phrase confirmation) are all in place.

The single actionable item (F-5) is **cosmetic and acceptable** as-is; no real risk.

## File

| File | Size |
|---|---|
| `D:/voltium/docs/audits/FLUTTER_APP_SETTINGS_VERIFICATION_2026-08-26.md` | this file |
