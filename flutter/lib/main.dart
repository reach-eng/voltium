import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:provider/provider.dart';

import 'gen/app_localizations.dart';
import 'providers/locale_provider.dart';
import 'providers/app_provider.dart';
import 'providers/theme_provider.dart';
import 'providers/notification_provider.dart';
import 'services/cache_service.dart';
import 'services/connectivity_service.dart';
import 'services/analytics_service.dart';
import 'services/offline_storage_service.dart';
import 'services/notification_service.dart';
import 'theme/app_theme.dart';
import 'screens/active_dashboard_screen.dart';
import 'screens/wallet_screen.dart';
import 'screens/profile_screen.dart';
import 'screens/support_center_screen.dart';
import 'screens/auth_wrapper.dart';
import 'widgets/shell_banners.dart';
import 'widgets/animated_bottom_nav.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // ── Global Error Handler ───────────────────────────────────────────────────
  FlutterError.onError = (details) {
    debugPrint('[FlutterError] ${details.exception}');
    AnalyticsService().trackError('FlutterError', details.exception.toString());
  };

  // ── Initialize services ───────────────────────────────────────────────────
  await CacheService().init();
  await OfflineStorageService().init();
  await NotificationService().init();
  await ConnectivityService().init();
  AnalyticsService().track(AnalyticsEvent.appOpened);

  // ── Determine initial locale from persisted preference ─────────────────────
  final savedLocale = CacheService().getLocale();

  // ── Create providers ──────────────────────────────────────────────────────
  final localeProvider = LocaleProvider();
  if (savedLocale == 'hi') {
    localeProvider.setHindi();
  }

  final appProvider = AppProvider();
  final themeProvider = ThemeProvider();

  // ── Connect connectivity stream to AppProvider ────────────────────────────
  ConnectivityService().onConnectivityChanged.listen(appProvider.setOnline);

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider<LocaleProvider>.value(value: localeProvider),
        ChangeNotifierProvider<AppProvider>.value(value: appProvider),
        ChangeNotifierProvider<ThemeProvider>.value(value: themeProvider),
        ChangeNotifierProvider(create: (_) => NotificationProvider()),
      ],
      child: const VoltFleetApp(),
    ),
  );
}

class VoltFleetApp extends StatelessWidget {
  const VoltFleetApp({super.key});

  @override
  Widget build(BuildContext context) {
    final locale = context.watch<LocaleProvider>().locale;
    final themeMode = context.watch<ThemeProvider>().themeMode;

    return MaterialApp(
      title: 'VoltFleet',

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
      home: const AuthWrapper(),
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
  void initState() {
    super.initState();
    // Trigger the stale-while-revalidate flow on first frame.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppProvider>().init();
    });
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

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
      bottomNavigationBar: AnimatedBottomNav(
        currentIndex: _currentIndex,
        onTap: (index) => setState(() => _currentIndex = index),
        itemKeys: [
          const Key('dashboardTab'),
          const Key('walletTab'),
          const Key('supportTab'),
          const Key('profileTab'),
        ],
        items: [
          BottomNavItem(
            icon: Icons.home_outlined,
            selectedIcon: Icons.home,
            label: l10n.nav_home,
          ),
          BottomNavItem(
            icon: Icons.account_balance_wallet_outlined,
            selectedIcon: Icons.account_balance_wallet,
            label: l10n.nav_wallet,
          ),
          BottomNavItem(
            icon: Icons.support_agent_outlined,
            selectedIcon: Icons.support_agent,
            label: l10n.nav_support,
          ),
          const BottomNavItem(
            icon: Icons.person_outline,
            selectedIcon: Icons.person,
            label: 'Profile',
          ),
        ],
      ),
    );
  }
}
