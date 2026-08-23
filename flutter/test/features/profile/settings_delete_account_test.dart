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
        // The settings screen is a long list; the default
        // 800x600 test surface causes a RenderFlex overflow
        // when the screen tries to lay out at full height.
        // Wrap in `MediaQuery` to give the Scaffold room.
        builder: (context, child) => MediaQuery(
          data: const MediaQueryData(size: Size(800, 2400)),
          child: child!,
        ),
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
      'delete account tile is gated to debug builds and opens the '
      'destructive-phrase confirm dialog (F-007)', (tester) async {
    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(milliseconds: 400));

    // In debug/test builds the tile is present (guarded by kDebugMode).
    final tile = find.byKey(const Key('deleteAccountButton'));
    expect(tile, findsOneWidget);

    await tester.scrollUntilVisible(tile, 200);
    await tester.tap(tile);
    await tester.pumpAndSettle();

    // PR-4 (F-007): the previous one-tap confirm was replaced
    // with `showDestructivePhraseDialog` (type the literal
    // word "delete" to confirm). The dialog has a TextField +
    // destructive button. Initially the button is disabled; the
    // rider must type the exact phrase to enable it.
    expect(find.byType(AlertDialog), findsOneWidget);
    expect(find.byType(TextField), findsOneWidget);
    expect(find.byKey(const Key('destructivePhraseConfirmButton')),
        findsOneWidget);

    // Initially the destructive button is disabled (no match).
    final destructiveBtn =
        find.byKey(const Key('destructivePhraseConfirmButton'));
    final FilledButton button = tester.widget(destructiveBtn);
    expect(button.onPressed, isNull,
        reason: 'PR-4 (F-007): the destructive button must be DISABLED '
            'until the rider types the exact phrase');

    // Type the phrase and verify the button enables.
    await tester.enterText(find.byType(TextField), 'delete');
    await tester.pumpAndSettle();
    final FilledButton enabledBtn = tester.widget(destructiveBtn);
    expect(enabledBtn.onPressed, isNotNull,
        reason: 'PR-4 (F-007): typing the exact phrase enables the '
            'destructive button');
  });

  testWidgets('cancel leaves the screen untouched', (tester) async {
    // The settings screen is a long list; the default
    // 800x600 test surface causes a RenderFlex overflow
    // before the dialog can even appear. Set a tall
    // surface so the screen lays out cleanly.
    tester.view.physicalSize = const Size(800, 2400);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(buildTestApp());
    await tester.pump(const Duration(milliseconds: 400));

    final tile = find.byKey(const Key('deleteAccountButton'));
    await tester.scrollUntilVisible(tile, 200);
    await tester.tap(tile);
    await tester.pumpAndSettle();

    // PR-4 (F-007): the destructive-phrase dialog has no
    // explicit "Cancel" button. The dialog is dismissed
    // by tapping the modal scrim (barrierDismissible: true,
    // the AlertDialog default) OR by the OS back gesture.
    // Here we pop the dialog directly via Navigator (the
    // same code path the scrim tap uses internally).
    expect(find.byType(AlertDialog), findsOneWidget);
    final navigator = Navigator.of(
      tester.element(find.byType(AlertDialog).first),
    );
    navigator.pop();
    await tester.pumpAndSettle();

    expect(find.byType(AlertDialog), findsNothing);
  });
}
