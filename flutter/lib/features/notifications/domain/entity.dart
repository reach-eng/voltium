/// Notification priority levels.
enum NotificationPriority { low, normal, high, critical }

/// Notification domain entity.
class NotificationEntity {
  final String id;
  final String title;
  final String message;
  final String type;
  final NotificationPriority priority;
  final bool isRead;
  final String? deepLink;
  final DateTime createdAt;

  const NotificationEntity({
    required this.id,
    required this.title,
    this.message = '',
    this.type = 'general',
    this.priority = NotificationPriority.normal,
    this.isRead = false,
    this.deepLink,
    required this.createdAt,
  });

  factory NotificationEntity.fromJson(Map<String, dynamic> json) {
    return NotificationEntity(
      id: json['id'] as String,
      title: json['title'] as String? ?? '',
      message: json['message'] as String? ?? '',
      type: json['type'] as String? ?? 'general',
      priority: _parsePriority(json['priority'] as String?),
      isRead: json['isRead'] as bool? ?? false,
      deepLink: json['deepLink'] as String?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }

  static NotificationPriority _parsePriority(String? priority) {
    switch (priority?.toUpperCase()) {
      case 'LOW':
        return NotificationPriority.low;
      case 'HIGH':
        return NotificationPriority.high;
      case 'CRITICAL':
        return NotificationPriority.critical;
      default:
        return NotificationPriority.normal;
    }
  }
}
