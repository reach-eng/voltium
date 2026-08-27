import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/permissions_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// PR-A (§6.4 / audit #6 P0-3) — REVERSED by the user (2026-08-21 standing
/// rule: "call_log and flutter_contacts plugins are intentional and stay. Do
/// not propose their removal in future audits"). The plugin and the
/// onboarding permission request both stay. The assertions below that
/// depended on call_log being removed are kept as `skip: true` so the
/// test file still documents the historical audit, but the on-screen
/// behaviour is intentionally unchanged.
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
      child: MaterialApp(
        localizationsDelegates: AppLocalizations.localizationsDelegates,
        supportedLocales: AppLocalizations.supportedLocales,
        home: PermissionsScreen(onNext: onNext ?? () {}),
      ),
    );
  }

  testWidgets('does not show a Call Log permission', (tester) async {
    // skip: call_log is intentionally part of the onboarding list per the
    // 2026-08-21 user rule (call_log + flutter_contacts stay). This test
    // documents the originally-proposed audit but is no longer enforceable.
  }, skip: true);

  testWidgets('phone tile is honest: call-state copy, not call history',
      (tester) async {
    // skip: see file header. Originally PR-VER-2026-08-06
    // (ONBOARDING P0-2 residual) but the wording is no longer checked
    // because the call_log request intentionally remains.
  }, skip: true);

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

class _AdminActivePolicyNotifier extends DevicePolicyProvider {
  @override
  DevicePolicyState build() => const DevicePolicyState(isAdminActive: true);
}
