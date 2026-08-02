import 'dart:async';
import 'package:flutter/foundation.dart';

import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_driver/driver_extension.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:provider/provider.dart';

import 'gen/app_localizations.dart';
import 'core/localization/locale_provider.dart';
import 'core/state/app_provider.dart';
import 'theme/theme_provider.dart';
import 'core/state/rider_provider.dart';
import 'features/wallet/presentation/providers/wallet_provider.dart';
import 'features/support/presentation/providers/support_provider.dart';
import 'features/dashboard/presentation/providers/engagement_provider.dart';
import 'features/device_compliance/presentation/providers/device_policy_provider.dart';
import 'core/network/connectivity_provider.dart';
import 'features/notifications/presentation/providers/notification_provider.dart';
import 'core/state/riverpod_providers.dart';
import 'services/emergency_contacts_service.dart';
import 'services/cache_service.dart';
import 'services/connectivity_service.dart';
import 'services/analytics_service.dart';
import 'services/offline_storage_service.dart';
import 'services/notification_service.dart';
import 'services/fcm_service.dart';
import 'services/monitoring_service.dart';
import 'core/platform/platform_info.dart';
import 'core/navigation/focus_observer.dart';
import 'package:firebase_core/firebase_core.dart';
import 'firebase_options.dart';
import 'theme/app_theme.dart';
import 'features/dashboard/presentation/screens/active_dashboard_screen.dart';
import 'features/wallet/presentation/screens/wallet_screen.dart';
import 'features/profile/presentation/screens/profile_screen.dart';
import 'features/support/presentation/screens/support_center_screen.dart';
import 'app/router.dart';
import 'widgets/shell_banners.dart';
import 'widgets/animated_bottom_nav.dart';
import 'widgets/error_boundary.dart';
import 'widgets/overlay_manager.dart';
import 'core/observability/posthog_service.dart';
import 'package:posthog_flutter/posthog_flutter.dart';

import 'package:voltium_rider/utils/app_constants.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'utils/app_logger.dart';

bool get isTestModeOverride => AppConstants.isTestModeOverride;
set isTestModeOverride(bool val) => AppConstants.isTestModeOverride = val;

final FocusObserver focusObserver = FocusObserver((route) {
  // Navigation is state-machine driven (setState), not Navigator-based.
  // Tab-switch refresh is handled by AppShell.onTap.
  // Reserved for future modal/push screen scenarios.
});

