import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/models/notification_model.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/error_state_widget.dart';
import 'package:voltium_rider/widgets/fluid_list_wrapper.dart';
import 'package:voltium_rider/widgets/illustrated_empty_state.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/utils/toast.dart';

import 'notification_preferences_screen.dart';
import 'package:voltium_rider/features/notifications/data/notification_prefs_service.dart';

import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

enum NotificationTab { all, payments, kyc, maintenance, announcements }

enum NotificationCategory {
  payments,
  kyc,
  maintenance,
  announcements,
  general,
}

/// Normalises any AppNotification into its semantic category.
/// Checks structured payload data first (locale-agnostic), then falls
/// back to notification type and title/body heuristics.
NotificationCategory getNotificationCategory(AppNotification n) {
  final cat = n.data?['category']?.toString().toLowerCase();
  if (cat == 'payment' || cat == 'payments')
    return NotificationCategory.payments;
  if (cat == 'kyc' || cat == 'onboarding') return NotificationCategory.kyc;
  if (cat == 'maintenance' || cat == 'service' || cat == 'vehicle') {
    return NotificationCategory.maintenance;
  }
  if (cat == 'announcements' || cat == 'promo' || cat == 'promotion') {
    return NotificationCategory.announcements;
  }

  switch (n.type) {
    case AppNotificationType.payment:
    case AppNotificationType.paymentReceived:
    case AppNotificationType.paymentSent:
      return NotificationCategory.payments;
    case AppNotificationType.vehicle:
    case AppNotificationType.lowBattery:
      return NotificationCategory.maintenance;
    case AppNotificationType.promotion:
    case AppNotificationType.promo:
      return NotificationCategory.announcements;
    default:
      final title = n.title.toLowerCase();
      final body = n.message.toLowerCase();
      if (title.contains('kyc') ||
          body.contains('kyc') ||
          n.data?['screen'] == 'kyc' ||
          n.data?['action'] == 'kyc') {
        return NotificationCategory.kyc;
      }
      if (title.contains('maintenance') ||
          title.contains('service') ||
          title.contains('battery') ||
          body.contains('maintenance') ||
          body.contains('service')) {
        return NotificationCategory.maintenance;
      }
      return NotificationCategory.general;
  }
}

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

  List<AppNotification> _getFilteredNotifications(
      List<AppNotification> all, NotificationPrefs prefs) {
    // PR-A (N-19/N-20): filter by active user notification preferences.
    // PR-D: prefs is now passed in from the Riverpod provider so both
    // the notifications list and the preferences screen share one
    // source of truth.
    final activeList = all.where((n) {
      final category = getNotificationCategory(n);
      switch (category) {
        case NotificationCategory.payments:
          return prefs.payments;
        case NotificationCategory.kyc:
          return prefs.kyc;
        case NotificationCategory.maintenance:
          return prefs.maintenance;
        case NotificationCategory.announcements:
          return prefs.announcements;
        case NotificationCategory.general:
          return true;
      }
    }).toList();

    switch (_selectedTab) {
      case NotificationTab.all:
        return activeList;
      case NotificationTab.payments:
        if (!prefs.payments) return [];
        return activeList
            .where((n) =>
                getNotificationCategory(n) == NotificationCategory.payments)
            .toList();
      case NotificationTab.kyc:
        if (!prefs.kyc) return [];
        return activeList
            .where(
                (n) => getNotificationCategory(n) == NotificationCategory.kyc)
            .toList();
      case NotificationTab.maintenance:
        if (!prefs.maintenance) return [];
        return activeList
            .where((n) =>
                getNotificationCategory(n) == NotificationCategory.maintenance)
            .toList();
      case NotificationTab.announcements:
        if (!prefs.announcements) return [];
        return activeList
            .where((n) =>
                getNotificationCategory(n) ==
                NotificationCategory.announcements)
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

  void _clearReadNotifications(EngagementState state) {
    ref.read(engagementProvider.notifier).clearReadNotifications();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      body: Consumer(
        builder: (context, ref, _) {
          final engagementState = ref.watch(engagementProvider);
          final notifications = engagementState.notifications;
          // Use the same Riverpod-provided prefs that the preferences
          // screen writes through. While the async value is still
          // loading, fall back to defaults so the first frame already
          // shows the right tabs.
          final asyncPrefs = ref.watch(notificationPrefsProvider);
          final prefs = asyncPrefs.maybeWhen(
            data: (p) => p,
            orElse: () => const NotificationPrefs(),
          );
          final filtered = _getFilteredNotifications(notifications, prefs);
          final unreadCount = notifications.where((n) => !n.isRead).length;

          return Stack(
            children: [
              _buildMeshBackground(),
              SafeArea(
                child: Column(
                  children: [
                    _buildHeader(context, engagementState, unreadCount),
                    _buildTabBar(),
                    Expanded(
                      child: _buildBody(engagementState, filtered, unreadCount),
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
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              AppColors.of(context).iconBackground,
              AppColors.of(context).surfaceBright
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    EngagementState provider,
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
              const SizedBox(width: 16),
              Text(
                'Notifications',
                style: AppTypography.headingSmall
                    .copyWith(color: colors.onSurface),
              ),
              if (unreadCount > 0) ...[
                const SizedBox(width: 8),
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
              if (provider.notifications.any((n) => n.isRead))
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
              if (provider.notifications.any((n) => n.isRead))
                const SizedBox(width: 8),
              if (unreadCount > 0)
                InkWell(
                  key: const Key('markAllReadButton'),
                  onTap: () => ref
                      .read(engagementProvider.notifier)
                      .markAllNotificationsRead(),
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
                    child: const Icon(
                      Icons.done_all,
                      size: 18,
                      color: AppColors.primary,
                    ),
                  ),
                ),
              if (unreadCount > 0) const SizedBox(width: 8),
              InkWell(
                onTap: () async {
                  // The build() below ref.watch'es the prefs
                  // provider, so any save in the preferences screen
                  // will automatically rebuild this list — no
                  // manual refresh needed.
                  await AppNavigator.pushForResult(
                    context,
                    const NotificationPreferencesScreen(),
                  );
                },
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
                      const SizedBox(height: 4),
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
    // AUDIT-2026-09-07 (Phase 5): replaced the custom card+icon
    // empty-state with the shared `IllustratedEmptyState` so all four
    // target screens (history, support, notifications, referrals) ship
    // the same branded empty illustration. The icon mirrors the
    // currently-selected tab so the rider still sees which bucket
    // they're looking at.
    return IllustratedEmptyState(
      icon: _getTabIcon(_selectedTab),
      title: 'No ${_getTabLabel(_selectedTab).toLowerCase()} notifications',
      subtitle: "You're all caught up!",
    );
  }

  // AUDIT-2026-09-07 (Phase 6): extracted the body branch into a
  // method so the error / empty / list paths each get a proper
  // `return` without inlining an IIFE in the parent's `child:` slot.
  // The error path only fires when the provider recorded a fetch
  // failure AND we have no cached notifications to fall back on.
  Widget _buildBody(
    EngagementState engagementState,
    List<AppNotification> filtered,
    int unreadCount,
  ) {
    final colors = AppColors.of(context);
    final notificationsError = engagementState.notificationsError;
    if (notificationsError != null && filtered.isEmpty) {
      return ErrorStateWidget(
        title: "Couldn't load your notifications",
        message: notificationsError,
        onRetry: () => ref
            .read(engagementProvider.notifier)
            .refreshNotifications(),
      );
    }
    if (filtered.isEmpty) return _buildEmptyState();
    return RefreshIndicator(
      color: AppColors.primary,
      onRefresh: () async => ref
          .read(engagementProvider.notifier)
          .initEngagementData(),
      child: ListView.builder(
        addRepaintBoundaries: true,
        addAutomaticKeepAlives: false,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        itemCount: filtered.length,
        itemBuilder: (context, index) {
          return FluidStaggeredItem(
            index: index,
            child: Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Dismissible(
                key: Key('notif_${filtered[index].id}'),
                direction: DismissDirection.endToStart,
                background: Container(
                  alignment: Alignment.centerRight,
                  padding: const EdgeInsets.only(right: 20),
                  decoration: BoxDecoration(
                    color: AppColors.error,
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                  child: const Icon(
                    Icons.delete_outline,
                    color: Colors.white,
                    size: 24,
                  ),
                ),
                confirmDismiss: (direction) async {
                  final confirmed = await showDialog<bool>(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      backgroundColor: colors.surface,
                      title: const Text('Delete Notification'),
                      content: const Text(
                        'Are you sure you want to delete this notification?',
                      ),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.of(ctx).pop(false),
                          child: Text(
                            AppLocalizations.of(context)!.txtcancel,
                          ),
                        ),
                        FilledButton(
                          onPressed: () => Navigator.of(ctx).pop(true),
                          child: Text(
                            AppLocalizations.of(context)!.txtdelete,
                          ),
                        ),
                      ],
                    ),
                  );
                  if (confirmed != true) return false;
                  final ok = await ref
                      .read(engagementProvider.notifier)
                      .deleteNotification(filtered[index].id);
                  if (!ok && context.mounted) {
                    Toast.error(
                      context,
                      AppLocalizations.of(context)
                              ?.txtfailedToDeleteNotification ??
                          'Failed to delete notification',
                    );
                  }
                  return ok;
                },
                onDismissed: (direction) {
                  Toast.info(
                    context,
                    AppLocalizations.of(context)!.txtnotificationDeleted,
                  );
                },
                child: RepaintBoundary(
                  child: _buildNotificationCard(
                    context,
                    filtered[index],
                    engagementState,
                  ),
                ),
              ),
            ),
          );
        },
      ),
    );
  }

  Widget _buildNotificationCard(
      BuildContext context, AppNotification notif, EngagementState provider) {
    final colors = AppColors.of(context);
    final categoryInfo = _getCategoryInfo(context, notif);

    return InkWell(
      key: const Key('notificationCard'),
      onTap: () => ref
          .read(engagementProvider.notifier)
          .markNotificationAsRead(notif.id),
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
                        border: Border.all(color: colors.card, width: 2),
                      ),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 16),
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
                  const SizedBox(height: 4),
                  Text(
                    notif.title,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight:
                          !notif.isRead ? FontWeight.bold : FontWeight.w600,
                      color: colors.onSurface,
                    ),
                  ),
                  const SizedBox(height: 4),
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
        bgColor: colors.successLight,
        label: 'Payment'
      );
    }
    if (title.contains('kyc') ||
        title.contains('verification') ||
        title.contains('document')) {
      return (
        icon: Icons.shield_outlined,
        color: AppColors.accentPurple,
        bgColor: AppColors.accentPurple.withValues(alpha: 0.15),
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
        bgColor: colors.primarySurface,
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
        bgColor: AppColors.accentPurple.withValues(alpha: 0.15),
        label: 'Announcement'
      );
    }
    return (
      icon: Icons.notifications_outlined,
      color: colors.onSurfaceVariant,
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
