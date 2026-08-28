import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

/// Typed model for user notification preferences.
class NotificationPrefs {
  final bool push;
  final bool sound;
  final bool vibration;
  final bool payments;
  final bool kyc;
  final bool maintenance;
  final bool announcements;

  const NotificationPrefs({
    this.push = true,
    this.sound = true,
    this.vibration = true,
    this.payments = true,
    this.kyc = true,
    this.maintenance = true,
    this.announcements = false,
  });

  NotificationPrefs copyWith({
    bool? push,
    bool? sound,
    bool? vibration,
    bool? payments,
    bool? kyc,
    bool? maintenance,
    bool? announcements,
  }) {
    return NotificationPrefs(
      push: push ?? this.push,
      sound: sound ?? this.sound,
      vibration: vibration ?? this.vibration,
      payments: payments ?? this.payments,
      kyc: kyc ?? this.kyc,
      maintenance: maintenance ?? this.maintenance,
      announcements: announcements ?? this.announcements,
    );
  }
}

/// Riverpod v3 AsyncNotifier that owns the rider's notification
/// preferences. The previous design was a plain singleton
/// `NotificationPrefsService` that every screen had to instantiate
/// directly; tests couldn't override it and there was no shared
/// source of truth. This provider lets any screen `ref.watch`
/// the current prefs and `ref.read` to call `update(...)`.
class NotificationPrefsNotifier extends AsyncNotifier<NotificationPrefs> {
  static const String keyPush = 'notif_push';
  static const String keySound = 'notif_sound';
  static const String keyVibration = 'notif_vibration';
  static const String keyPayments = 'notif_payments';
  static const String keyKyc = 'notif_kyc';
  static const String keyMaintenance = 'notif_maintenance';
  static const String keyAnnouncements = 'notif_announcements';

  @override
  Future<NotificationPrefs> build() async {
    final prefs = await SharedPreferences.getInstance();
    return NotificationPrefs(
      push: prefs.getBool(keyPush) ?? true,
      sound: prefs.getBool(keySound) ?? true,
      vibration: prefs.getBool(keyVibration) ?? true,
      payments: prefs.getBool(keyPayments) ?? true,
      kyc: prefs.getBool(keyKyc) ?? true,
      maintenance: prefs.getBool(keyMaintenance) ?? true,
      announcements: prefs.getBool(keyAnnouncements) ?? false,
    );
  }

  /// Persist a new preference set and broadcast to all listeners.
  /// Renamed from `update` to `save` to avoid colliding with
  /// AsyncNotifier's `update` (Riverpod 3.x reserves that name).
  Future<void> save(NotificationPrefs p) async {
    state = const AsyncValue.loading();
    state = await AsyncValue.guard(() async {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(keyPush, p.push);
      await prefs.setBool(keySound, p.sound);
      await prefs.setBool(keyVibration, p.vibration);
      await prefs.setBool(keyPayments, p.payments);
      await prefs.setBool(keyKyc, p.kyc);
      await prefs.setBool(keyMaintenance, p.maintenance);
      await prefs.setBool(keyAnnouncements, p.announcements);
      return p;
    });
  }
}

final notificationPrefsProvider =
    AsyncNotifierProvider<NotificationPrefsNotifier, NotificationPrefs>(
  NotificationPrefsNotifier.new,
);
