import 'package:flutter/material.dart';
import 'package:json_annotation/json_annotation.dart';

part 'notification_model.g.dart';

enum AppNotificationType {
  rideStarted,
  rideEnded,
  paymentReceived,
  paymentSent,
  lowBattery,
  sosAlert,
  promo,
  system,
}

@JsonSerializable(createFactory: false)
class AppNotification {
  final String id;
  final String title;
  final String message;
  final AppNotificationType type;
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
    this.isRead = false,
    this.actionUrl,
    this.data,
  });

  AppNotification copyWith({bool? isRead}) {
    return AppNotification(
      id: id,
      title: title,
      message: message,
      type: type,
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
        type: AppNotificationType.values.firstWhere(
          (e) => e.name == json['type'],
          orElse: () => AppNotificationType.system,
        ),
        createdAt: DateTime.tryParse(json['createdAt']?.toString() ??
                json['timestamp']?.toString() ??
                '',) ??
            DateTime.now(),
        isRead: json['isRead'] ?? false,
        actionUrl: json['actionUrl']?.toString(),
        data: json['data'] as Map<String, dynamic>?,
      );

  @JsonKey(includeFromJson: false, includeToJson: false)
  IconData get icon {
    switch (type) {
      case AppNotificationType.rideStarted:
        return Icons.electric_moped;
      case AppNotificationType.rideEnded:
        return Icons.check_circle;
      case AppNotificationType.paymentReceived:
        return Icons.arrow_downward;
      case AppNotificationType.paymentSent:
        return Icons.arrow_upward;
      case AppNotificationType.lowBattery:
        return Icons.battery_alert;
      case AppNotificationType.sosAlert:
        return Icons.warning;
      case AppNotificationType.promo:
        return Icons.celebration;
      case AppNotificationType.system:
        return Icons.info;
    }
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  Color get iconColor {
    switch (type) {
      case AppNotificationType.rideStarted:
        return Colors.blue;
      case AppNotificationType.rideEnded:
        return Colors.green;
      case AppNotificationType.paymentReceived:
        return Colors.green;
      case AppNotificationType.paymentSent:
        return Colors.orange;
      case AppNotificationType.lowBattery:
        return Colors.red;
      case AppNotificationType.sosAlert:
        return Colors.red;
      case AppNotificationType.promo:
        return Colors.purple;
      case AppNotificationType.system:
        return Colors.grey;
    }
  }

  @JsonKey(includeFromJson: false, includeToJson: false)
  Color get iconBgColor {
    switch (type) {
      case AppNotificationType.rideStarted:
        return Colors.blue.shade50;
      case AppNotificationType.rideEnded:
        return Colors.green.shade50;
      case AppNotificationType.paymentReceived:
        return Colors.green.shade50;
      case AppNotificationType.paymentSent:
        return Colors.orange.shade50;
      case AppNotificationType.lowBattery:
        return Colors.red.shade50;
      case AppNotificationType.sosAlert:
        return Colors.red.shade50;
      case AppNotificationType.promo:
        return Colors.purple.shade50;
      case AppNotificationType.system:
        return Colors.grey.shade50;
    }
  }
}
