import 'package:flutter/material.dart';

import '../services/cache_service.dart';

class ThemeProvider extends ChangeNotifier {
  ThemeProvider() {
    _isDarkMode = _loadSavedTheme();
  }

  bool _isDarkMode = false;

  bool get isDarkMode => _isDarkMode;

  bool get isLightMode => !_isDarkMode;

  ThemeMode get themeMode => _isDarkMode ? ThemeMode.dark : ThemeMode.light;

  static bool _loadSavedTheme() {
    return CacheService().getDarkMode() ?? false;
  }

  Future<void> setDarkMode(bool value) async {
    if (_isDarkMode == value) return;
    _isDarkMode = value;
    await CacheService().setDarkMode(value);
    notifyListeners();
  }

  Future<void> toggleTheme() => setDarkMode(!_isDarkMode);
}
