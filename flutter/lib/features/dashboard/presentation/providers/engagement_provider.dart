import 'package:flutter/foundation.dart';
import 'package:voltium_rider/models/reward_model.dart';
import 'package:voltium_rider/models/notification_model.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';

class EngagementProvider extends ChangeNotifier {
  int _rewardPoints = 0;
  int get rewardPoints => _rewardPoints;

  int _paymentStreak = 0;
  int get paymentStreak => _paymentStreak;

  List<RewardItem> _rewards = [];
  List<RewardItem> get rewards => _rewards;

  Map<String, dynamic>? _referralData;
  Map<String, dynamic>? get referralData => _referralData;

  List<AppNotification> _notifications = [];
  List<AppNotification> get notifications => _notifications;

  void initEngagementData() {
    if (kDebugMode) {
      _rewardPoints = 1250;
      _paymentStreak = 3;
      _notifications = [
        AppNotification(
          id: '1',
          title: 'Welcome to Voltium',
          message: 'Enjoy your first ride with us!',
          type: AppNotificationType.info,
          createdAt: DateTime.now().subtract(const Duration(hours: 1)),
          isRead: false,
        ),
        AppNotification(
          id: '2',
          title: 'Ride completed',
          message: 'Your ride has been successfully completed.',
          type: AppNotificationType.info,
          createdAt: DateTime.now().subtract(const Duration(hours: 2)),
          isRead: true,
        ),
        AppNotification(
          id: '3',
          title: 'Special offer',
          message: 'Get 20% off on your next ride!',
          type: AppNotificationType.promotion,
          createdAt: DateTime.now().subtract(const Duration(days: 1)),
          isRead: true,
        ),
      ];
    }
    _fetchAll();
  }

  Future<void> _fetchAll() async {
    await refreshRewards();
    await refreshReferrals();
    notifyListeners();
  }

  Future<void> refreshRewards() async {
    try {
      final response = await VoltiumApiService().fetchRewards();
      if (response['success'] == true) {
        final data = response['data'] as Map<String, dynamic>?;
        if (data != null) {
          _rewardPoints = data['totalPoints'] as int? ?? 0;
          _paymentStreak = data['currentStreak'] as int? ?? 0;
          final rewardsList = data['rewards'] as List<dynamic>?;
          if (rewardsList != null) {
            _rewards = rewardsList
                .map((e) => RewardItem.fromJson(e as Map<String, dynamic>))
                .toList();
          }
          notifyListeners();
        }
      }
    } catch (e) {
      debugPrint('Failed to fetch rewards: $e');
    }
  }

  Future<void> refreshReferrals() async {
    try {
      final response = await VoltiumApiService().fetchReferrals();
      if (response['success'] == true) {
        _referralData = response['data'] as Map<String, dynamic>?;
        notifyListeners();
      }
    } catch (e) {
      debugPrint('Failed to fetch referrals: $e');
    }
  }

  void markNotificationAsRead(String id) {
    final idx = _notifications.indexWhere((n) => n.id == id);
    if (idx != -1) {
      _notifications[idx] = _notifications[idx].copyWith(isRead: true);
      notifyListeners();
    }
  }

  void markAllNotificationsRead() {
    _notifications =
        _notifications.map((n) => n.copyWith(isRead: true)).toList();
    notifyListeners();
  }

  void logout() {
    _rewardPoints = 0;
    _paymentStreak = 0;
    _rewards = [];
    _referralData = null;
    _notifications = [];
    notifyListeners();
  }
}
