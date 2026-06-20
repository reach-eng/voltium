import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/notification_model.dart';

class NotificationProvider extends ChangeNotifier {
  static const String _key = 'volt_notifications';

  List<AppNotification> _notifications = [];
  List<AppNotification> get notifications => _notifications;

  int get unreadCount => _notifications.where((n) => !n.isRead).length;
  List<AppNotification> get unreadNotifications =>
      _notifications.where((n) => !n.isRead).toList();

  NotificationProvider() {
    _loadNotifications();
  }

  Future<void> _loadNotifications() async {
    final prefs = await SharedPreferences.getInstance();
    final json = prefs.getString(_key);
    if (json != null) {
      try {
        final list = jsonDecode(json) as List;
        _notifications = list
            .map((e) => AppNotification.fromJson(e as Map<String, dynamic>))
            .toList();
        _notifications.sort((a, b) => b.createdAt.compareTo(a.createdAt));
        notifyListeners();
      } catch (_) {
        _notifications = [];
      }
    }
  }

  Future<void> _saveNotifications() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _key,
      jsonEncode(_notifications.map((n) => n.toJson()).toList()),
    );
  }

  Future<void> addNotification(AppNotification notification) async {
    _notifications.insert(0, notification);
    await _saveNotifications();
    notifyListeners();
  }

  Future<void> addNotifications(List<AppNotification> notifications) async {
    _notifications.insertAll(0, notifications);
    _notifications.sort((a, b) => b.createdAt.compareTo(a.createdAt));
    await _saveNotifications();
    notifyListeners();
  }

  Future<void> markAsRead(String id) async {
    final index = _notifications.indexWhere((n) => n.id == id);
    if (index != -1) {
      _notifications[index] = _notifications[index].copyWith(isRead: true);
      await _saveNotifications();
      notifyListeners();
    }
  }

  Future<void> markAllAsRead() async {
    _notifications =
        _notifications.map((n) => n.copyWith(isRead: true)).toList();
    await _saveNotifications();
    notifyListeners();
  }

  Future<void> deleteNotification(String id) async {
    _notifications.removeWhere((n) => n.id == id);
    await _saveNotifications();
    notifyListeners();
  }

  Future<void> clearAll() async {
    _notifications.clear();
    await _saveNotifications();
    notifyListeners();
  }
}
