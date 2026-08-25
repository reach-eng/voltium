import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/models/notification_model.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/fluid_list_wrapper.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/utils/toast.dart';

import 'notification_preferences_screen.dart';

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
        // AUDIT FIX (T-110): prefer structured fields where they exist. The
        // AppNotificationType enum has NO dedicated KYC value (server
        // sends KYC items as `system`), so keyword matching on the title
        // is unavoidable here. LIMITATION: this only matches
        // English-language titles; localized titles will not match.
        // TODO(server): add `category` to the AppNotification payload so
        // this filter becomes structured and locale-independent.
        return all.where((n) {
          if (n.type != AppNotificationType.system) return false;
          final t = n.title.toLowerCase();
          return t.contains('kyc') ||
              t.contains('verification') ||
              t.contains('document');
        }).toList();
      case NotificationTab.maintenance:
        // AUDIT FIX (T-110): use the structured `vehicle` type when present and
        // fall back to system-type keywords only for legacy records.
        // Same English-title limitation as the KYC tab above.
        // TODO(server): add `category` to the AppNotification payload.
        return all.where((n) {
          if (n.type == AppNotificationType.vehicle) return true;
          if (n.type != AppNotificationType.system) return false;
          final t = n.title.toLowerCase();
          return t.contains('service') || t.contains('maintenance');
        }).toList();
      case NotificationTab.announcements:
        // AUDIT FIX: promo-only. System items stay in All / their own
        // category tabs — previously every `system` notification was
        // duplicated into Announcements.
        return all
            .where(
              (n) =>
                  n.type == AppNotificationType.promo ||
                  n.type == AppNotificationType.promotion,
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

  /// AUDIT FIX: bulk clear-read is destructive — require confirmation
  /// (parity with single-item delete). The previously-unused
  /// `EngagementState state` parameter was dropped.
  Future<void> _clearReadNotifications() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: AppColors.of(context).surface,
        title: Text(AppLocalizations.of(context)!.txtclearReadNotifications),
        content: Text(
          AppLocalizations.of(context)!.txtdeleteAllReadNotificationsConfirm,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: Text(AppLocalizations.of(context)!.txtcancel),
          ),
          FilledButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(AppLocalizations.of(context)!.txtdelete),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
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
          final filtered = _getFilteredNotifications(notifications);
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
                      // AUDIT FIX: RefreshIndicator now wraps the empty
                      // state too, so pull-to-refresh works when the
                      // list is empty or a refresh previously failed.
                      child: RefreshIndicator(
                        color: AppColors.primary,
                        onRefresh: () async => ref
                            .read(engagementProvider.notifier)
                            .initEngagementData(),
                        child: filtered.isEmpty
                            ? LayoutBuilder(
                                builder: (context, constraints) =>
                                    SingleChildScrollView(
                                  physics:
                                      const AlwaysScrollableScrollPhysics(),
                                  child: SizedBox(
                                    height: constraints.maxHeight,
                                    child: _buildEmptyState(),
                                  ),
                                ),
                              )
                            : ListView.builder(
                                addRepaintBoundaries: true,
                                addAutomaticKeepAlives: false,
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
                                          final confirmed =
                                              await showDialog<bool>(
                                            context: context,
                                            builder: (ctx) => AlertDialog(
                                              backgroundColor: colors.surface,
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
                                                  // LANGUAGE-AUDIT (2026-08-16)
                                                  // #5: hardcoded English
                                                  // button labels. Localised via
                                                  // existing `txtcancel` /
                                                  // `txtdelete` ARB keys.
                                                  child: Text(
                                                      AppLocalizations.of(
                                                              context)!
                                                          .txtcancel),
                                                ),
                                                FilledButton(
                                                  onPressed: () =>
                                                      Navigator.of(ctx)
                                                          .pop(true),
                                                  child: Text(
                                                      AppLocalizations.of(
                                                              context)!
                                                          .txtdelete),
                                                ),
                                              ],
                                            ),
                                          );
                                          if (confirmed != true) return false;
                                          // PR-VER-2026-08-06 (SUPPORT_NOTIFICATIONS
                                          // P0-5): the delete used to be
                                          // local-only (setState + removeWhere) —
                                          // the row came back on the next
                                          // refresh. Delete server-side and only
                                          // dismiss on success.
                                          final ok = await ref
                                              .read(engagementProvider.notifier)
                                              .deleteNotification(
                                                  filtered[index].id);
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
                                            AppLocalizations.of(context)!
                                                .txtnotificationDeleted,
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

  /// AUDIT FIX: shared header icon button — 48dp minimum touch target,
  /// Tooltip (which also supplies an accessibility label), circular
  /// ink ripple. Previously ~42dp InkWells with no tooltips/Semantics.
  Widget _headerIconButton({
    required IconData icon,
    required Color iconColor,
    required String tooltip,
    required VoidCallback onTap,
    Key? tapKey,
  }) {
    final colors = AppColors.of(context);
    return Tooltip(
      message: tooltip,
      child: InkWell(
        key: tapKey,
        onTap: onTap,
        customBorder: const CircleBorder(),
        child: Container(
          width: 48,
          height: 48,
          alignment: Alignment.center,
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
          child: Icon(icon, size: 18, color: iconColor),
        ),
      ),
    );
  }

  Widget _buildHeader(
    BuildContext context,
    EngagementState provider,
    int unreadCount,
  ) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              _headerIconButton(
                icon: Icons.arrow_back,
                iconColor: AppColors.of(context).onSurface,
                tooltip: 'Back',
                onTap: () => Navigator.maybePop(context),
              ),
              const SizedBox(width: 16),
              Text(
                AppLocalizations.of(context)?.txtnotifications ??
                    'Notifications',
                style: AppTypography.headingSmall
                    .copyWith(color: AppColors.of(context).onSurface),
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
                _headerIconButton(
                  icon: Icons.delete_sweep,
                  iconColor: AppColors.of(context).onSurfaceVariant,
                  tooltip: 'Clear read',
                  onTap: () => _clearReadNotifications(),
                ),
              if (provider.notifications.any((n) => n.isRead))
                const SizedBox(width: 8),
              if (unreadCount > 0)
                _headerIconButton(
                  tapKey: const Key('markAllReadButton'),
                  icon: Icons.done_all,
                  iconColor: AppColors.primary,
                  tooltip: 'Mark all read',
                  onTap: () => ref
                      .read(engagementProvider.notifier)
                      .markAllNotificationsRead(),
                ),
              if (unreadCount > 0) const SizedBox(width: 8),
              _headerIconButton(
                icon: Icons.settings_outlined,
                iconColor: AppColors.of(context).onSurfaceVariant,
                tooltip: 'Notification settings',
                onTap: () => AppNavigator.push(
                  context,
                  const NotificationPreferencesScreen(),
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
          const SizedBox(height: 24),
          Text(
            'No ${_getTabLabel(_selectedTab).toLowerCase()} notifications',
            style: AppTypography.titleMedium.copyWith(color: colors.onSurface),
          ),
          const SizedBox(height: 8),
          Text(
            "You're all caught up!",
            style: GoogleFonts.plusJakartaSans(
                fontSize: 14, color: colors.onSurfaceVariant),
          ),
        ],
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
    var diff = DateTime.now().difference(dt);
    // AUDIT FIX: future-dated timestamps (clock skew) produced
    // "-5m ago" — clamp at zero.
    if (diff.isNegative) diff = Duration.zero;
    if (diff.inMinutes < 60) return '${diff.inMinutes}m ago';
    if (diff.inHours < 24) return '${diff.inHours}h ago';
    if (diff.inDays < 7) return '${diff.inDays}d ago';
    return '${dt.day}/${dt.month}';
  }
}
