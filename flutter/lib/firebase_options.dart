// Firebase options are now loaded at build time via
// flutter/lib/core/firebase/firebase_config.dart (BLOCKER 1.3).
// This file is a thin shim kept for compatibility with existing
// imports (`DefaultFirebaseOptions.currentPlatform`). Replace any
// hardcoded credentials here with --dart-define at build time.
//
// See flutter/lib/core/firebase/firebase_config.dart for the full
// key list and build instructions.

import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;
import 'package:voltium_rider/core/firebase/firebase_config.dart';

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      throw UnsupportedError(
        'DefaultFirebaseOptions have not been configured for web.',
      );
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return FirebaseConfig.android;
      case TargetPlatform.iOS:
        return FirebaseConfig.ios;
      case TargetPlatform.macOS:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not configured for macOS.',
        );
      case TargetPlatform.windows:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not configured for windows.',
        );
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not configured for linux.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }
}
