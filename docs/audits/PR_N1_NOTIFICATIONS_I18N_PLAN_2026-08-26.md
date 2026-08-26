# PR-N1 — Notifications i18n wiring (Flutter)

**Branch off:** `fix/phase6d-api-hardening`
**Target:** 6 cosmetic findings from `NOTIFICATION_DATA_POPULATION_2026-08-26.md` (F-3, F-4, F-5, F-6, F-7, F-8)
**Effort estimate:** 2-3 hours (mechanical wiring, no structural change)
**PR-N2 starts after this merges.**

---

## 0. The headline

Most of the ARB work for PR-N1 is **already done** — a prior agent added 9 of the 15 needed keys to both `app_en.arb` and `app_hi.arb`, ran `flutter gen-l10n`, and stopped. The screen at `flutter/lib/features/notifications/presentation/screens/notifications_screen.dart` still uses hardcoded English literals at the same lines the keys were meant to fix. PR-N1 is a **wiring PR** with 8 new ARB keys + 2 file edits.

| Finding | ARB keys exist? | Wiring exists? | What PR-N1 does |
|---|---|---|---|
| F-3 Tab labels (All/Payments/KYC/Maintenance/Announcements) | ✅ both en + hi | ❌ | Wire 5 `txtnotifTab*` lookups |
| F-4 Delete dialog title + body | ✅ both en + hi | ❌ | Wire `txtdeleteNotification` + `txtareYouSureYouWantToDeleteThisNotification` |
| F-5 Empty state copy | ❌ missing | ❌ | Add 2 keys + 2 lookups |
| F-6 Header tooltips (Back / Clear read / Mark all read / Notification settings) | ❌ missing | ❌ | Add 4 keys + 4 lookups |
| F-7 Time format ("5m ago" / "3h ago" / "2d ago" / "23/8") | ❌ missing | ❌ | Add 2 keys + use `intl.DateFormat` |
| F-8 "Notification permission was not granted" toast | ❌ missing | ❌ | Add 1 key + 1 lookup |

---

## 1. Already-existing keys (just wire them)

These 7 keys are already in `app_en.arb`, `app_hi.arb`, and the generated `app_localizations*.dart`. No ARB work needed.

| Key | English | Hindi | Where it lives today |
|---|---|---|---|
| `txtnotifTabAll` | "All" | "सभी" | `notifications_screen.dart:128` |
| `txtnotifTabPayments` | "Payments" | "भुगतान" | `notifications_screen.dart:130` |
| `txtnotifTabKyc` | "KYC" | "केवाईसी" | `notifications_screen.dart:132` |
| `txtnotifTabMaintenance` | "Maintenance" | "रखरखाव" | `notifications_screen.dart:134` |
| `txtnotifTabAnnouncements` | "Announcements" | "घोषणाएँ" | `notifications_screen.dart:136` |
| `txtdeleteNotification` | "Delete Notification" | "सूचना हटाएं" | `notifications_screen.dart:248` (title) |
| `txtareYouSureYouWantToDeleteThisNotification` | "Are you sure you want to delete this notification?" | (hi exists) | `notifications_screen.dart:250` (body) |

The Hindi text for the confirm dialog body is currently in the same ARB file under its key. Verify by reading `app_hi.arb:937` (same line). The Hindi translation is acceptable as-is.

---

## 2. New ARB keys to add (8 total)

Per the LANGUAGE-AUDIT (2026-08-16) #5 rule: **BOTH** `app_en.arb` AND `app_hi.arb` must carry proper translations. If the Hindi is uncertain, mark `// hi-review:` for the human translator — do NOT ship a key with only the English value.

### 2.1 Empty state (F-5)

Add to `app_en.arb` (insert near the existing `txtnotif*` block at line 2003):

```json
"txtnotifEmptyAllTitle": "No notifications yet",
"@txtnotifEmptyAllTitle": { "description": "Notifications screen empty state title for the 'All' tab" },
"txtnotifEmptyAllBody": "You're all caught up!",
"@txtnotifEmptyAllBody": { "description": "Notifications screen empty state body for the 'All' tab" },
"txtnotifEmptyPaymentsTitle": "No payment notifications",
"@txtnotifEmptyPaymentsTitle": { "description": "Notifications screen empty state title for the 'Payments' tab" },
"txtnotifEmptyKycTitle": "No KYC notifications",
"@txtnotifEmptyKycTitle": { "description": "Notifications screen empty state title for the 'KYC' tab" },
"txtnotifEmptyMaintenanceTitle": "No maintenance notifications",
"@txtnotifEmptyMaintenanceTitle": { "description": "Notifications screen empty state title for the 'Maintenance' tab" },
"txtnotifEmptyAnnouncementsTitle": "No announcements",
"@txtnotifEmptyAnnouncementsTitle": { "description": "Notifications screen empty state title for the 'Announcements' tab" },
```

