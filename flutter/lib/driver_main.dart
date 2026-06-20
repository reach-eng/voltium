// ignore: depend_on_referenced_packages
import 'package:flutter_driver/driver_extension.dart';
import 'main.dart' as app;

void main() {
  app.isTestModeOverride = true;
  enableFlutterDriverExtension();
  app.main();
}
