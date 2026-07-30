import 'package:flutter/foundation.dart';
import 'package:voltium_rider/models/reward_model.dart';
import 'package:voltium_rider/models/notification_model.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import '../../../../utils/app_logger.dart';

class EngagementProvider extends ChangeNotifier {
  final VoltiumApiService _apiService;

  EngagementProvider({VoltiumApiService? apiService})
      : _apiService = apiService ?? VoltiumApiService();

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

  int _unreadCount = 0;
  int get unreadCount => _unreadCount;

  void initEngagementData() {
    if (AppConstants.isTestMode) {
      _loadDummyData();
      return;
    }
    _fetchAll();
  }

  void _loadDummyData() {
    _rewardPoints = 1250;
    _paymentStreak = 3;
    _notifications = [
      AppNotification(
        id: '1',
        title: 'Rent Reminder',
        message: 'Your rent is due in 3 days.',
        type: AppNotificationType.system,
        createdAt: DateTime.now(),
        isRead: false,
      ),
      AppNotification(
        id: '2',
        title: 'Weekly Reward',
        message: 'You earned 50 bonus points!',
        type: AppNotificationType.system,
        createdAt: DateTime.now(),
        isRead: false,
      ),
      AppNotification(
        id: '3',
        title: 'System Update',
        message: 'App updated to latest version.',
        type: AppNotificationType.system,
        createdAt: DateTime.now(),
        isRead: true,
      ),
    ];
    _unreadCount = 2;
  }

  Future<void> _fetchAll() async {
    await Future.wait([
      refreshRewards(),
      refreshReferrals(),
      refreshNotifications(),
    ]);
    notifyListeners();
  }

  Future<void> refreshRewards() async {
    try {
      final response = await _apiService.fetchRewards();
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
      appDebug('Failed to fetch rewards: $e');
    }
  }

  Future<void> refreshReferrals() async {
    try {
      final response = await _apiService.fetchReferrals();
      if (response['success'] == true) {
        _referralData = response['data'] as Map<String, dynamic>?;
        notifyListeners();
      }
    } catch (e) {
      appDebug('Failed to fetch referrals: $e');
    }
  }

  Future<void> refreshNotifications() async {
    try {
      final response = await _apiService.get('/api/rider/notifications');
      if (response['success'] == true && response['data'] != null) {
        final data = response['data'] as Map<String, dynamic>;
        _unreadCount = data['unreadCount'] as int? ?? 0;
        final list = data['notifications'] as List<dynamic>?;
        if (list != null) {
          _notifications = list
              .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
              .toList();
          notifyListeners();
        }
      }
    } catch (e) {
      appDebug('Failed to fetch notifications: $e');
    }
  }

  void markNotificationAsRead(String id) {
    final idx = _notifications.indexWhere((n) => n.id == id);
    if (idx != -1) {
      _notifications[idx] = _notifications[idx].copyWith(isRead: true);
      _unreadCount = (_unreadCount - 1).clamp(0, 999);
      notifyListeners();
    }
    if (!AppConstants.isTestMode) {
      _apiService
          .post('/api/rider/notifications', body: {'notificationId': id});
    }
  }

  void markAllNotificationsRead() {
    _notifications =
        _notifications.map((n) => n.copyWith(isRead: true)).toList();
    _unreadCount = 0;
    notifyListeners();
    if (!AppConstants.isTestMode) {
      _apiService.post('/api/rider/notifications', body: {});
    }
  }

  void logout() {
    _rewardPoints = 0;
    _paymentStreak = 0;
    _rewards = [];
    _referralData = null;
    _notifications = [];
    _unreadCount = 0;
    notifyListeners();
  }
}
