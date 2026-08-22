import 'package:flutter/foundation.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_driver/driver_extension.dart';
import 'main.dart' as app;

/// Driver entry point. Builds the production app and exposes a
/// Flutter Driver port for the integration-test harness.
///
/// PR-1 (F-001): the previous version flipped `app.isTestModeOverride = true`
/// at runtime, which (a) bypassed the OTP / KYC / permissions gates and (b)
/// could leak into a release build if the assert in `AppConstants.isTestMode`
/// were ever removed. The new build-time gate `--dart-define=ENABLE_DRIVER=true`
/// is the only way to enable the driver port; this entry is now a
/// release-build no-op (the assert trips before any UI loads).
///
/// To build: `flutter build apk --dart-define=ENABLE_DRIVER=true --debug`
void main() {
  assert(
    !kReleaseMode,
    'driver_main.dart must never be compiled into a release build. '
    'It exposes a Flutter Driver port that lets any process with ADB '
    'access drive the app remotely.',
  );
  enableFlutterDriverExtension();
  app.main();
}
