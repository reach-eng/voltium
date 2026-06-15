import 'package:flutter/foundation.dart';
import '../../data/api.dart';
import '../../domain/entity.dart';

/// Controller for the active dashboard screen.
class DashboardController extends ChangeNotifier {
  final DashboardApi _api;

  DashboardController({DashboardApi? api}) : _api = api ?? DashboardApi();

  DashboardState? _state;
  DashboardState? get state => _state;

  bool _isLoading = false;
  bool get isLoading => _isLoading;

  String? _error;
  String? get error => _error;

  Future<void> loadDashboard(String riderDbId) async {
    _isLoading = true;
    _error = null;
    notifyListeners();

    try {
      final response = await _api.getDashboard(riderDbId);
      final data = response['data'] as Map<String, dynamic>? ?? response;
      _state = DashboardState.fromJson(data);
    } catch (e) {
      _error = e.toString();
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }
}

/// Dashboard state entity.
class DashboardState {
  final double walletBalance;
  final double todayDistance;
  final double todayPower;
  final double todaySpeed;
  final int batteryLevel;
  final int? planDaysRemaining;
  final int unreadNotifications;

  const DashboardState({
    this.walletBalance = 0,
    this.todayDistance = 0,
    this.todayPower = 0,
    this.todaySpeed = 0,
    this.batteryLevel = 0,
    this.planDaysRemaining,
    this.unreadNotifications = 0,
  });

  factory DashboardState.fromJson(Map<String, dynamic> json) {
    final rider = json['rider'] as Map<String, dynamic>? ?? {};
    final wallet = rider['wallet'] as Map<String, dynamic>? ?? {};
    final todayStats = json['todayStats'] as Map<String, dynamic>? ?? {};
    return DashboardState(
      walletBalance: (wallet['balanceInPaise'] ?? 0) / 100,
      todayDistance: (todayStats['distance'] ?? 0).toDouble(),
      todayPower: (todayStats['power'] ?? 0).toDouble(),
      todaySpeed: (todayStats['speed'] ?? 0).toDouble(),
      batteryLevel: todayStats['battery'] ?? rider['batteryLevel'] ?? 0,
      planDaysRemaining: json['planDaysRemaining'] as int?,
      unreadNotifications: json['unreadNotifications'] ?? 0,
    );
  }
}
