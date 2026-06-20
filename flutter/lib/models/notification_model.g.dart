// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'notification_model.dart';

// **************************************************************************
// JsonSerializableGenerator
// **************************************************************************

Map<String, dynamic> _$AppNotificationToJson(AppNotification instance) =>
    <String, dynamic>{
      'id': instance.id,
      'title': instance.title,
      'message': instance.message,
      'type': _$AppNotificationTypeEnumMap[instance.type]!,
      'createdAt': instance.createdAt.toIso8601String(),
      'isRead': instance.isRead,
      'actionUrl': instance.actionUrl,
      'data': instance.data,
    };

const _$AppNotificationTypeEnumMap = {
  AppNotificationType.rideStarted: 'rideStarted',
  AppNotificationType.rideEnded: 'rideEnded',
  AppNotificationType.paymentReceived: 'paymentReceived',
  AppNotificationType.paymentSent: 'paymentSent',
  AppNotificationType.lowBattery: 'lowBattery',
  AppNotificationType.sosAlert: 'sosAlert',
  AppNotificationType.promo: 'promo',
  AppNotificationType.system: 'system',
};
