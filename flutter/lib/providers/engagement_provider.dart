import 'package:flutter/foundation.dart';
import '../models/reward_model.dart';
import '../models/notification_model.dart';
import '../services/voltium_api_service.dart';

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
            title: 'Payment Successful',
            message: 'Your wallet top-up of ₹500 was successful.',
            type: AppNotificationType.paymentReceived,
            createdAt: DateTime.now().subtract(const Duration(hours: 2)),
            isRead: false,),
        AppNotification(
            id: '2',
            title: 'Daily Reward Earned!',
            message: 'You earned 50 points for your 3-day payment streak.',
            type: AppNotificationType.promo,
            createdAt: DateTime.now().subtract(const Duration(days: 1)),
            isRead: true,),
        AppNotification(
            id: '3',
            title: 'Vehicle Service Due',
            message:
                'Your vehicle is due for a routine check-up. Please visit the hub.',
            type: AppNotificationType.system,
            createdAt: DateTime.now().subtract(const Duration(days: 3)),
            isRead: true,),
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