Add to `app_hi.arb` (mirroring the English block):

```json
"txtnotifEmptyAllTitle": "अभी कोई सूचना नहीं",
"@txtnotifEmptyAllTitle": { "description": "Notifications screen empty state title for the 'All' tab" },
"txtnotifEmptyAllBody": "आप पूरी तरह अप-टू-डेट हैं!",
"@txtnotifEmptyAllBody": { "description": "Notifications screen empty state body for the 'All' tab" },
"txtnotifEmptyPaymentsTitle": "कोई भुगतान सूचना नहीं",
"@txtnotifEmptyPaymentsTitle": { "description": "Notifications screen empty state title for the 'Payments' tab" },
"txtnotifEmptyKycTitle": "कोई केवाईसी सूचना नहीं",
"@txtnotifEmptyKycTitle": { "description": "Notifications screen empty state title for the 'KYC' tab" },
"txtnotifEmptyMaintenanceTitle": "कोई रखरखाव सूचना नहीं",
"@txtnotifEmptyMaintenanceTitle": { "description": "Notifications screen empty state title for the 'Maintenance' tab" },
"txtnotifEmptyAnnouncementsTitle": "कोई घोषणा नहीं",
"@txtnotifEmptyAnnouncementsTitle": { "description": "Notifications screen empty state title for the 'Announcements' tab" },
```

### 2.2 Tooltips (F-6)

Add to both ARB files. These are accessibility labels — TalkBack/VoiceOver read them in the current locale.

```json
"txtnotifTooltipBack": "Back",
"@txtnotifTooltipBack": { "description": "Tooltip on the notifications screen back arrow" },
"txtnotifTooltipClearRead": "Clear read",
"@txtnotifTooltipClearRead": { "description": "Tooltip on the bulk-clear-read icon button" },
"txtnotifTooltipMarkAllRead": "Mark all read",
"@txtnotifTooltipMarkAllRead": { "description": "Tooltip on the mark-all-read icon button" },
"txtnotifTooltipOpenSettings": "Notification settings",
"@txtnotifTooltipOpenSettings": { "description": "Tooltip on the icon button that opens Notification Preferences" },
```

Hindi:
```json
"txtnotifTooltipBack": "वापस",
"@txtnotifTooltipBack": { "description": "Tooltip on the notifications screen back arrow" },
"txtnotifTooltipClearRead": "पढ़ी गई सूचनाएँ हटाएँ",
"@txtnotifTooltipClearRead": { "description": "Tooltip on the bulk-clear-read icon button" },
"txtnotifTooltipMarkAllRead": "सभी को पढ़ा हुआ चिह्नित करें",
"@txtnotifTooltipMarkAllRead": { "description": "Tooltip on the mark-all-read icon button" },
"txtnotifTooltipOpenSettings": "सूचना सेटिंग्स",
"@txtnotifTooltipOpenSettings": { "description": "Tooltip on the icon button that opens Notification Preferences" },
```

### 2.3 Time format (F-7)

The existing time formatter (`notifications_screen.dart:749-758`) is hardcoded English. Two pieces need localization:

```json
"txtnotifTimeMinutesAgo": "{count}m ago",
"@txtnotifTimeMinutesAgo": {
  "description": "Relative time under one hour",
  "placeholders": { "count": { "type": "int", "example": "5" } }
},
"txtnotifTimeHoursAgo": "{count}h ago",
"@txtnotifTimeHoursAgo": {
  "description": "Relative time under one day",
  "placeholders": { "count": { "type": "int", "example": "3" } }
},
"txtnotifTimeDaysAgo": "{count}d ago",
"@txtnotifTimeDaysAgo": {
  "description": "Relative time under one week",
  "placeholders": { "count": { "type": "int", "example": "2" } }
},
"txtnotifTimeLongAgo": "{day}/{month}",
"@txtnotifTimeLongAgo": {
  "description": "Absolute time when older than a week. Uses {day} and {month} as zero-padded two-digit numbers.",
  "placeholders": {
    "day": { "type": "int", "example": "23" },
    "month": { "type": "int", "example": "8" }
  }
},
```

