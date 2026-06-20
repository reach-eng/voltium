import 'dart:async';
import 'package:flutter/foundation.dart';

import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_driver/driver_extension.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'gen/app_localizations.dart';
import 'providers/locale_provider.dart';
import 'providers/app_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/rider_provider.dart';
import 'providers/wallet_provider.dart';
import 'providers/support_provider.dart';
import 'providers/engagement_provider.dart';
import 'providers/device_policy_provider.dart';
import 'providers/connectivity_provider.dart';
import 'providers/notification_provider.dart';
import 'services/cache_service.dart';
import 'services/connectivity_service.dart';
import 'services/analytics_service.dart';
import 'services/offline_storage_service.dart';
import 'services/notification_service.dart';
import 'services/fcm_service.dart';
import 'services/monitoring_service.dart';
import 'core/platform/platform_info.dart';
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

import 'package:voltium_rider/utils/app_constants.dart';

bool get isTestModeOverride => AppConstants.isTestModeOverride;
set isTestModeOverride(bool val) => AppConstants.isTestModeOverride = val;

Future<void> main() async {
  if (AppConstants.isTestMode) {
    try {
      enableFlutterDriverExtension();
    } catch (e) {
      debugPrint('Driver extension already enabled or binding initialized: $e');
    }
  }
  WidgetsFlutterBinding.ensureInitialized();

  // Initialize Error Monitoring
  await MonitoringService.initialize();

  // ── Global Error Handler ───────────────────────────────────────────────────
  FlutterError.onError = (details) {
    debugPrint('[FlutterError] ${details.exception}');
    AnalyticsService().trackError('FlutterError', details.exception.toString());
    MonitoringService.logError(
      details.exception,
      details.stack,
      reason: 'FlutterError',
    );
  };

  // ── Custom ErrorWidget Builder (skip in test mode) ─────────────────────────
  bool isTestMode = false;
  assert(() {
    isTestMode = true;
    return true;
  }());
  if (!kIsWeb &&
      !isTestMode &&
      !AppConstants.isTestMode) {
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
                const SizedBox(height: 16),
                const Text('Something went wrong',
                  style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                ),
                const SizedBox(height: 8),
                Text(
                  details.exception.toString(),
                  style: const TextStyle(fontSize: 12, color: Colors.grey),
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

      final appProvider = AppProvider();
      final themeProvider = ThemeProvider();

      if (PlatformInfo.supportsFCM) {
        try {
          await Firebase.initializeApp(
            options: DefaultFirebaseOptions.currentPlatform,
          );
          await FCMService.initialize(
            devicePolicy: appProvider.devicePolicyProvider,
            wallet: appProvider.walletProvider,
            support: appProvider.supportProvider,
            rider: appProvider.riderProvider,
          );
        } catch (e) {
          debugPrint('Failed to initialize Firebase: $e');
        }
      }
      AnalyticsService().track(AnalyticsEvent.appOpened);

      // ── Connect connectivity stream to AppProvider ──────────────────────
      appProvider.connectivityProvider
          .bindConnectivityService(ConnectivityService());

      runApp(
        MultiProvider(
          providers: [
            ChangeNotifierProvider<LocaleProvider>.value(value: localeProvider),
            ChangeNotifierProvider<AppProvider>.value(value: appProvider),
            ChangeNotifierProvider<RiderProvider>.value(
              value: appProvider.riderProvider,
            ),
            ChangeNotifierProvider<WalletProvider>.value(
              value: appProvider.walletProvider,
            ),
            ChangeNotifierProvider<SupportProvider>.value(
              value: appProvider.supportProvider,
            ),
            ChangeNotifierProvider<EngagementProvider>.value(
              value: appProvider.engagementProvider,
            ),
            ChangeNotifierProvider<DevicePolicyProvider>.value(
              value: appProvider.devicePolicyProvider,
            ),
            ChangeNotifierProvider<ConnectivityProvider>.value(
              value: appProvider.connectivityProvider,
            ),
            ChangeNotifierProvider(create: (_) => NotificationProvider()),
            ChangeNotifierProvider<ThemeProvider>.value(value: themeProvider),
          ],
          child: const VoltiumApp(),
        ),
      );
    },
    (error, stackTrace) {
      debugPrint('[ZoneError] $error');
      AnalyticsService().trackError('ZoneError', error.toString());
      MonitoringService.logError(error, stackTrace, reason: 'ZoneError');
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

class _AppShellState extends State<AppShell> {
  int _currentIndex = 0;

  final _screens = <Widget>[
    const ActiveDashboardScreen(),
    const WalletScreen(),
    const SupportCenterScreen(),
    const ProfileScreen(),
  ];

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
                children: _screens,
              ),
            ),
          ],
        ),
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: _currentIndex,
        onTap: (index) {
          setState(() => _currentIndex = index);
          MonitoringService.logInfo('Navigation: Switched to tab $index');
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
