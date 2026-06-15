import 'package:flutter/material.dart';

enum NotificationType { ride, payment, promo, alert, system }

class NotificationCard extends StatelessWidget {
  final String title;
  final String message;
  final NotificationType type;
  final DateTime? timestamp;
  final VoidCallback? onTap;
  final bool isRead;

  const NotificationCard({
    super.key,
    required this.title,
    required this.message,
    this.type = NotificationType.system,
    this.timestamp,
    this.onTap,
    this.isRead = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Material(
        color: isRead
            ? (Theme.of(context).brightness == Brightness.dark
                ? const Color(0xFF1E293B)
                : const Color(0xFFF5F7FA))
            : (Theme.of(context).brightness == Brightness.dark
                ? const Color(0xFF1E293B)
                : Colors.white),
        borderRadius: BorderRadius.circular(12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              border: Border(
                left: BorderSide(
                  color: _getColor(),
                  width: 4,
                ),
              ),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: _getColor().withOpacity(0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _getIcon(),
                    color: _getColor(),
                    size: 20,
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              title,
                              style: TextStyle(
                                fontWeight: isRead
                                    ? FontWeight.normal
                                    : FontWeight.bold,
                                fontSize: 14,
                              ),
                            ),
                          ),
                          if (timestamp != null)
                            Text(
                              _formatTime(timestamp!),
                              style: TextStyle(
                                color: Colors.grey.shade500,
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        message,
                        style: TextStyle(
                          color: Colors.grey.shade600,
                          fontSize: 13,
                        ),
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ),
                if (!isRead)
                  Container(
                    margin: const EdgeInsets.only(left: 8),
                    width: 8,
                    height: 8,
                    decoration: const BoxDecoration(
                      color: Color(0xFF0053C1),
                      shape: BoxShape.circle,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  IconData _getIcon() {
    switch (type) {
      case NotificationType.ride:
        return Icons.directions_car;
      case NotificationType.payment:
        return Icons.payment;
      case NotificationType.promo:
        return Icons.local_offer;
      case NotificationType.alert:
        return Icons.warning;
      case NotificationType.system:
        return Icons.info;
    }
  }

  Color _getColor() {
    switch (type) {
      case NotificationType.ride:
        return const Color(0xFF0053C1);
      case NotificationType.payment:
        return const Color(0xFF16A34A);
      case NotificationType.promo:
        return const Color(0xFFD97706);
      case NotificationType.alert:
        return const Color(0xFFD92D20);
      case NotificationType.system:
        return const Color(0xFF667085);
    }
  }

  String _formatTime(DateTime time) {
    final now = DateTime.now();
    final diff = now.difference(time);
    if (diff.inMinutes < 60) {
      return '${diff.inMinutes}m';
    } else if (diff.inHours < 24) {
      return '${diff.inHours}h';
    } else if (diff.inDays < 7) {
      return '${diff.inDays}d';
    } else {
      return '${time.day}/${time.month}';
    }
  }
}

class NotificationListTile extends StatelessWidget {
  final String title;
  final String subtitle;
  final NotificationType type;
  final VoidCallback? onTap;
  final Widget? trailing;

  const NotificationListTile({
    super.key,
    required this.title,
    required this.subtitle,
    this.type = NotificationType.system,
    this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      leading: Container(
        padding: const EdgeInsets.all(8),
        decoration: BoxDecoration(
          color: _getColor().withOpacity(0.1),
          borderRadius: BorderRadius.circular(8),
        ),
        child: Icon(_getIcon(), color: _getColor(), size: 20),
      ),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: trailing ?? const Icon(Icons.chevron_right),
      onTap: onTap,
    );
  }

  IconData _getIcon() {
    switch (type) {
      case NotificationType.ride:
        return Icons.directions_car;
      case NotificationType.payment:
        return Icons.payment;
      case NotificationType.promo:
        return Icons.local_offer;
      case NotificationType.alert:
        return Icons.warning;
      case NotificationType.system:
        return Icons.info;
    }
  }

  Color _getColor() {
    switch (type) {
      case NotificationType.ride:
        return const Color(0xFF0053C1);
      case NotificationType.payment:
        return const Color(0xFF16A34A);
      case NotificationType.promo:
        return const Color(0xFFD97706);
      case NotificationType.alert:
        return const Color(0xFFD92D20);
      case NotificationType.system:
        return const Color(0xFF667085);
    }
  }
}

class NotificationGroup extends StatelessWidget {
  final String title;
  final List<Widget> children;
  final bool expanded;

  const NotificationGroup({
    super.key,
    required this.title,
    required this.children,
    this.expanded = true,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          child: Text(
            title,
            style: const TextStyle(
              fontWeight: FontWeight.bold,
              fontSize: 14,
              color: Color(0xFF667085),
            ),
          ),
        ),
        ...children,
      ],
    );
  }
}

class NotificationBadge extends StatelessWidget {
  final int count;
  final Widget child;

  const NotificationBadge({
    super.key,
    required this.count,
    required this.child,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        child,
        if (count > 0)
          Positioned(
            right: -5,
            top: -5,
            child: Container(
              padding: const EdgeInsets.all(4),
              constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
              decoration: BoxDecoration(
                color: const Color(0xFFD92D20),
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  count > 99 ? '99+' : count.toString(),
                  style: const TextStyle(
                    color: Colors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
