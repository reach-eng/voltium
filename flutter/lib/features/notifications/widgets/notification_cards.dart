import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

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
    final colors = AppColors.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Material(
        color: isRead ? colors.surface : colors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.md),
          child: Container(
            padding: Spacing.paddingMd,
            decoration: BoxDecoration(
              border: Border(
                left: BorderSide(
                  color: _getColor(context),
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
                    color: _getColor(context).withValues(alpha: 0.1),
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    _getIcon(),
                    color: _getColor(context),
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
                              style: GoogleFonts.plusJakartaSans(
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
                              style: GoogleFonts.plusJakartaSans(
                                color: colors.onSurfaceVariant,
                                fontSize: 11,
                              ),
                            ),
                        ],
                      ),
                      const SizedBox(height: 4),
                      Text(
                        message,
                        style: GoogleFonts.plusJakartaSans(
                          color: colors.onSurfaceVariant,
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
                      color: AppColors.primary,
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

  Color _getColor(BuildContext context) {
    switch (type) {
      case NotificationType.ride:
        return AppColors.primary;
      case NotificationType.payment:
        return AppColors.success;
      case NotificationType.promo:
        return AppColors.warningDark;
      case NotificationType.alert:
        return AppColors.error;
      case NotificationType.system:
        return AppColors.of(context).onSurfaceMuted;
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
        padding: Spacing.paddingSm,
        decoration: BoxDecoration(
          color: _getColor(context).withValues(alpha: 0.1),
          borderRadius: BorderRadius.circular(AppRadius.sm),
        ),
        child: Icon(_getIcon(), color: _getColor(context), size: 20),
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

  Color _getColor(BuildContext context) {
    switch (type) {
      case NotificationType.ride:
        return AppColors.primary;
      case NotificationType.payment:
        return AppColors.success;
      case NotificationType.promo:
        return AppColors.warningDark;
      case NotificationType.alert:
        return AppColors.error;
      case NotificationType.system:
        return AppColors.of(context).onSurfaceMuted;
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
            style: AppTypography.bodyMedium
                .copyWith(fontWeight: FontWeight.w600)
                .copyWith(color: AppColors.of(context).onSurfaceMuted),
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
              padding: Spacing.paddingXs,
              constraints: const BoxConstraints(minWidth: 20, minHeight: 20),
              decoration: BoxDecoration(
                color: AppColors.error,
                borderRadius: BorderRadius.circular(10),
              ),
              child: Center(
                child: Text(
                  count > 99 ? '99+' : count.toString(),
                  style: AppTypography.labelSmall
                      .copyWith(fontSize: 10)
                      .copyWith(color: Colors.white),
                ),
              ),
            ),
          ),
      ],
    );
  }
}
