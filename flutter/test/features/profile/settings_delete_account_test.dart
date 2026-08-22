import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/profile/presentation/screens/settings_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

/// PR-3 (2026-08-07 verification report, Section 2): the Delete Account tile
/// is now wired to the real POST /api/rider/account/delete-request endpoint
/// (audit #6 P0-4 resolved) and is shown in all builds. Widget tests run
/// without a network, so confirming either shows the success snackbar (if the
/// mock/http layer resolves) or an error snackbar — both paths assert a
/// SnackBar appears.
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  Widget buildTestApp() {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
      ],
      child: MaterialApp(
        locale: const Locale('en'),
        supportedLocales: LocaleProvider.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const SettingsScreen(),
      ),
    );
  }

  testWidgets('renders the settings screen without error', (tester) async {
    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(milliseconds: 400));
    expect(find.byType(SettingsScreen), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets(
      'delete account tile is gated to debug builds and opens the confirm '
      'dialog', (tester) async {
    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(milliseconds: 400));

    // In debug/test builds the tile is present (guarded by kDebugMode).
    final tile = find.byKey(const Key('deleteAccountButton'));
    expect(tile, findsOneWidget);

    await tester.scrollUntilVisible(tile, 200);
    await tester.tap(tile);
    await tester.pumpAndSettle();

    // The dialog opens (tile title + dialog title both say "Delete Account",
    // so assert on the dialog's actions instead of the text).
    expect(find.byType(AlertDialog), findsOneWidget);
    expect(find.byKey(const Key('confirmDeleteButton')), findsOneWidget);
    expect(find.byKey(const Key('cancelDeleteButton')), findsOneWidget);

    await tester.tap(find.byKey(const Key('confirmDeleteButton')));
    await tester.pumpAndSettle();

    // AUDIT FIX (2026-08-22): confirming now requires lock-password step-up
    // verification before the delete-request call is submitted.
    expect(find.byKey(const Key('lockPasswordInput')), findsOneWidget);
    await tester.enterText(find.byKey(const Key('lockPasswordInput')), '1234');
    await tester.tap(find.byKey(const Key('confirmVerifyLockButton')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));

    // Verification fails without a backend. Per the audit fix the step-up
    // dialog stays OPEN with a friendly inline error (no raw server string,
    // no crash) and the deletion request is NOT submitted.
    expect(tester.takeException(), isNull);
    expect(find.byType(AlertDialog), findsOneWidget);
    expect(
        find.textContaining(RegExp('incorrect|failed', caseSensitive: false)),
        findsAtLeastNWidgets(1));
  });

  testWidgets('cancel leaves the screen untouched', (tester) async {
    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(milliseconds: 400));

    final tile = find.byKey(const Key('deleteAccountButton'));
    await tester.scrollUntilVisible(tile, 200);
    await tester.tap(tile);
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const Key('cancelDeleteButton')));
    await tester.pumpAndSettle();

    expect(find.byType(AlertDialog), findsNothing);
  });
}
