import 'dart:async';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// In-memory backing store for the `flutter_secure_storage` plugin so
/// tests can read/write/delete values that the app persists via
/// `SecureStorageService`. The previous handler returned `null` for
/// every call, which made cache-style tests (e.g. `KycRepository`
/// form cache, auth FCM secret) read back empty even after a write.
final Map<String, String> _secureStore = <String, String>{};

Future<void> testExecutable(FutureOr<void> Function() testMain) async {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    GoogleFonts.config.allowRuntimeFetching = false;
    SharedPreferences.setMockInitialValues({});

    // Global channel mocks for providers
    const secureStorageChannel =
        MethodChannel('plugins.it_nomads.com/flutter_secure_storage');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
      secureStorageChannel,
      (MethodCall methodCall) async {
        switch (methodCall.method) {
          case 'read':
            final key = (methodCall.arguments as Map)['key'] as String;
            return _secureStore[key];
          case 'readAll':
            return Map<String, String>.from(_secureStore);
          case 'write':
            final args = methodCall.arguments as Map;
            _secureStore[args['key'] as String] = args['value'] as String;
            return null;
          case 'delete':
            final key = (methodCall.arguments as Map)['key'] as String;
            _secureStore.remove(key);
            return null;
          case 'deleteAll':
            _secureStore.clear();
            return null;
          case 'containsKey':
            final key = (methodCall.arguments as Map)['key'] as String;
            return _secureStore.containsKey(key);
        }
        return null;
      },
    );

    const posthogChannel = MethodChannel('posthog_flutter');
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(
            posthogChannel, (MethodCall methodCall) async => null);
  });
  await testMain();
}
