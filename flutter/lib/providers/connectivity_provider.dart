import 'dart:async';

import 'package:flutter/foundation.dart';

import '../services/connectivity_service.dart';

class ConnectivityProvider extends ChangeNotifier {
  StreamSubscription<bool>? _connectivitySubscription;

  bool _isOnline = true;
  bool get isOnline => _isOnline;

  int _pendingSyncCount = 0;
  int get pendingSyncCount => _pendingSyncCount;

  void bindConnectivityService(ConnectivityService service) {
    _connectivitySubscription?.cancel();
    _isOnline = service.isConnected;
    _connectivitySubscription = service.onConnectivityChanged.listen(setOnline);
  }

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

  @override
  void dispose() {
    _connectivitySubscription?.cancel();
    _connectivitySubscription = null;
    super.dispose();
  }
}
