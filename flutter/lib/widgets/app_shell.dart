import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/observability/posthog_service.dart';
import '../core/state/riverpod_providers.dart';
import '../features/dashboard/presentation/screens/active_dashboard_screen.dart';
import '../services/monitoring_service.dart';
import '../utils/app_logger.dart';
import '../features/profile/presentation/screens/profile_screen.dart';
import '../features/support/presentation/screens/support_center_screen.dart';
import '../features/wallet/presentation/screens/wallet_screen.dart';
import 'animated_bottom_nav.dart';
import 'error_boundary.dart';
import 'shell_banners.dart';

/// Shell widget with bottom navigation and screen routing.
///
/// PR-7 (2026-08-21): this used to live in `lib/main.dart`, which forced
/// `lib/app/router.dart` to `import '../main.dart' show AppShell;` — a
/// backwards import direction. The class now sits in the widgets layer
/// where it belongs.
class AppShell extends StatefulWidget {
  const AppShell({super.key});

  @override
  State<AppShell> createState() => _AppShellState();
}

class _AppShellState extends State<AppShell> with WidgetsBindingObserver {
  int _currentIndex = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _prewarmAssets();
      _deferSecondaryInitializations();
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didHaveMemoryPressure() {
    PaintingBinding.instance.imageCache.clear();
    PaintingBinding.instance.imageCache.clearLiveImages();
  }

  void _prewarmAssets() {
    // PR-47 removed assets/images/* from the bundle; only assets/logo.png
    // exists on disk. Precache the real logo — anything else would throw
    // (asset-not-found) every cold start.
    try {
      precacheImage(const AssetImage('assets/logo.png'), context)
          // PR-8 (F-063 — 2026-08-22 deep audit): was an empty
          // `catchError((_) {})` AND an empty `catch (_) {}`
          // around it. A missing asset would have silently
          // broken the AppBar logo with no signal. Now logs the
          // failure so a `flutter pub get` + missing-png issue
          // surfaces in the local log.
          .catchError((Object e) {
        appDebug('AppShell: logo precache failed: $e');
      });
    } catch (e, stack) {
      MonitoringService.logError(e, stack,
          reason: 'AppShell: precacheImage threw synchronously');
    }
  }

  void _deferSecondaryInitializations() {
    Future.microtask(() {
      if (mounted) {
        try {
          // R4.3c-4: SupportProvider is now a Riverpod v3 Notifier. Reach
          // for it via the container rather than the legacy
          // `context.read<SupportProvider>()`.
          ProviderScope.containerOf(context)
              .read(supportProvider.notifier)
              .initSupportData();
        } catch (e, stack) {
          // PR-8 (F-063 — 2026-08-22 deep audit): was `catch (_) {}`.
          // A provider-not-found would have silently killed
          // support-tab init, leaving the rider with a blank
          // tab. Now logs so the failure is visible in
          // monitoring without crashing the AppShell.
          MonitoringService.logError(e, stack,
              reason:
                  'AppShell: deferSecondaryInitializations initSupportData failed');
        }
      }
    });
  }

  /// Each screen is wrapped in ErrorBoundary so a crash in one tab
  /// doesn't take down the entire shell.
  List<Widget> _buildScreens() => <Widget>[
        const ErrorBoundary(child: ActiveDashboardScreen()),
        const ErrorBoundary(child: WalletScreen()),
        const ErrorBoundary(child: SupportCenterScreen()),
        const ErrorBoundary(child: ProfileScreen()),
      ];

  void _refreshTabOnFocus(int index) {
    switch (index) {
      case 1:
        // R4.3c-6: RiderProvider is now a Riverpod v3 Notifier. Use the
        // container-based access path.
        final riderId =
            ProviderScope.containerOf(context).read(riderProvider).riderId;
        if (riderId != null) {
          ProviderScope.containerOf(context)
              .read(walletProvider.notifier)
              .refreshTransactions(riderId: riderId);
        }
        break;
      case 2:
        ProviderScope.containerOf(context)
            .read(supportProvider.notifier)
            .refreshTickets();
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Column(
          children: [
            const SyncBanner(),
            const SuspensionBanner(),
            Expanded(
              child: IndexedStack(
                index: _currentIndex,
                children: _buildScreens(),
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() => _currentIndex = index);
          _refreshTabOnFocus(index);
          MonitoringService.logInfo('Navigation: Switched to tab $index');
          PostHogService.capture('tab_switched', properties: {
            'tab_index': index.toString(),
            'tab_name': ['dashboard', 'wallet', 'support', 'profile'][index],
          });
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
