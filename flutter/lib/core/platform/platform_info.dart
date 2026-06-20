import 'package:flutter/foundation.dart' show kIsWeb;
import 'dart:io' show Platform;

class PlatformInfo {
  static bool get isWeb => kIsWeb;
  
  static bool get isMobile => !kIsWeb && (Platform.isAndroid || Platform.isIOS);
  
  static bool get isAndroid => !kIsWeb && Platform.isAndroid;
  
  static bool get isIOS => !kIsWeb && Platform.isIOS;
  
  static bool get supportsDeviceAdmin => isAndroid;
  
  static bool get supportsBackgroundLocation => isMobile;
  
  static bool get supportsFCM => isMobile;
  
  static bool get supportsCamera => true;
  
  static bool get supportsFilePicker => true;
}
