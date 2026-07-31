import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/models/notification_model.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/fluid_list_wrapper.dart';
import 'package:voltium_rider/utils/app_navigator.dart';

import 'notification_preferences_screen.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

enum NotificationTab { all, payments, kyc, maintenance, announcements }

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen>
    with SingleTickerProviderStateMixin {
  NotificationTab _selectedTab = NotificationTab.all;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    PostHogService.capture('notification_opened');
    _tabController =
        TabController(length: NotificationTab.values.length, vsync: this);
    _tabController.addListener(() {
      if (!_tabController.indexIsChanging) {
        setState(() {
          _selectedTab = NotificationTab.values[_tabController.index];
        });
      }
    });
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  List<AppNotification> _getFilteredNotifications(List<AppNotification> all) {
    switch (_selectedTab) {
      case NotificationTab.all:
        return all;
      case NotificationTab.payments:
        return all
            .where(
              (n) =>
                  n.type == AppNotificationType.paymentReceived ||
                  n.type == AppNotificationType.paymentSent,
            )
            .toList();
      case NotificationTab.kyc:
        return all
            .where(
              (n) =>
                  n.type == AppNotificationType.system &&
                  n.title.toLowerCase().contains('kyc'),
            )
            .toList();
      case NotificationTab.maintenance:
        return all
            .where(
              (n) =>
                  n.type == AppNotificationType.system &&
                  (n.title.toLowerCase().contains('service') ||
                      n.title.toLowerCase().contains('maintenance')),
            )
            .toList();
      case NotificationTab.announcements:
        return all
            .where(
              (n) =>
                  n.type == AppNotificationType.promo ||
                  n.type == AppNotificationType.system,
            )
            .toList();
    }
  }

  IconData _getTabIcon(NotificationTab tab) {
    switch (tab) {
      case NotificationTab.all:
        return Icons.notifications_none;
      case NotificationTab.payments:
        return Icons.currency_rupee;
      case NotificationTab.kyc:
        return Icons.shield_outlined;
      case NotificationTab.maintenance:
        return Icons.build_outlined;
      case NotificationTab.announcements:
        return Icons.campaign_outlined;
    }
  }

  String _getTabLabel(NotificationTab tab) {
    switch (tab) {
      case NotificationTab.all:
        return 'All';
      case NotificationTab.payments:
        return 'Payments';
      case NotificationTab.kyc:
        return 'KYC';
      case NotificationTab.maintenance:
        return 'Maintenance';
      case NotificationTab.announcements:
        return 'Announcements';
    }
  }

  void _clearReadNotifications(EngagementProvider provider) {
    setState(() {
      ref.read(engagementProvider).notifications.removeWhere((n) => n.isRead);
    });
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      body: Consumer(
        builder: (context, ref, _) {
          final notifications = ref.read(engagementProvider).notifications;
          final filtered = _getFilteredNotifications(notifications);
          final unreadCount = notifications.where((n) => !n.isRead).length;

          return Stack(
            children: [
              _buildMeshBackground(),
              SafeArea(
                child: Column(
                  children: [
                    _buildHeader(
                        context, ref.read(engagementProvider), unreadCount),
                    _buildTabBar(),
                    Expanded(
                      child: filtered.isEmpty
                          ? _buildEmptyState()
                          : RefreshIndicator(
                              color: AppColors.primary,
                              onRefresh: () async => ref
                                  .read(engagementProvider)
                                  .initEngagementData(),
                              child: ListView.builder(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                  vertical: 12,
                                ),
                                itemCount: filtered.length,
                                itemBuilder: (context, index) {
                                  return FluidStaggeredItem(
                                    index: index,
                                    child: Padding(
                                      padding:
                                          const EdgeInsets.only(bottom: 12),
                                      child: Dismissible(
                                        key: Key('notif_${filtered[index].id}'),
                                        direction: DismissDirection.endToStart,
                                        background: Container(
                                          alignment: Alignment.centerRight,
                                          padding:
                                              const EdgeInsets.only(right: 20),
                                          decoration: BoxDecoration(
                                            color: AppColors.error,
                                            borderRadius: BorderRadius.circular(
                                                AppRadius.lg),
                                          ),
                                          child: const Icon(
                                            Icons.delete_outline,
                                            color: Colors.white,
                                            size: 24,
                                          ),
                                        ),
                                        confirmDismiss: (direction) async {
                                          return await showDialog<bool>(
                                            context: context,
                                            builder: (ctx) => AlertDialog(
                                              title: const Text(
                                                'Delete Notification',
                                              ),
                                              content: const Text(
                                                'Are you sure you want to delete this notification?',
                                              ),
                                              actions: [
                                                TextButton(
                                                  onPressed: () =>
                                                      Navigator.of(ctx)
                                                          .pop(false),
                                                  child: const Text('Cancel'),
                                                ),
                                                FilledButton(
                                                  onPressed: () =>
                                                      Navigator.of(ctx)
                                                          .pop(true),
                                                  child: const Text('Delete'),
                                                ),
                                              ],
                                            ),
                                          );
                                        },
                                        onDismissed: (direction) {
                                          setState(() {
                                            ref
                                                .read(engagementProvider)
                                                .notifications
                                                .removeWhere(
                                                  (n) =>
                                                      n.id ==
                                                      filtered[index].id,
                                                );
                                          });
                                          ScaffoldMessenger.of(context)
                                              .showSnackBar(
                                            const SnackBar(
                                              content:
                                                  Text('Notification deleted'),
                                              duration: Duration(seconds: 2),
                                            ),
                                          );
                                        },
                                        child: _buildNotificationCard(
                                          context,
                                          filtered[index],
                                          ref.read(engagementProvider),
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                            ),
                    ),
                  ],
                ),
              ),
            ],
          );
        },
      ),
    );
  }

  Widget _buildMeshBackground() {
    return Positioned.fill(
      child: Container(
        decoration: const BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.iconBackground, AppColors.surfaceBright],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    EngagementProvider provider,
    int unreadCount,
  ) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              InkWell(
                onTap: () => Navigator.maybePop(context),
                child: Container(
                  padding: const EdgeInsets.all(Spacing.md2),
                  decoration: BoxDecoration(
                    color: colors.card,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.arrow_back,
                    size: 18,
                    color: colors.onSurface,
                  ),
                ),
              ),
              SizedBox(width: 16),
              Text(
                'Notifications',
                style: AppTypography.headingSmall
                    .copyWith(color: colors.onSurface),
              ),
              if (unreadCount > 0) ...[
                SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Text(
                    '$unreadCount',
                    style:
                        AppTypography.labelMedium.copyWith(color: Colors.white),
                  ),
                ),
              ],
            ],
          ),
          Row(
            children: [
              if (ref
                  .read(engagementProvider)
                  .notifications
                  .any((n) => n.isRead))
                InkWell(
                  onTap: () => _clearReadNotifications(provider),
                  child: Container(
                    padding: const EdgeInsets.all(Spacing.md2),
                    decoration: BoxDecoration(
                      color: colors.card,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 10,
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.delete_sweep,
                      size: 18,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ),
              if (ref
                  .read(engagementProvider)
                  .notifications
                  .any((n) => n.isRead))
                const SizedBox(width: 8),
              if (unreadCount > 0)
                InkWell(
                  key: const Key('markAllReadButton'),
                  onTap: () => provider.markAllNotificationsRead(),
                  child: Container(
                    padding: const EdgeInsets.all(Spacing.md2),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 10,
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.done_all,
                      size: 18,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              if (unreadCount > 0) const SizedBox(width: 8),
              InkWell(
                onTap: () => AppNavigator.push(
                  context,
                  const NotificationPreferencesScreen(),
                ),
                child: Container(
                  padding: const EdgeInsets.all(Spacing.md2),
                  decoration: BoxDecoration(
                    color: colors.card,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                      ),
                    ],
                  ),
                  child: Icon(
                    Icons.settings_outlined,
                    size: 18,
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    final colors = AppColors.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: Spacing.paddingXs,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 12,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: NotificationTab.values.asMap().entries.map((entry) {
            final index = entry.key;
            final tab = entry.value;
            final isSelected = _selectedTab == tab;
            return Padding(
              padding: const EdgeInsets.symmetric(horizontal: 2.0),
              child: InkWell(
                onTap: () => _tabController.animateTo(index),
                borderRadius: BorderRadius.circular(AppRadius.md),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(vertical: 10, horizontal: 16),
                  decoration: BoxDecoration(
                    color: isSelected ? AppColors.primary : Colors.transparent,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        _getTabIcon(tab),
                        size: 16,
                        color:
                            isSelected ? Colors.white : colors.onSurfaceVariant,
                      ),
                      SizedBox(height: 4),
                      Text(
                        _getTabLabel(tab),
                        style: AppTypography.labelMedium.copyWith(
                            color: isSelected
                                ? Colors.white
                                : colors.onSurfaceVariant,
                            letterSpacing: 0.3),
                        textAlign: TextAlign.center,
                      ),
                    ],
                  ),
                ),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }

  Widget _buildEmptyState() {
    final colors = AppColors.of(context);
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            height: 80,
            width: 80,
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(AppRadius.radiusModal),
              boxShadow: [
                BoxShadow(
                    color: Colors.black.withValues(alpha: 0.04),
                    blurRadius: 20),
              ],
            ),
            child: Icon(
              _getTabIcon(_selectedTab),
              size: 40,
              color: AppColors.primary.withValues(alpha: 0.15),
            ),
          ),
          SizedBox(height: 24),
          Text(
            'No ${_getTabLabel(_selectedTab).toLowerCase()} notifications',
            style: AppTypography.titleMedium.copyWith(color: colors.onSurface),
          ),
          SizedBox(height: 8),
          Text(
            "You're all caught up!",
            style: GoogleFonts.plusJakartaSans(
                fontSize: 14, color: colors.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _buildNotificationCard(BuildContext context, AppNotification notif,
      EngagementProvider provider) {
    final colors = AppColors.of(context);
    final categoryInfo = _getCategoryInfo(context, notif);

    return InkWell(
      key: const Key('notificationCard'),
      onTap: () => provider.markNotificationAsRead(notif.id),
      child: Container(
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: !notif.isRead
              ? Border.all(
                  color: AppColors.primary.withValues(alpha: 0.1),
                  width: 1.5,
                )
              : null,
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.02),
              blurRadius: 20,
              offset: const Offset(0, 8),
            ),
          ],
        ),
        padding: Spacing.paddingMd,
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                Container(
                  height: 48,
                  width: 48,
                  decoration: BoxDecoration(
                    color: categoryInfo.bgColor,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(
                    categoryInfo.icon,
                    color: categoryInfo.color,
                    size: 22,
                  ),
                ),
                if (!notif.isRead)
                  Positioned(
                    top: 0,
                    right: 0,
                    child: Container(
                      height: 12,
                      width: 12,
                      decoration: BoxDecoration(
                        color: AppColors.primary,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        categoryInfo.label.toUpperCase(),
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 11,
                          fontWeight: FontWeight.w800,
                          color: categoryInfo.color,
                          letterSpacing: 0.5,
                        ),
                      ),
                      Text(
                        _formatTime(notif.createdAt),
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 10,
                          color: colors.onSurfaceMuted,
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 4),
                  Text(
                    notif.title,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight:
                          !notif.isRead ? FontWeight.bold : FontWeight.w600,
                      color: colors.onSurface,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text(
                    notif.message,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      color: colors.onSurfaceVariant,
                      height: 1.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  ({IconData icon, Color color, Color bgColor, String label}) _getCategoryInfo(
    BuildContext context,
    AppNotification notif,
  ) {
    final colors = AppColors.of(context);
    final title = notif.title.toLowerCase();
    if (notif.type == AppNotificationType.paymentReceived ||
        notif.type == AppNotificationType.paymentSent ||
        title.contains('payment') ||
        title.contains('wallet') ||
        title.contains('top') ||
        title.contains('rent')) {
      return (
        icon: Icons.currency_rupee,
        color: AppColors.success,
        bgColor: AppColors.successLight,
        label: 'Payment'
      );
    }
    if (title.contains('kyc') ||
        title.contains('verification') ||
        title.contains('document')) {
      return (
        icon: Icons.shield_outlined,
        color: AppColors.accentPurple,
        bgColor: AppColors.accentPurpleSurface,
        label: 'KYC'
      );
    }
    if (title.contains('service') ||
        title.contains('maintenance') ||
        title.contains('vehicle') ||
        title.contains('battery') ||
        title.contains('swap')) {
      return (
        icon: Icons.build_outlined,
        color: AppColors.primary,
        bgColor: AppColors.primarySurface,
        label: 'Maintenance'
      );
    }
    if (notif.type == AppNotificationType.promo ||
        title.contains('reward') ||
        title.contains('offer') ||
        title.contains('announcement')) {
      return (
        icon: Icons.campaign_outlined,
        color: AppColors.accentPurple,
        bgColor: AppColors.accentPurpleSurface,
        label: 'Announcement'
      );
    }
    return (
      icon: Icons.notifications_outlined,
      color: AppColors.slate500,
      bgColor: colors.iconBackground,
      label: 'General'
    );
  }

  String _formatTime(DateTime dt) {
    final diff = DateTime.now().difference(dt);
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.day}/${dt.month}';
  }
}