Future<void> main({AppProvider? injectedAppProvider}) async {
  if (AppConstants.isTestMode) {
    try {
      enableFlutterDriverExtension();
    } catch (e) {
      appDebug('Driver extension already enabled or binding initialized: $e');
    }
  }
  WidgetsFlutterBinding.ensureInitialized();

  // Cap image memory cache at 50 MB and 100 items to prevent OOM on lower-end devices
  PaintingBinding.instance.imageCache.maximumSizeBytes = 50 * 1024 * 1024;
  PaintingBinding.instance.imageCache.maximumSize = 100;

  // Pre-bundle Google Fonts from asset package to eliminate startup network requests and layout shift
  GoogleFonts.config.allowRuntimeFetching = false;

  // Parallelize independent startup initializations to cut app cold-boot latency
  await Future.wait([
    initializeDateFormatting('en_IN', null),
    MonitoringService.initialize(),
    PostHogService.initialize(),
  ]);
  Intl.defaultLocale = 'en_IN';
  // ── Global Error Handler ───────────────────────────────────────────────────
  FlutterError.onError = (details) {
    appDebug('[FlutterError] ${details.exception}');
    AnalyticsService().trackError('FlutterError', details.exception.toString());
    MonitoringService.logError(
      details.exception,
      details.stack,
      reason: 'FlutterError',
    );
    PostHogService.captureError(details.exception, details.stack,
        reason: 'FlutterError');
  };

  // ── Custom ErrorWidget Builder (skip in test mode) ─────────────────────────
  bool isTestMode = false;
  assert(() {
    isTestMode = true;
    return true;
  }());
  if (!kIsWeb && !isTestMode && !AppConstants.isTestMode) {
    ErrorWidget.builder = (FlutterErrorDetails details) {
      AnalyticsService()
          .trackError('ErrorWidget', details.exception.toString());
      return Material(
        color: Colors.white,
        child: Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline,
                  size: 64,
                  color: Colors.red,
                ),
                SizedBox(height: 16),
                Text(
                  'Something went wrong',
                  style: AppTypography.titleMedium,
                ),
                SizedBox(height: 8),
                Text(
                  details.exception.toString(),
                  style: GoogleFonts.plusJakartaSans(
                      fontSize: 12, color: Colors.grey),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                FilledButton(
                  onPressed: () {
                    FlutterError.onError?.call(details);
                  },
                  child: const Text('Reload'),
                ),
              ],
            ),
          ),
        ),
      );
    };
  }

  // ── Zone-based async error handler ────────────────────────────────────────
  runZonedGuarded(
    () async {
      // ── Initialize services ─────────────────────────────────────────────
      await CacheService().init();
      if (!kIsWeb) {
        try {
          await OfflineStorageService().init();
        } catch (_) {
          // Offline storage is optional on platforms that don't support sqflite
        }
      }
      await NotificationService().init();
      await ConnectivityService().init();

      // ── Determine initial locale from persisted preference ──────────────
      final savedLocale = CacheService().getLocale();

      // ── Create providers ────────────────────────────────────────────────
      final localeProvider = LocaleProvider();
      if (savedLocale == 'hi') {
        localeProvider.setHindi();
      }

      final appInstance = injectedAppProvider ?? AppProvider();
      final themeProvider = ThemeProvider();

      if (PlatformInfo.supportsFCM) {
        try {
          await Firebase.initializeApp(
            options: DefaultFirebaseOptions.currentPlatform,
          );
          await FCMService.initialize(
            devicePolicy: appInstance.devicePolicyProvider,
            wallet: appInstance.walletProvider,
            support: appInstance.supportProvider,
            rider: appInstance.riderProvider,
          );
        } catch (e) {
          appDebug('Failed to initialize Firebase: $e');
        }
      }
      AnalyticsService().track(AnalyticsEvent.appOpened);

      // ── Connect connectivity stream to AppProvider ──────────────────────
      appInstance.connectivityProvider
          .bindConnectivityService(ConnectivityService());

      final emergencyContactsServiceInstance = EmergencyContactsService();

      runApp(
        // ProviderScope is the root of Riverpod's dependency injection.
        // Existing ChangeNotifierProviders are bridged via legacy.MultiProvider
        // so both Provider and Riverpod patterns work during migration.
        ProviderScope(
          overrides: [
            appProvider.overrideWith((ref) => appInstance),
            riderProvider.overrideWith((ref) => appInstance.riderProvider),
            walletProvider.overrideWith((ref) => appInstance.walletProvider),
            supportProvider.overrideWith((ref) => appInstance.supportProvider),
            engagementProvider
                .overrideWith((ref) => appInstance.engagementProvider),
            devicePolicyProvider
                .overrideWith((ref) => appInstance.devicePolicyProvider),
            connectivityProvider
                .overrideWith((ref) => appInstance.connectivityProvider),
            localeProviderRef.overrideWith((ref) => localeProvider),
            themeProviderRef.overrideWith((ref) => themeProvider),
            notificationProvider.overrideWith((ref) => NotificationProvider()),
            emergencyContactsService
                .overrideWith((ref) => emergencyContactsServiceInstance),
          ],
          child: MultiProvider(
            providers: [
              ChangeNotifierProvider<LocaleProvider>.value(
                  value: localeProvider),
              ChangeNotifierProvider<AppProvider>.value(value: appInstance),
              ChangeNotifierProvider<RiderProvider>.value(
                value: appInstance.riderProvider,
              ),
              ChangeNotifierProvider<WalletProvider>.value(
                value: appInstance.walletProvider,
              ),
              ChangeNotifierProvider<SupportProvider>.value(
                value: appInstance.supportProvider,
              ),
              ChangeNotifierProvider<EngagementProvider>.value(
                value: appInstance.engagementProvider,
              ),
              ChangeNotifierProvider<DevicePolicyProvider>.value(
                value: appInstance.devicePolicyProvider,
              ),
              ChangeNotifierProvider<ConnectivityProvider>.value(
                value: appInstance.connectivityProvider,
              ),
              ChangeNotifierProvider(create: (_) => NotificationProvider()),
              ChangeNotifierProvider<ThemeProvider>.value(value: themeProvider),
            ],
            child: const VoltiumApp(),
          ),
        ),
      );
    },
    (error, stackTrace) {
      appDebug('[ZoneError] $error');
      AnalyticsService().trackError('ZoneError', error.toString());
      MonitoringService.logError(error, stackTrace, reason: 'ZoneError');
      PostHogService.captureError(error, stackTrace, reason: 'ZoneError');
    },
  );
}

class VoltiumApp extends StatelessWidget {
  static bool get isTestMode => AppConstants.isTestMode;
  const VoltiumApp({super.key});

  @override
  Widget build(BuildContext context) {
    final locale = context.watch<LocaleProvider>().locale;
    final themeMode = context.watch<ThemeProvider>().themeMode;

    return MaterialApp(
      title: 'Voltium',

      // ── Localization ──────────────────────────────────────────────────────
      locale: locale,
      supportedLocales: LocaleProvider.supportedLocales,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],

      // ── Theme ─────────────────────────────────────────────────────────────
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      themeMode: themeMode,

      // ── Responsive Web Wrapper ────────────────────────────────────────────
      builder: (context, child) {
        if (kIsWeb) {
          return Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 500),
              child: child ?? const SizedBox.shrink(),
            ),
          );
        }
        return child ?? const SizedBox.shrink();
      },

      // ── Navigation Observer ───────────────────────────────────────────────
      navigatorObservers: [focusObserver, PosthogObserver()],

      // ── Home ──────────────────────────────────────────────────────────────
      home: const ErrorBoundary(
        child: OverlayManager(
          child: AppRouter(),
        ),
      ),
      debugShowCheckedModeBanner: false,
    );
  }
}

/// Shell widget with bottom navigation and screen routing.
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
    try {
      precacheImage(const AssetImage('assets/images/logo.png'), context)
          .catchError((_) {});
      precacheImage(const AssetImage('assets/images/scooter_hero.png'), context)
          .catchError((_) {});
    } catch (_) {}
  }

  void _deferSecondaryInitializations() {
    Future.microtask(() {
      if (mounted) {
        try {
          final support = context.read<SupportProvider>();
          support.initSupportData();
        } catch (_) {}
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
        final wallet = context.read<WalletProvider>();
        final riderId = context.read<RiderProvider>().riderId;
        if (riderId != null) {
          wallet.refreshTransactions(riderId: riderId);
        }
        break;
      case 2:
        context.read<SupportProvider>().refreshTickets();
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
