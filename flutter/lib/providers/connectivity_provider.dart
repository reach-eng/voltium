import 'package:flutter/foundation.dart';

class ConnectivityProvider extends ChangeNotifier {
  bool _isOnline = true;
  bool get isOnline => _isOnline;

  int _pendingSyncCount = 0;
  int get pendingSyncCount => _pendingSyncCount;

  void setOnline(bool online) {
    if (_isOnline == online) return;
    _isOnline = online;
    notifyListeners();
  }

  void setPendingSyncCount(int count) {
    if (_pendingSyncCount == count) return;
    _pendingSyncCount = count;
    notifyListeners();
  }

  void logout() {
    _isOnline = true;
    _pendingSyncCount = 0;
    notifyListeners();
  }
}
