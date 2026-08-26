import 'package:flutter/material.dart';
import 'package:json_annotation/json_annotation.dart';

part 'notification_model.g.dart';

/// Mirrors the server-side enum in `web/prisma/schema.prisma`
/// (`NotificationType`): INFO / ALERT / PROMOTION / PAYMENT /
/// VEHICLE / SOS / SYSTEM. The historical Flutter enum
/// (rideStarted / rideEnded / ...) is preserved for backwards
/// compatibility with cached records; the parser normalises both
/// the legacy names and the new server-side values into the
/// canonical set.
enum AppNotificationType {
  info,
  alert,
  promotion,
  payment,
  vehicle,
  sos,
  system,
  // Legacy aliases from the pre-Phase-2.5 Flutter enum.
  rideStarted,
  rideEnded,
  paymentReceived,
  paymentSent,
  lowBattery,
  sosAlert,
  promo,
}

/// PR-N2 (2026-08-26): explicit category for tab filtering.
/// Mirrors the server `NotificationCategory` enum in
/// `web/prisma/schema.prisma`. Optional for backward
/// compatibility with PR-N1-release builds.
enum NotificationCategory {
  payment,
  kyc,
  maintenance,
  announcement,
  system,
}

@JsonSerializable(createFactory: false)
class AppNotification {
  final String id;
  final String title;
  final String message;
  final AppNotificationType type;
  final NotificationCategory? category; // PR-N2
  final DateTime createdAt;
  final bool isRead;
  final String? actionUrl;
  final Map<String, dynamic>? data;

  AppNotification({
    required this.id,
    required this.title,
    required this.message,
    required this.type,
    required this.createdAt,
    this.category,
    this.isRead = false,
    this.actionUrl,
    this.data,
  });

  AppNotification copyWith({
    bool? isRead,
    NotificationCategory? category,
  }) {
    return AppNotification(
      id: id,
      title: title,
      message: message,
      type: type,
      category: category ?? this.category,
      createdAt: createdAt,
      isRead: isRead ?? this.isRead,
      actionUrl: actionUrl,
      data: data,
    );
  }

  Map<String, dynamic> toJson() => _$AppNotificationToJson(this);

  factory AppNotification.fromJson(Map<String, dynamic> json) =>
      AppNotification(
        id: json['id']?.toString() ??
            DateTime.now().millisecondsSinceEpoch.toString(),
        title: json['title']?.toString() ?? '',
        message: json['message']?.toString() ?? json['body']?.toString() ?? '',
        type: _parseType(json['type']),
        category: _parseCategory(json['category']),
        createdAt: DateTime.tryParse(
              json['createdAt']?.toString() ??
                  json['timestamp']?.toString() ??
                  '',
            ) ??
            DateTime.now(),
        isRead: json['isRead'] ?? false,
        actionUrl: json['actionUrl']?.toString(),
        data: json['data'] as Map<String, dynamic>?,
      );

  /// PR-N2: tolerant of unknown / missing values.
  static NotificationCategory? _parseCategory(dynamic raw) {
    if (raw == null) return null;
    final name = raw.toString().toLowerCase();
    for (final v in NotificationCategory.values) {
      if (v.name == name) return v;
    }
    return null; // unknown server value → treat as "no category"
  }

  /// Phase 2.5: normalises both the new server-side values (INFO /
  /// ALERT / PROMOTION / etc.) and the legacy Flutter names
  /// (rideStarted / paymentReceived / etc.) into the canonical enum.
  static AppNotificationType _parseType(dynamic raw) {
    if (raw is AppNotificationType) return raw;
    final name = raw?.toString() ?? '';
    final lower = name.toLowerCase();
    // Server-side canonical names.
    for (final v in AppNotificationType.values) {
      if (v.name.toLowerCase() == lower) return v;
    }
    // Legacy Flutter aliases (deprecated).
    switch (lower) {
      case 'ridestarted':
        return AppNotificationType.rideStarted;
      case 'rideended':
        return AppNotificationType.rideEnded;
      case 'paymentreceived':
        return AppNotificationType.paymentReceived;
      case 'paymentsent':
        return AppNotificationType.paymentSent;
      case 'lowbattery':
        return AppNotificationType.lowBattery;
      case 'sosalert':
        return AppNotificationType.sosAlert;
      case 'promo':
        return AppNotificationType.promo;
    }
    return AppNotificationType.system;
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  IconData get icon {
    switch (type) {
      case AppNotificationType.rideStarted:
      case AppNotificationType.vehicle:
        return Icons.electric_moped;
      case AppNotificationType.rideEnded:
        return Icons.check_circle;
      case AppNotificationType.paymentReceived:
        return Icons.arrow_downward;
      case AppNotificationType.paymentSent:
      case AppNotificationType.payment:
        return Icons.arrow_upward;
      case AppNotificationType.lowBattery:
        return Icons.battery_alert;
      case AppNotificationType.sosAlert:
      case AppNotificationType.sos:
      case AppNotificationType.alert:
        return Icons.warning;
      case AppNotificationType.promo:
      case AppNotificationType.promotion:
        return Icons.celebration;
      case AppNotificationType.system:
      case AppNotificationType.info:
        return Icons.info;
    }
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  Color get iconColor {
    switch (type) {
      case AppNotificationType.rideStarted:
      case AppNotificationType.vehicle:
        return Colors.blue;
      case AppNotificationType.rideEnded:
      case AppNotificationType.paymentReceived:
        return Colors.green;
      case AppNotificationType.paymentSent:
      case AppNotificationType.payment:
        return Colors.orange;
      case AppNotificationType.lowBattery:
      case AppNotificationType.alert:
        return Colors.red;
      case AppNotificationType.sosAlert:
      case AppNotificationType.sos:
        return Colors.red;
      case AppNotificationType.promo:
      case AppNotificationType.promotion:
        return Colors.purple;
      case AppNotificationType.system:
      case AppNotificationType.info:
        return Colors.grey;
    }
  }
}
