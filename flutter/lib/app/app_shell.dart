import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/active_dashboard_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/wallet_screen.dart';
import 'package:voltium_rider/features/profile/presentation/screens/profile_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:voltium_rider/core/network/connectivity_provider.dart';
import 'package:voltium_rider/features/notifications/presentation/providers/notification_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';
import 'package:voltium_rider/services/monitoring_service.dart';
import 'package:voltium_rider/widgets/animated_bottom_nav.dart';
import 'package:voltium_rider/widgets/shell_banners.dart';
import 'package:voltium_rider/theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
class LazyScreenWrapper extends ConsumerStatefulWidget {
  final Widget child;
  final bool isVisible;

  const LazyScreenWrapper({
    super.key,
    required this.child,
    required this.isVisible,
  });

  @override
  ConsumerState<LazyScreenWrapper> createState() => _LazyScreenWrapperState();
}

class _LazyScreenWrapperState extends ConsumerState<LazyScreenWrapper> {
  bool _initialized = false;

  @override
  void didUpdateWidget(covariant LazyScreenWrapper oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isVisible && !_initialized) {
      setState(() {
        _initialized = true;
      });
    }
  }

  @override
  void initState() {
    super.initState();
    if (widget.isVisible) {
      _initialized = true;
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_initialized) {
      return widget.child;
    }
    return const SizedBox.shrink();
  }
}

class OfflineBanner extends ConsumerWidget {
  const OfflineBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnline = ref.watch(connectivityProvider).isOnline;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      height: isOnline ? 0 : 36,
      width: double.infinity,
      color: AppColors.error,
      clipBehavior: Clip.hardEdge,
      child: const Center(
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.wifi_off, color: Colors.white, size: 16),
              SizedBox(width: 8),
              Text(
                'Offline Mode — Some actions may be limited',
                style: TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 13,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// Shell widget with bottom navigation and screen routing.
class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key});

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  int _currentIndex = 0;
  late final PageController _pageController;

  @override
  void initState() {
    super.initState();
    _pageController = PageController(initialPage: _currentIndex);
  }

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      extendBody: true,
      body: SafeArea(
        bottom: false,
        child: Column(
          children: [
            const OfflineBanner(),
            const SyncBanner(),
            const SuspensionBanner(),
            Expanded(
              child: PageView(
                controller: _pageController,
                onPageChanged: (index) {
                  setState(() => _currentIndex = index);
                  MonitoringService.logInfo(
                      'Navigation: Switched to tab $index');
                },
                children: [
                  LazyScreenWrapper(
                    isVisible: _currentIndex == 0,
                    child: const ActiveDashboardScreen(),
                  ),
                  LazyScreenWrapper(
                    isVisible: _currentIndex == 1,
                    child: const WalletScreen(),
                  ),
                  LazyScreenWrapper(
                    isVisible: _currentIndex == 2,
                    child: const SupportCenterScreen(),
                  ),
                  LazyScreenWrapper(
                    isVisible: _currentIndex == 3,
                    child: const ProfileScreen(),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() => _currentIndex = index);
          _pageController.animateToPage(
            index,
            duration: const Duration(milliseconds: 300),
            curve: Curves.easeInOut,
          );
          MonitoringService.logInfo('Navigation: Switched to tab $index');
        },
        badgeCounts: {
          0: ref.watch(notificationProvider).unreadCount,
          2: ref.watch(supportProvider).tickets.where((t) {
            final s = t.status.toUpperCase();
            return s == 'OPEN' || s == 'PENDING';
          }).length,
        },
        tabKeys: [
          const Key('dashboardTab'),
          const Key('walletTab'),
          const Key('supportTab'),
          const Key('profileTab'),
        ],
      ),
    );
  }
}