Hindi:
```json
"txtnotifTimeMinutesAgo": "{count} मिनट पहले",
"@txtnotifTimeMinutesAgo": {
  "description": "Relative time under one hour",
  "placeholders": { "count": { "type": "int", "example": "5" } }
},
"txtnotifTimeHoursAgo": "{count} घंटे पहले",
"@txtnotifTimeHoursAgo": {
  "description": "Relative time under one day",
  "placeholders": { "count": { "type": "int", "example": "3" } }
},
"txtnotifTimeDaysAgo": "{count} दिन पहले",
"@txtnotifTimeDaysAgo": {
  "description": "Relative time under one week",
  "placeholders": { "count": { "type": "int", "example": "2" } }
},
"txtnotifTimeLongAgo": "{day}/{month}",
"@txtnotifTimeLongAgo": {
  "description": "Absolute time when older than a week. Uses {day} and {month} as zero-padded two-digit numbers.",
  "placeholders": {
    "day": { "type": "int", "example": "23" },
    "month": { "type": "int", "example": "8" }
  }
},
```

Note: the absolute date format stays as `dd/MM` for both locales in this PR (preserves the existing convention). A future PR can switch to `intl.DateFormat` with locale-aware short-form dates (e.g. "23 Aug" / "23 अगस्त") — out of scope for PR-N1 to keep it shippable.

### 2.4 Permission toast (F-8)

```json
"txtnotifPermissionDenied": "Notification permission was not granted",
"@txtnotifPermissionDenied": { "description": "Toast shown when the user toggles push notifications on but the OS denies the permission request" },
```

Hindi:
```json
"txtnotifPermissionDenied": "सूचना अनुमति नहीं दी गई",
"@txtnotifPermissionDenied": { "description": "Toast shown when the user toggles push notifications on but the OS denies the permission request" },
```

---

## 3. Code changes

### 3.1 `flutter/lib/features/notifications/presentation/screens/notifications_screen.dart`

Six localized sites. Edit in this order to keep the diff readable.

#### Edit A — `initState` PostHog capture (line 36)

No change. The `notification_opened` event is a stable analytics key, not user-facing.

#### Edit B — Tab labels (lines 125-138)

Replace the literal-returning function body:

```dart
String _getTabLabel(NotificationTab tab, AppLocalizations l) {
  switch (tab) {
    case NotificationTab.all:
      return l.txtnotifTabAll;
    case NotificationTab.payments:
      return l.txtnotifTabPayments;
    case NotificationTab.kyc:
      return l.txtnotifTabKyc;
    case NotificationTab.maintenance:
      return l.txtnotifTabMaintenance;
    case NotificationTab.announcements:
      return l.txtnotifTabAnnouncements;
  }
}
```

Then update both call sites:
- Line 513: `Text(_getTabLabel(tab, l), ...)` (inside the tab strip)
- Line 558: `'No ${_getTabLabel(_selectedTab, l).toLowerCase()} notifications'` — **this is the F-5 change site, see Edit D**

You can pull the `AppLocalizations` from the `BuildContext` via `AppLocalizations.of(context)!.` at the call sites, or thread it through the helper. Threading is cleaner; both are fine.

#### Edit C — Tab icon helper is fine (lines 110-123)

Icons are universal, no localization needed.

#### Edit D — Empty state (lines 532-570)

Replace the hardcoded strings with the new keys:

```dart
Widget _buildEmptyState() {
  final colors = AppColors.of(context);
  final l = AppLocalizations.of(context)!;
  final title = _emptyStateTitle(l);
  return Center(
    child: Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        // … (the icon container at lines 538-555 is fine, keep it)
        const SizedBox(height: 24),
        Text(title, style: AppTypography.titleMedium.copyWith(color: colors.onSurface)),
        const SizedBox(height: 8),
        Text(l.txtnotifEmptyAllBody,
            style: GoogleFonts.plusJakartaSans(fontSize: 14, color: colors.onSurfaceVariant)),
      ],
    ),
  );
}

String _emptyStateTitle(AppLocalizations l) {
  switch (_selectedTab) {
    case NotificationTab.all:
      return l.txtnotifEmptyAllTitle;
    case NotificationTab.payments:
      return l.txtnotifEmptyPaymentsTitle;
    case NotificationTab.kyc:
      return l.txtnotifEmptyKycTitle;
    case NotificationTab.maintenance:
      return l.txtnotifEmptyMaintenanceTitle;
    case NotificationTab.announcements:
      return l.txtnotifEmptyAnnouncementsTitle;
  }
}
```

