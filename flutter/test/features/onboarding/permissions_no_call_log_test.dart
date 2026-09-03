/// PR-A (§6.4 / audit #6 P0-3) — the audit wanted to remove `call_log`
/// from the onboarding permission list. The user reversed that: call
/// log AND every other permission on this screen are intentionally
/// required (2026-08-28 explicit instruction: "All the permissions on
/// the permission page are completely necessary"). The tests below now
/// assert the OPPOSITE of the original audit — every permission stays
/// on the page and the copy is honest about what each one is for.
library;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/permissions_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// PR-A (§6.4 / audit #6 P0-3) — the audit wanted to remove `call_log`
/// from the onboarding permission list. The user reversed that: call
/// log AND every other permission on this screen are intentionally
/// required (2026-08-28 explicit instruction: "All the permissions on
/// the permission page are completely necessary"). The tests below now
/// assert the OPPOSITE of the original audit — every permission stays
/// on the page and the copy is honest about what each one is for.

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

  testWidgets(
      'Call Log permission is shown (user rule: all permissions necessary)',
      (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 600));

    // The user's 2026-08-28 instruction explicitly reversed the audit
    // that wanted to drop call_log from the onboarding list. Every
    // permission on this page is necessary.
    expect(find.textContaining('Call Log'), findsOneWidget,
        reason: 'Call Log is a required onboarding permission per rider');
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

  testWidgets('keeps all genuinely required permissions', (tester) async {
    await tester.pumpWidget(buildScreen());
    await tester.pump(const Duration(milliseconds: 600));

    // Every permission on this page is required per the rider
    // (2026-08-28). Each shows its "Allow" affordance.
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
