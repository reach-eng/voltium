import 'package:flutter/foundation.dart';

class PlatformInfo {
  static bool get isWeb => kIsWeb;
  
  static bool get isMobile => !kIsWeb && (defaultTargetPlatform == TargetPlatform.android || defaultTargetPlatform == TargetPlatform.iOS);
  
  static bool get isAndroid => !kIsWeb && defaultTargetPlatform == TargetPlatform.android;
  
  static bool get isIOS => !kIsWeb && defaultTargetPlatform == TargetPlatform.iOS;
  
  static bool get supportsDeviceAdmin => isAndroid;
  
  static bool get supportsBackgroundLocation => isMobile;
  
  static bool get supportsFCM => isMobile;
  
  static bool get supportsCamera => true;
  
  static bool get supportsFilePicker => true;
}