Note: only `All` has a body string ("You're all caught up!"). The other 4 tabs just show the title. If you want a body on all 5, add 4 more `txtnotifEmpty*Body` keys. Recommendation: **don't** — the body adds little value for a category-specific empty state and bloats the ARB file.

#### Edit E — Delete dialog title + body (lines 247-251)

Replace the literals:

```dart
title: Text(AppLocalizations.of(context)!.txtdeleteNotification),
content: Text(
  AppLocalizations.of(context)!.txtareYouSureYouWantToDeleteThisNotification,
),
```

Drop the now-obsolete LANGUAGE-AUDIT comment at lines 258-262 (it described a half-fix that's now whole).

#### Edit F — Time formatter (lines 749-758)

Replace `_formatTime` with a localized version. Use the new ARB keys for relative time; for the absolute date, keep the same `dd/MM` format but localize the ARB string:

```dart
String _formatTime(DateTime dt) {
  final l = AppLocalizations.of(context)!;
  var diff = DateTime.now().difference(dt);
  if (diff.isNegative) diff = Duration.zero;
  if (diff.inMinutes < 60) return l.txtnotifTimeMinutesAgo(diff.inMinutes);
  if (diff.inHours < 24) return l.txtnotifTimeHoursAgo(diff.inHours);
  if (diff.inDays < 7) return l.txtnotifTimeDaysAgo(diff.inDays);
  return l.txtnotifTimeLongAgo(dt.day, dt.month);
}
```

The `intl` package is already a dependency (used by `AppLocalizations.of(context).localeName`). No new pubspec entry needed.

#### Edit G — Header tooltips (lines 401, 435, 445, 454)

Four sites, one key per site:

| Line | Literal | New lookup |
|---|---|---|
| 401 | `tooltip: 'Back'` | `tooltip: AppLocalizations.of(context)!.txtnotifTooltipBack` |
| 435 | `tooltip: 'Clear read'` | `tooltip: AppLocalizations.of(context)!.txtnotifTooltipClearRead` |
| 445 | `tooltip: 'Mark all read'` | `tooltip: AppLocalizations.of(context)!.txtnotifTooltipMarkAllRead` |
| 454 | `tooltip: 'Notification settings'` | `tooltip: AppLocalizations.of(context)!.txtnotifTooltipOpenSettings` |

The `_headerIconButton` helper (lines 352-384) takes `tooltip: String` already — no signature change needed.

### 3.2 `flutter/lib/features/notifications/presentation/screens/notification_preferences_screen.dart`

#### Edit H — Permission-denied toast (line 78)

```dart
Toast.error(
  context,
  AppLocalizations.of(context)?.txtnotifPermissionDenied ??
      'Notification permission was not granted',
);
```

Drop the literal fallback if you trust the lookup to never return null (`AppLocalizations.of(context)!` works in screens that always have a `Localizations` ancestor — this screen does, so the fallback is dead).

### 3.3 `flutter/pubspec.yaml` (verification, no edit)

Verify `intl: ^0.19.0` (or current pinned version) is present — it should be, since `flutter_localizations` depends on it transitively. If a future PR swaps to `intl.DateFormat` for the absolute date, that pubspec entry is already in place.

### 3.4 `flutter/lib/gen/app_localizations*.dart` (regenerated, do not hand-edit)

After adding the 8 new ARB keys, run `flutter gen-l10n` to regenerate. The generated file is in `.gitignore` in most Flutter projects — verify before committing:

```powershell
Get-Content D:\voltium\flutter\.gitignore | Select-String -Pattern 'gen/'
```

If `lib/gen/` is gitignored, no commit needed for the generated file. If it is tracked, commit the regenerated file.

---

## 4. Files touched (summary)

| File | Action | Lines changed |
|---|---|---|
| `flutter/lib/l10n/app_en.arb` | edit (add 13 keys + 13 `@` metadata) | +~50 |
| `flutter/lib/l10n/app_hi.arb` | edit (add 13 keys + 13 `@` metadata) | +~50 |
| `flutter/lib/features/notifications/presentation/screens/notifications_screen.dart` | edit (7 sites) | +~30, -~25 |
| `flutter/lib/features/notifications/presentation/screens/notification_preferences_screen.dart` | edit (1 site) | +2, -1 |
| `flutter/lib/gen/app_localizations*.dart` | regenerated (commit only if tracked) | +~80 |

Net diff estimate: **+~210 lines, -~25 lines across 4-5 files.**

---

## 5. Step-by-step execution order

Each step is independently committable. Commit after each step for easy review.

1. **Step 1 — ARB additions only** (15 min)
   - Add 13 new keys to `app_en.arb` (sections 2.1, 2.2, 2.3, 2.4)
   - Add 13 matching keys to `app_hi.arb` (Hindi translations)
   - Run `flutter gen-l10n` to regenerate `app_localizations*.dart`
   - Commit: `i18n(notifications): add 13 ARB keys for F-5/F-6/F-7/F-8 wiring`
   - **Verify:** `flutter analyze` shows 0 new issues. Generated files compile.

2. **Step 2 — Tab labels + delete dialog wiring** (15 min)
   - Edit `notifications_screen.dart` for F-3 (lines 125-138 + call sites at 513, 558)
   - Edit `notifications_screen.dart` for F-4 (lines 247-251)
   - Drop the obsolete LANGUAGE-AUDIT comment at 258-262
   - Commit: `i18n(notifications): wire tab labels and delete dialog to ARB`
   - **Verify on device:** open Notifications → tabs read in current locale. Hindi shows "सभी / भुगतान / केवाईसी / रखरखाव / घोषणाएँ". Swipe a notification → dialog title is "सूचना हटाएं" in Hindi, body matches.

3. **Step 3 — Empty state wiring** (15 min)
   - Add `_emptyStateTitle` helper
   - Wire `_buildEmptyState` to use it
   - Commit: `i18n(notifications): wire empty state to ARB`
   - **Verify on device:** in test mode (or with no notifications), each tab shows its empty state title in the current locale.

4. **Step 4 — Tooltips wiring** (10 min)
   - Wire 4 tooltip sites in `_headerIconButton` calls
   - Commit: `i18n(notifications): wire header tooltips to ARB`
   - **Verify on device:** long-press each header icon → screen reader reads the tooltip in the current locale.

5. **Step 5 — Time format wiring** (15 min)
   - Replace `_formatTime` with localized version
   - Commit: `i18n(notifications): wire time format to ARB`
   - **Verify on device:** a notification from 5 minutes ago shows "5 मिनट पहले" in Hindi. A 3-day-old notification shows "3 दिन पहले". A 2-week-old notification shows "23/8".

6. **Step 6 — Permission toast wiring** (5 min)
   - Edit `notification_preferences_screen.dart` line 78
   - Commit: `i18n(notifications): wire permission-denied toast to ARB`
   - **Verify on device:** go to Settings → Apps → Voltium Rider → Notifications → toggle OFF, then back in the app → Settings → Notifications → toggle master switch ON → OS denies → toast reads "सूचना अनुमति नहीं दी गई" in Hindi.

7. **Step 7 — Verification + PR** (30 min)
   - `flutter analyze` clean
   - `flutter test` passes
   - Run the existing notifications e2e test (`flutter/integration_test/e2e_individual/09_notifications_test.dart`) — should still pass
   - Push branch + open PR
   - PR title: `i18n(notifications): wire 13 ARB keys for tab labels, dialog, empty state, tooltips, time, permission toast (PR-N1)`
   - PR body: link to `NOTIFICATION_DATA_POPULATION_2026-08-26.md` and this plan

**Total: ~1.5 hours of edits + 30 min of verification = 2 hours of focused work.**

---

## 6. Tests to add

PR-N1 should add at least 3 widget tests to lock the new behavior in.

### 6.1 `flutter/test/features/notifications/notifications_screen_i18n_test.dart`

```dart
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/notification_model.dart';

Widget _harness(Locale locale, List<AppNotification> notifications) {
  return ProviderScope(
    overrides: [
      engagementProvider.overrideWith(() => _StubEngagementProvider(notifications)),
    ],
    child: MaterialApp(
      locale: locale,
      supportedLocales: const [Locale('en'), Locale('hi')],
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: const NotificationsScreen(),
    ),
  );
}

void main() {
  testWidgets('Tab labels are English when locale is en', (tester) async {
    await tester.pumpWidget(_harness(const Locale('en'), []));
    expect(find.text('All'), findsOneWidget);
    expect(find.text('Payments'), findsOneWidget);
    expect(find.text('KYC'), findsOneWidget);
    expect(find.text('Maintenance'), findsOneWidget);
    expect(find.text('Announcements'), findsOneWidget);
  });

  testWidgets('Tab labels are Hindi when locale is hi', (tester) async {
    await tester.pumpWidget(_harness(const Locale('hi'), []));
    expect(find.text('सभी'), findsOneWidget);
    expect(find.text('भुगतान'), findsOneWidget);
    expect(find.text('केवाईसी'), findsOneWidget);
    expect(find.text('रखरखाव'), findsOneWidget);
    expect(find.text('घोषणाएँ'), findsOneWidget);
  });

  testWidgets('Empty state title is localized', (tester) async {
    await tester.pumpWidget(_harness(const Locale('hi'), []));
    // tab=All by default
    expect(find.text('अभी कोई सूचना नहीं'), findsOneWidget);
  });

  testWidgets('Delete dialog title is localized', (tester) async {
    final notif = AppNotification(
      id: 'x', title: 't', message: 'm', type: AppNotificationType.system, createdAt: DateTime.now(),
    );
    await tester.pumpWidget(_harness(const Locale('hi'), [notif]));
    // swipe to dismiss
    await tester.drag(find.byKey(Key('notif_x')), const Offset(-500, 0));
    await tester.pumpAndSettle();
    expect(find.text('सूचना हटाएं'), findsOneWidget);
    expect(find.textContaining('क्या आप वाकई'), findsOneWidget);
  });
}
```

The `_StubEngagementProvider` mirrors the real one but with no I/O — pattern is already used in `flutter/test/providers/engagement_provider_test.dart`.

### 6.2 `flutter/test/features/notifications/time_format_i18n_test.dart`

```dart
test('relative time under 1 hour uses localized string', () {
  expect(localizedTimeAgo(now.subtract(Duration(minutes: 5)), 'en'), '5m ago');
  expect(localizedTimeAgo(now.subtract(Duration(minutes: 5)), 'hi'), '5 मिनट पहले');
});
test('relative time 1h-24h uses localized string', () { ... });
test('relative time 1d-7d uses localized string', () { ... });
test('absolute time uses dd/MM for both locales (preserved convention)', () { ... });
test('clock skew produces 0m ago, not negative', () { ... });
```

The clock-skew test is the existing audit fix at line 753 (`if (diff.isNegative) diff = Duration.zero`) — keep it.

### 6.3 E2E re-run

Run `flutter/integration_test/e2e_individual/09_notifications_test.dart` — should still pass with the new labels. The test uses `findsAtLeastNWidgets(1)` style assertions, so it should be label-agnostic. If it breaks, the test was over-asserting on English literals — fix the test, not the screen.

---

## 7. Acceptance criteria (reviewer focus)

A reviewer should be able to verify PR-N1 in 5 minutes on a Hindi device:

1. **Visual check (Hindi locale)**
   - Open Notifications → 5 tab labels read "सभी / भुगतान / केवाईसी / रखरखाव / घोषणाएँ"
   - Switch to a tab with no notifications → empty state reads "अभी कोई सूचना नहीं" + "आप पूरी तरह अप-टू-डेट हैं!"
   - Long-press the back arrow → screen reader reads "वापस"
   - Swipe a notification → dialog title "सूचना हटाएं" + body in Hindi
   - A 5-minute-old notification shows "5 मिनट पहले"

2. **Visual check (English locale)**
   - Same flow, English strings. No regressions.

3. **Static checks**
   - `flutter analyze` → 0 new issues
   - `flutter test` → all existing tests pass + 3 new i18n tests pass
   - `flutter gen-l10n` produces no diff against the committed generated file (clean tree)

4. **No functional regression**
   - Pull-to-refresh still works
   - Mark-as-read still works
   - Delete still hits the server
   - Mark-all-read still works with in-flight guard
   - Clear-read still works with rollback
   - Dashboard bell badge still shows the right count
   - Logout still wipes notification state

5. **No data-layer changes**
   - PR-N1 does NOT touch `engagement_provider.dart`
   - PR-N1 does NOT touch `notification_model.dart`
   - PR-N1 does NOT touch the backend route
   - PR-N1 does NOT delete any dead code (the dead `notification_provider.dart` and `notification_cards.dart` are PR-N4 cleanup, not PR-N1)

---

## 8. Out of scope (deferred to other PRs)

- **F-1 + F-2 (structured `category` field)** — PR-N2. Adds a server schema change + client filter rewrite. Cannot ship in PR-N1 (would require coordinating the server deploy with the client release).
- **F-dead (remove dead `notification_provider.dart` + `notification_cards.dart`)** — PR-N4 cleanup. Independent of the i18n work.
- **Absolute date `dd MMM` ("23 Aug") locale-aware format** — Future PR. PR-N1 keeps the existing `dd/MM` convention to keep the diff small and reviewable.
- **Localizing tooltips in other screens (permissions_screen.dart, history_screen.dart, earnings_screen.dart)** — Out of scope. PR-N1 only touches the notifications feature. A future cross-cutting `i18n-tooltips` PR can handle the rest, ideally with a small `LocalizedTooltip` wrapper widget to make it mechanical.
- **The `_getCategoryInfo` keyword-matching** (English-only icon/label fallback) — Out of scope. Fixed structurally in PR-N2 (alongside F-1/F-2). Touching it here would create a half-fix that PR-N2 would need to undo.

---

## 9. Risk + rollback

**Risk:** very low. The change is string-table driven and the screen behavior is unchanged. Worst case: a typo in a Hindi key shows an English literal in Hindi mode (already the current behavior).

**Rollback:** revert the PR. No data migration, no API change, no cache invalidation. The `volt_notifications` SharedPreferences cache is unaffected.

**Compatibility:** the new ARB keys are additive. Existing installs do not need a migration. Generated `app_localizations*.dart` is regenerated at build time, not at runtime, so old binaries continue to work.

---

## 10. When this merges, start PR-N2

PR-N2 is the structural fix: add a `category` field to the server `Notification` schema, switch the KYC/Maintenance tab filters to use it, and switch the `_getCategoryInfo` icon/label mapping to use it.

The PR-N2 plan will be drafted in `PR_N2_NOTIFICATIONS_CATEGORY_PLAN_2026-08-26.md` immediately after PR-N1 merges. Sketch:

- **Web (server):**
  1. Add `category` enum to `web/prisma/schema.prisma` (`NotificationCategory`: `PAYMENT | KYC | MAINTENANCE | ANNOUNCEMENT | SYSTEM`)
  2. Migrate: add nullable `category String?` column to `Notification` table, backfill from existing `type` + title-keyword (same algorithm as the client today)
  3. Set `category` on all `notificationService.create()` call sites (one per business logic source: payments, KYC, maintenance, announcements, system)
  4. Update `GET /api/rider/notifications` response shape to include `category`
- **Flutter (client):**
  1. Add `category: NotificationCategory?` to `AppNotification` model
  2. Replace the KYC/Maintenance tab filters in `_getFilteredNotifications` with structured `n.category == NotificationCategory.kyc` checks
  3. Replace the keyword-matching in `_getCategoryInfo` with `n.category` lookups
  4. Remove the `txtnotifNoMatchHint` dev hint (no longer needed)
- **Tests:**
  1. Server: unit test that `category` is set correctly per source
  2. Server: integration test that the response shape includes `category`
  3. Flutter: widget test for KYC/Maintenance tabs with a Hindi-titled notification
  4. Flutter: widget test for icon/label mapping per category

Estimated effort: 1-2 days (server) + 0.5 day (Flutter) + 0.5 day (tests) = 2-3 days.

---

## Appendix A — full file diff sketches

For reviewers, here is what each edit looks like at a glance. All diffs are illustrative — the actual edit tool will produce the real diff.

### A.1 `notifications_screen.dart` — tab labels

```diff
-  String _getTabLabel(NotificationTab tab) {
+  String _getTabLabel(NotificationTab tab, AppLocalizations l) {
     switch (tab) {
       case NotificationTab.all:
-        return 'All';
+        return l.txtnotifTabAll;
       case NotificationTab.payments:
-        return 'Payments';
+        return l.txtnotifTabPayments;
       case NotificationTab.kyc:
-        return 'KYC';
+        return l.txtnotifTabKyc;
       case NotificationTab.maintenance:
-        return 'Maintenance';
+        return l.txtnotifTabMaintenance;
       case NotificationTab.announcements:
-        return 'Announcements';
+        return l.txtnotifTabAnnouncements;
     }
   }
```

### A.2 `notifications_screen.dart` — delete dialog

```diff
                                         title: const Text(
-                                          'Delete Notification',
+                                          AppLocalizations.of(context)!
+                                              .txtdeleteNotification,
                                         ),
                                         content: const Text(
-                                          'Are you sure you want to delete this notification?',
+                                          AppLocalizations.of(context)!
+                                              .txtareYouSureYouWantToDeleteThisNotification,
                                         ),
```

### A.3 `notifications_screen.dart` — empty state title

```diff
   Widget _buildEmptyState() {
     final colors = AppColors.of(context);
+    final l = AppLocalizations.of(context)!;
     return Center(
       child: Column(
         mainAxisAlignment: MainAxisAlignment.center,
         children: [
           // … icon container unchanged
           const SizedBox(height: 24),
           Text(
-            'No ${_getTabLabel(_selectedTab).toLowerCase()} notifications',
+            _emptyStateTitle(l),
             style: AppTypography.titleMedium.copyWith(color: colors.onSurface),
           ),
           const SizedBox(height: 8),
           Text(
-            "You're all caught up!",
+            l.txtnotifEmptyAllBody,
             style: GoogleFonts.plusJakartaSans(
                 fontSize: 14, color: colors.onSurfaceVariant),
           ),
         ],
       ),
     );
   }
+
+  String _emptyStateTitle(AppLocalizations l) {
+    switch (_selectedTab) {
+      case NotificationTab.all:
+        return l.txtnotifEmptyAllTitle;
+      case NotificationTab.payments:
+        return l.txtnotifEmptyPaymentsTitle;
+      case NotificationTab.kyc:
+        return l.txtnotifEmptyKycTitle;
+      case NotificationTab.maintenance:
+        return l.txtnotifEmptyMaintenanceTitle;
+      case NotificationTab.announcements:
+        return l.txtnotifEmptyAnnouncementsTitle;
+    }
+  }
```

### A.4 `notifications_screen.dart` — time formatter

```diff
   String _formatTime(DateTime dt) {
+    final l = AppLocalizations.of(context)!;
     var diff = DateTime.now().difference(dt);
     if (diff.isNegative) diff = Duration.zero;
-    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
-    if (diff.inHours < 24) return '${diff.inHours}h ago';
-    if (diff.inDays < 7) return '${diff.inDays}d ago';
-    return '${dt.day}/${dt.month}';
+    if (diff.inMinutes < 60) return l.txtnotifTimeMinutesAgo(diff.inMinutes);
+    if (diff.inHours < 24) return l.txtnotifTimeHoursAgo(diff.inHours);
+    if (diff.inDays < 7) return l.txtnotifTimeDaysAgo(diff.inDays);
+    return l.txtnotifTimeLongAgo(dt.day, dt.month);
   }
```

### A.5 `notifications_screen.dart` — tooltips (4 sites)

```diff
             _headerIconButton(
               icon: Icons.arrow_back,
               iconColor: AppColors.of(context).onSurface,
-              tooltip: 'Back',
+              tooltip: AppLocalizations.of(context)!.txtnotifTooltipBack,
               onTap: () => Navigator.maybePop(context),
             ),
```

(Plus 3 more identical-style edits at lines 435, 445, 454.)

### A.6 `notification_preferences_screen.dart` — permission toast

```diff
-        Toast.error(context, 'Notification permission was not granted');
+        Toast.error(
+          context,
+          AppLocalizations.of(context)!.txtnotifPermissionDenied,
+        );
```

---

## Appendix B — the `_noMatchHint` UX decision

The ARB already includes `txtnotifNoMatchHint` — a dev-only hint shown when the KYC/Maintenance tab is empty because of the title-keyword filter:

> "Category filter only matches English titles today. Localised KYC / maintenance notifications will appear in 'All' until the server adds a `category` field."

**Decision for PR-N1:** leave the key in the ARB but **do not wire it**. The English version is meant for testers, but:
1. It exposes implementation details ("the server doesn't have a `category` field") to end users.
2. Showing it in the UI would create a permanent artifact that PR-N2 has to remove.
3. The tester already knows the limitation from the audit report.

If the team wants to surface it for QA, a better approach is to add a `kDebugMode` toast in test mode (mirroring the F-4 `kDebugMode` pattern already in the codebase). Out of scope for PR-N1.

---

## Appendix C — quick-reference for the executor

```powershell
# 1. Add ARB keys to app_en.arb and app_hi.arb (use a JSON-aware editor — DO NOT hand-format in Notepad)
#    Insert near the existing txtnotif* block (around line 2003 in en, line 849 in hi)

# 2. Regenerate localizations
cd D:\voltium\flutter
flutter gen-l10n

# 3. Edit the two screen files
#    (use the Edit tool with the diffs in Appendix A)

# 4. Verify
flutter analyze
flutter test test/features/notifications/

# 5. Commit each step separately
git add flutter/lib/l10n/app_en.arb flutter/lib/l10n/app_hi.arb flutter/lib/gen/
git commit -m "i18n(notifications): add 13 ARB keys for F-5/F-6/F-7/F-8 wiring"
# ... 5 more commits following the 7-step order in section 5

# 6. Run e2e (requires emulator)
bash flutter/integration_test/e2e_individual/run_phased_tests.sh emulator-5554

# 7. Push and open PR
git push -u origin feat/notifications-i18n
```

---

**End of plan. Start PR-N2 once this merges.**
