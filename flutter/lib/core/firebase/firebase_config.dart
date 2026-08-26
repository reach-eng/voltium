// Firebase configuration loaded from build-time --dart-define values
// (BLOCKER 1.3). No hardcoded credentials. The build will fail at startup
// if any required key is missing — the error message lists which key
// needs to be set.
//
// Build commands:
//
//   flutter build apk \
//     --dart-define=FIREBASE_API_KEY_ANDROID=... \
//     --dart-define=FIREBASE_APP_ID_ANDROID=... \
//     --dart-define=FIREBASE_MESSAGING_SENDER_ID_ANDROID=... \
//     --dart-define=FIREBASE_PROJECT_ID=... \
//     --dart-define=FIREBASE_STORAGE_BUCKET=... \
//     --dart-define=FIREBASE_API_KEY_IOS=... \
//     --dart-define=FIREBASE_APP_ID_IOS=... \
//     --dart-define=FIREBASE_MESSAGING_SENDER_ID_IOS=... \
//     --dart-define=FIREBASE_IOS_BUNDLE_ID=...
//
// All keys are required. None have defaults — a missing key throws
// `MissingFirebaseConfigException` with the offending key name.
//
// The copy-flutter-web.sh script reads these from .env and injects them
// automatically. CI must populate them from secrets.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;

class MissingFirebaseConfigException implements Exception {
  final String key;
  const MissingFirebaseConfigException(this.key);
  @override
  String toString() => 'MissingFirebaseConfigException: $key is required. '
      'Pass it via --dart-define=$key=<value> at build time. '
      'See flutter/lib/core/firebase/firebase_config.dart for the full key list.';
}

class FirebaseConfig {
  // Android
  static const String _androidApiKey =
      String.fromEnvironment('FIREBASE_API_KEY_ANDROID');
  static const String _androidAppId =
      String.fromEnvironment('FIREBASE_APP_ID_ANDROID');
  static const String _androidMessagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID_ANDROID');

  // iOS
  static const String _iosApiKey =
      String.fromEnvironment('FIREBASE_API_KEY_IOS');
  static const String _iosAppId = String.fromEnvironment('FIREBASE_APP_ID_IOS');
  static const String _iosMessagingSenderId =
      String.fromEnvironment('FIREBASE_MESSAGING_SENDER_ID_IOS');
  static const String _iosBundleId =
      String.fromEnvironment('FIREBASE_IOS_BUNDLE_ID');

  // Shared
  static const String _projectId =
      String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const String _storageBucket =
      String.fromEnvironment('FIREBASE_STORAGE_BUCKET');

  static FirebaseOptions get android {
    if (_androidApiKey.isEmpty) {
      throw const MissingFirebaseConfigException('FIREBASE_API_KEY_ANDROID');
    }
    if (_androidAppId.isEmpty) {
      throw const MissingFirebaseConfigException('FIREBASE_APP_ID_ANDROID');
    }
    if (_androidMessagingSenderId.isEmpty) {
      throw const MissingFirebaseConfigException(
          'FIREBASE_MESSAGING_SENDER_ID_ANDROID');
    }
    if (_projectId.isEmpty) {
      throw const MissingFirebaseConfigException('FIREBASE_PROJECT_ID');
    }
    if (_storageBucket.isEmpty) {
      throw const MissingFirebaseConfigException('FIREBASE_STORAGE_BUCKET');
    }
    return FirebaseOptions(
      apiKey: _androidApiKey,
      appId: _androidAppId,
      messagingSenderId: _androidMessagingSenderId,
      projectId: _projectId,
      storageBucket: _storageBucket,
    );
  }

  static FirebaseOptions get ios {
    if (_iosApiKey.isEmpty) {
      throw const MissingFirebaseConfigException('FIREBASE_API_KEY_IOS');
    }
    if (_iosAppId.isEmpty) {
      throw const MissingFirebaseConfigException('FIREBASE_APP_ID_IOS');
    }
    if (_iosMessagingSenderId.isEmpty) {
      throw const MissingFirebaseConfigException(
          'FIREBASE_MESSAGING_SENDER_ID_IOS');
    }
    if (_projectId.isEmpty) {
      throw const MissingFirebaseConfigException('FIREBASE_PROJECT_ID');
    }
    if (_storageBucket.isEmpty) {
      throw const MissingFirebaseConfigException('FIREBASE_STORAGE_BUCKET');
    }
    final iosBundleId = _iosBundleId.isNotEmpty
        ? _iosBundleId
        : throw const MissingFirebaseConfigException('FIREBASE_IOS_BUNDLE_ID');
    return FirebaseOptions(
      apiKey: _iosApiKey,
      appId: _iosAppId,
      messagingSenderId: _iosMessagingSenderId,
      projectId: _projectId,
      storageBucket: _storageBucket,
      iosBundleId: iosBundleId,
    );
  }
}
