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

/// Service wrapping SharedPreferences persistence for notification preferences.
class NotificationPrefsService {
  static const String keyPush = 'notif_push';
  static const String keySound = 'notif_sound';
  static const String keyVibration = 'notif_vibration';
  static const String keyPayments = 'notif_payments';
  static const String keyKyc = 'notif_kyc';
  static const String keyMaintenance = 'notif_maintenance';
  static const String keyAnnouncements = 'notif_announcements';

  Future<NotificationPrefs> load() async {
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

  Future<void> save(NotificationPrefs p) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setBool(keyPush, p.push);
    await prefs.setBool(keySound, p.sound);
    await prefs.setBool(keyVibration, p.vibration);
    await prefs.setBool(keyPayments, p.payments);
    await prefs.setBool(keyKyc, p.kyc);
    await prefs.setBool(keyMaintenance, p.maintenance);
    await prefs.setBool(keyAnnouncements, p.announcements);
  }
}
