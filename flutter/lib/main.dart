import 'dart:async';
import 'package:flutter/foundation.dart';

import 'package:flutter/material.dart';
// ignore: depend_on_referenced_packages
import 'package:flutter_driver/driver_extension.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:intl/intl.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'gen/app_localizations.dart';
import 'core/localization/locale_provider.dart';
import 'core/state/riverpod_providers.dart';
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
import 'app/router.dart';
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

Future<void> main() async {
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

  // Parallelize independent startup initializations to cut app cold-boot latency.
  // LANGUAGE-AUDIT (2026-08-16) #1: `Intl.defaultLocale` is set later in
  // `VoltiumApp.build()` via a `ref.listen(localeProvider, ...)` so it
  // follows the rider's chosen language (en_IN / hi_IN). Removing the
  // eager `Intl.defaultLocale = 'en_IN'` here means the very first
  // frame uses the same locale the system reports, then settles to
  // the rider's choice as soon as `LocaleNotifier.build()` runs.
  await Future.wait([
    initializeDateFormatting('en_IN', null),
    initializeDateFormatting('hi_IN', null),
    MonitoringService.initialize(),
    PostHogService.initialize(),
  ]);
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
      // ── Initialize services in parallel ─────────────────────────────────
      await Future.wait([
        CacheService().init(),
        if (!kIsWeb) OfflineStorageService().init().catchError((_) {}),
        NotificationService().init(),
        ConnectivityService().init(),
      ]);

      // PR-3 (2026-08-21): dropped the AppProvider shim. FCM init needs
      // the notifier instances *before* the UI ProviderScope is created
      // (we wire FCMService before runApp). Build a throwaway
      // ProviderContainer for that. The notifiers it constructs are
      // independent of the main ProviderScope's notifiers, but state
      // converges through the server: FCMService hands incoming
      // commands off to /api endpoints, and the UI's own notifiers fetch
      // the resulting state on the next refresh. The one exception is
      // `devicePolicyProvider` which FCMService mutates directly for
      // ADMIN_LOCK — to keep that path consistent, the UI's
      // ProviderScope also gets the same container so it sees the same
      // notifier instance (see below).
      final preAppContainer = ProviderContainer();

      if (PlatformInfo.supportsFCM) {
        try {
          await Firebase.initializeApp(
            options: DefaultFirebaseOptions.currentPlatform,
          );
          await FCMService.initialize(
            devicePolicy: preAppContainer.read(devicePolicyProvider.notifier),
            wallet: preAppContainer.read(walletProvider.notifier),
            support: preAppContainer.read(supportProvider.notifier),
            rider: preAppContainer.read(riderProvider.notifier),
          );
        } catch (e) {
          appDebug('Failed to initialize Firebase: $e');
        }
      }
      AnalyticsService().track(AnalyticsEvent.appOpened);

      runApp(
        // UncontrolledProviderScope hands a pre-built container to the
        // widget tree. The pre-FCM container is the same one FCMService
        // is wired to, so any state FCM handlers write (notably
        // devicePolicyProvider for ADMIN_LOCK) is visible to widgets
        // without a re-fetch. The additional `overrides` layer below
        // re-registers the theme/locale/etc. notifier factories — those
        // are only consulted when nothing in the parent container has
        // already created them.
        UncontrolledProviderScope(
          container: preAppContainer,
          child: const VoltiumApp(),
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

class VoltiumApp extends ConsumerWidget {
  static bool get isTestMode => AppConstants.isTestMode;
  const VoltiumApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    // R4.3c-1: Locale + Theme are Riverpod v3 Notifiers. Use ref.watch
    // (no longer context.watch<LocaleProvider>() / ThemeProvider()).
    final locale = ref.watch(localeProvider).locale;
    final themeState = ref.watch(themeProvider);
    final themeMode = themeState.themeMode;
    final isDark = themeState.isDarkMode;

    // LANGUAGE-AUDIT (2026-08-16) #1: keep `Intl.defaultLocale` in
    // sync with the rider's chosen language so any future
    // `Intl.message()` / `Intl.plural()` / `Intl.date()` call that
    // omits an explicit locale picks up the correct country variant
    // (en_IN vs hi_IN). Runs every build so the system default is
    // updated at least once at startup and again on every change.
    Intl.defaultLocale = _intlLocaleFor(locale);

    final overlayStyle = SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: isDark ? Brightness.light : Brightness.dark,
      statusBarBrightness: isDark ? Brightness.dark : Brightness.light,
      systemNavigationBarColor:
          isDark ? ThemeColors.dark.surface : ThemeColors.light.surface,
      systemNavigationBarIconBrightness:
          isDark ? Brightness.light : Brightness.dark,
    );

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
        Widget content = child ?? const SizedBox.shrink();
        if (kIsWeb) {
          content = Center(
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 500),
              child: content,
            ),
          );
        }
        return AnnotatedRegion<SystemUiOverlayStyle>(
          value: overlayStyle,
          child: content,
        );
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

/// LANGUAGE-AUDIT (2026-08-16) #1: map a [Locale] to a BCP-47
/// country-tagged locale string for the `intl` package. Falls back to
/// `en_IN` if the language code is unknown (the app currently
/// supports en + hi only).
String _intlLocaleFor(Locale locale) {
  switch (locale.languageCode) {
    case 'hi':
      return 'hi_IN';
    case 'en':
    default:
      return 'en_IN';
  }
}
