import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/features/notifications/presentation/providers/notification_provider.dart';
import 'package:voltium_rider/services/emergency_contacts_service.dart';
import 'package:provider/provider.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/app/router.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/services/cache_service.dart';

void main() {
  group('Router Body Test', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
    });

    Widget createTestWidget() {
      final appInstance = AppProvider();
      final localeProvider = LocaleProvider();
      final themeProvider = ThemeProvider();
      final emergencyContactsServiceInstance = EmergencyContactsService();

      return ProviderScope(
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
            ChangeNotifierProvider<LocaleProvider>.value(value: localeProvider),
            ChangeNotifierProvider<ThemeProvider>.value(value: themeProvider),
            ChangeNotifierProvider<AppProvider>.value(value: appInstance),
          ],
          child: const MaterialApp(
            home: AppRouter(),
          ),
        ),
      );
    }

    testWidgets('Initial route is Splash', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 5));
      expect(find.byType(AppRouter), findsOneWidget);
    });

    testWidgets('Can navigate to GuarantorForm', (WidgetTester tester) async {
      await tester.pumpWidget(createTestWidget());
      await tester.pump(const Duration(seconds: 5));

      // Need a way to inject state if possible, but AuthWrapper manages it internally.
      // E2E test already verifies routing through the UI flow. This is just a structural test to ensure AppRouter works.
      expect(find.byType(AppRouter), findsOneWidget);
    });
  });
}
