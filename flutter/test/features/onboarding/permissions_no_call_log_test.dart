import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/permissions_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// PR-A (§6.4 / audit #6 P0-3): the call-log permission was removed from the
/// onboarding permission list (it was never used for functionality and
/// violates the principle of least privilege). Only 8 genuine permissions
/// remain, and none is named or keyed "call_log".
void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const permissionChannel =
      MethodChannel('flutter.baseflow.com/permissions/methods');
  const geolocatorChannel = MethodChannel('flutter.baseflow.com/geolocator');

  setUp(() {
    // 1 = granted for every permission_handler call.
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            permissionChannel, (MethodCall methodCall) async => 1);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            geolocatorChannel, (MethodCall methodCall) async => null);
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(permissionChannel, null);
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(geolocatorChannel, null);
  });

  Widget buildScreen({VoidCallback? onNext}) {
    return ProviderScope(
      overrides: [
        // Device Admin can't be granted via the permission channel in tests;
        // default to an already-active policy so the Continue gate unlocks.
        devicePolicyProvider.overrideWith(
          () => _AdminActivePolicyNotifier(),
        ),
      ],
      // AUDIT FIX: the screen force-unwraps `AppLocalizations.of(context)!`
      // — the harness must provide localization delegates or build throws.
      child: MaterialApp(
        locale: const Locale('en'),
        supportedLocales: LocaleProvider.supportedLocales,
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: PermissionsScreen(onNext: onNext ?? () {}),
      ),
    );
  }

  testWidgets('does not show a Call Log permission', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.textContaining('Call Log'), findsNothing);
    expect(find.byKey(const Key('allowCallLogButton')), findsNothing);
  });

  testWidgets('phone tile is honest: call-state copy, not call history',
      (tester) async {
    // PR-VER-2026-08-06 (ONBOARDING P0-2 residual): the phone permission
    // maps to Android READ_PHONE_STATE. The tile must say "call state" /
    // "call detection" — never imply it reads call history or contacts.
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('Phone State'), findsOneWidget);
    expect(
      find.text('Phone state (for safety call detection)'),
      findsOneWidget,
    );
    // No wording that suggests call-history access.
    expect(find.textContaining('history'), findsNothing);
  });

  testWidgets('keeps the genuinely required permissions', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 600));

    expect(find.text('Location'), findsOneWidget);
    expect(find.text('Notifications'), findsOneWidget);
    expect(find.text('Camera'), findsOneWidget);
    expect(find.byKey(const Key('allowLocationButton')), findsOneWidget);
  });

  testWidgets('can proceed when required permissions are granted',
      (tester) async {
    var nextTapped = false;
    await tester.pumpWidget(buildScreen(onNext: () => nextTapped = true));
    await tester.pump(const Duration(milliseconds: 600));

    final continueButton = find.byKey(const Key('continuePermissionsButton'));
    expect(continueButton, findsOneWidget);
    await tester.tap(continueButton);
    expect(nextTapped, isTrue);
  });
}

// AUDIT FIX: the notifier class was consolidated to `DevicePolicyProvider`
// (Riverpod v3 Notifier); the stub must extend the current class or this
// test file fails to compile (same rename-drift as the dashboard stub).
class _AdminActivePolicyNotifier extends DevicePolicyProvider {
  @override
  DevicePolicyState build() => const DevicePolicyState(isAdminActive: true);
}
