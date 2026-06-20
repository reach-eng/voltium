import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:voltium_rider/models/notification_model.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'notification_preferences_screen.dart';

enum NotificationTab { all, payments, kyc, maintenance, announcements }

class SmartNotificationsScreen extends StatefulWidget {
  const SmartNotificationsScreen({super.key});

  @override
  State<SmartNotificationsScreen> createState() =>
      _SmartNotificationsScreenState();
}

class _SmartNotificationsScreenState extends State<SmartNotificationsScreen>
    with SingleTickerProviderStateMixin {
  NotificationTab _selectedTab = NotificationTab.all;
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
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
            .where((n) =>
                n.type == AppNotificationType.paymentReceived ||
                n.type == AppNotificationType.paymentSent,)
            .toList();
      case NotificationTab.kyc:
        return all
            .where((n) =>
                n.type == AppNotificationType.system &&
                n.title.toLowerCase().contains('kyc'),)
            .toList();
      case NotificationTab.maintenance:
        return all
            .where((n) =>
                n.type == AppNotificationType.system &&
                (n.title.toLowerCase().contains('service') ||
                    n.title.toLowerCase().contains('maintenance')),)
            .toList();
      case NotificationTab.announcements:
        return all
            .where((n) =>
                n.type == AppNotificationType.promo ||
                n.type == AppNotificationType.system,)
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

  void _clearReadNotifications(AppProvider provider) {
    setState(() {
      provider.notifications.removeWhere((n) => n.isRead);
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      body: Consumer<AppProvider>(
        builder: (context, provider, _) {
          final notifications = provider.notifications;
          final filtered = _getFilteredNotifications(notifications);
          final unreadCount = notifications.where((n) => !n.isRead).length;

          return Stack(
            children: [
              _buildMeshBackground(),
              SafeArea(
                child: Column(
                  children: [
                    _buildHeader(context, provider, unreadCount),
                    _buildTabBar(),
                    Expanded(
                      child: filtered.isEmpty
                          ? _buildEmptyState()
                          : RefreshIndicator(
                              color: AppColors.primary,
                              onRefresh: () => provider.refreshEngagementData(),
                              child: ListView.builder(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 20, vertical: 12,),
                                itemCount: filtered.length,
                                itemBuilder: (context, index) {
                                  return FadeUpWidget(
                                    delay: index * 50,
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
                                            borderRadius:
                                                BorderRadius.circular(20),
                                          ),
                                          child: const Icon(
                                              Icons.delete_outline,
                                              color: Colors.white,
                                              size: 24,),
                                        ),
                                        confirmDismiss: (direction) async {
                                          return await showDialog<bool>(
                                            context: context,
                                            builder: (ctx) => AlertDialog(
                                              title: const Text('Delete Notification',),
                                              content: const Text('Are you sure you want to delete this notification?',),
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
                                            provider.notifications.removeWhere(
                                                (n) =>
                                                    n.id == filtered[index].id,);
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
                                            filtered[index], provider,),
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
            colors: [AppColors.iconBackground, Color(0xFFF8FAFC)],
          ),
        ),
      ),
    );
  }

  Widget _buildHeader(
      BuildContext context, AppProvider provider, int unreadCount,) {
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
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05), blurRadius: 10,),
                    ],
                  ),
                  child: const Icon(Icons.arrow_back,
                      size: 18, color: Color(0xFF1E293B),),
                ),
              ),
              const SizedBox(width: 16),
              const Text('Notifications',
                style: TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B),),
              ),
              if (unreadCount > 0) ...[
                const SizedBox(width: 8),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Text(
                    '$unreadCount',
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,),
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
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                            color: Colors.black.withValues(alpha: 0.05),
                            blurRadius: 10,),
                      ],
                    ),
                    child: const Icon(Icons.delete_sweep,
                        size: 18, color: AppColors.slate500,),
                  ),
                ),
              if (provider.notifications.any((n) => n.isRead))
                const SizedBox(width: 8),
              if (unreadCount > 0)
                TextButton.icon(
                  key: const Key('markAllReadButton'),
                  onPressed: () => provider.markAllNotificationsRead(),
                  icon: const Icon(Icons.done_all, size: 16),
                  label: const Text('MARK ALL READ',
                      style: TextStyle(
                          fontSize: 10,
                          fontWeight: FontWeight.w900,
                          letterSpacing: 0.5,),),
                  style: TextButton.styleFrom(
                    foregroundColor: AppColors.primary,
                    padding: const EdgeInsets.symmetric(horizontal: 12),
                  ),
                ),
              const SizedBox(width: 4),
              InkWell(
                onTap: () => AppNavigator.push(
                    context, const NotificationPreferencesScreen(),),
                child: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.white,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05), blurRadius: 10,),
                    ],
                  ),
                  child: const Icon(Icons.settings_outlined,
                      size: 18, color: AppColors.slate500,),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTabBar() {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 20),
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
              color: Colors.black.withValues(alpha: 0.04),
              blurRadius: 12,
              offset: const Offset(0, 4),),
        ],
      ),
      child: Row(
        children: NotificationTab.values.asMap().entries.map((entry) {
          final index = entry.key;
          final tab = entry.value;
          final isSelected = _selectedTab == tab;
          return Expanded(
            child: InkWell(
              onTap: () => _tabController.animateTo(index),
              borderRadius: BorderRadius.circular(12),
              child: Container(
                padding:
                    const EdgeInsets.symmetric(vertical: 10, horizontal: 4),
                decoration: BoxDecoration(
                  color:
                      isSelected ? AppColors.primary : Colors.transparent,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      _getTabIcon(tab),
                      size: 16,
                      color:
                          isSelected ? Colors.white : AppColors.slate500,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      _getTabLabel(tab),
                      style: TextStyle(
                        fontSize: 9,
                        fontWeight: FontWeight.w700,
                        color:
                            isSelected ? Colors.white : AppColors.slate500,
                        letterSpacing: 0.3,
                      ),
                      textAlign: TextAlign.center,
                    ),
                  ],
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            height: 80,
            width: 80,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(24),
              boxShadow: [
                BoxShadow(color: Colors.black.withValues(alpha: 0.04), blurRadius: 20),
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
            style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),),
          ),
          const SizedBox(height: 8),
          const Text("You're all caught up!",
              style: TextStyle(fontSize: 14, color: AppColors.slate500),),
        ],
      ),
    );
  }

  Widget _buildNotificationCard(AppNotification notif, AppProvider provider) {
    final categoryInfo = _getCategoryInfo(notif);

    return InkWell(
      key: const Key('smartNotificationCard'),
      onTap: () => provider.markNotificationAsRead(notif.id),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          border: !notif.isRead
              ? Border.all(
                  color: AppColors.primary.withValues(alpha: 0.1), width: 1.5,)
              : null,
          boxShadow: [
            BoxShadow(
                color: Colors.black.withValues(alpha: 0.02),
                blurRadius: 20,
                offset: const Offset(0, 8),),
          ],
        ),
        padding: const EdgeInsets.all(16),
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
                  child: Icon(categoryInfo.icon,
                      color: categoryInfo.color, size: 22,),
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
                        style: TextStyle(
                            fontSize: 9,
                            fontWeight: FontWeight.w900,
                            color: categoryInfo.color,
                            letterSpacing: 0.5,),
                      ),
                      Text(
                        _formatTime(notif.createdAt),
                        style: const TextStyle(
                            fontSize: 10, color: AppColors.slate400,),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notif.title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight:
                          !notif.isRead ? FontWeight.bold : FontWeight.w600,
                      color: const Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    notif.message,
                    style: const TextStyle(
                        fontSize: 12, color: AppColors.slate500, height: 1.4,),
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
      AppNotification notif,) {
    final title = notif.title.toLowerCase();
    if (notif.type == AppNotificationType.paymentReceived ||
        notif.type == AppNotificationType.paymentSent ||
        title.contains('payment') ||
        title.contains('wallet') ||
        title.contains('top') ||
        title.contains('rent')) {
      return (
        icon: Icons.currency_rupee,
        color: const Color(0xFF16A34A),
        bgColor: const Color(0xFFF0FDF4),
        label: 'Payment'
      );
    }
    if (title.contains('kyc') ||
        title.contains('verification') ||
        title.contains('document')) {
      return (
        icon: Icons.shield_outlined,
        color: const Color(0xFF7C3AED),
        bgColor: const Color(0xFFF5F3FF),
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
        color: const Color(0xFF2563EB),
        bgColor: const Color(0xFFEFF6FF),
        label: 'Maintenance'
      );
    }
    if (notif.type == AppNotificationType.promo ||
        title.contains('reward') ||
        title.contains('offer') ||
        title.contains('announcement')) {
      return (
        icon: Icons.campaign_outlined,
        color: const Color(0xFF9333EA),
        bgColor: const Color(0xFFFAF5FF),
        label: 'Announcement'
      );
    }
    return (
      icon: Icons.notifications_outlined,
      color: AppColors.slate500,
      bgColor: AppColors.iconBackground,
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
