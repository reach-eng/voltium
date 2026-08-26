import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/notification_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

class _SeededEngagementNotifier extends EngagementProvider {
  final EngagementState _seed;
  _SeededEngagementNotifier(this._seed);

  @override
  EngagementState build() => _seed;
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() async {
    SharedPreferences.setMockInitialValues({});
    await CacheService().init();
  });

  Widget harness(Locale locale, List<AppNotification> notifications) {
    final state = EngagementState(
      notifications: notifications,
      unreadCount: notifications.where((n) => !n.isRead).length,
    );

    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        engagementProvider.overrideWith(() => _SeededEngagementNotifier(state)),
      ],
      child: MaterialApp(
        locale: locale,
        supportedLocales: const [Locale('en'), Locale('hi')],
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: const NotificationsScreen(),
      ),
    );
  }

  group('NotificationsScreen - Structured Category Routing (PR-N2)', () {
    testWidgets('Hindi-titled KYC notification appears in KYC tab', (tester) async {
      final notif = AppNotification(
        id: 'kyc-1',
        title: 'दस्तावेज़ सत्यापन पूरा हुआ',
        message: 'आप अब वाहन लेने जा सकते हैं',
        type: AppNotificationType.system,
        category: NotificationCategory.kyc,
        createdAt: DateTime.now(),
      );
      await tester.pumpWidget(harness(const Locale('hi'), [notif]));
      await tester.pumpAndSettle();

      // All tab shows the notification
      expect(find.text('दस्तावेज़ सत्यापन पूरा हुआ'), findsOneWidget);

      // Switch to KYC tab ('केवाईसी')
      await tester.tap(find.text('केवाईसी'));
      await tester.pumpAndSettle();

      // Still visible in KYC tab — category routed it correctly without needing English keyword match
      expect(find.text('दस्तावेज़ सत्यापन पूरा हुआ'), findsOneWidget);
    });

    testWidgets('Hindi-titled Maintenance notification appears in Maintenance tab', (tester) async {
      final notif = AppNotification(
        id: 'maint-1',
        title: 'वाहन सेवा की तिथि',
        message: 'कृपया हब पर जाएँ',
        type: AppNotificationType.system,
        category: NotificationCategory.maintenance,
        createdAt: DateTime.now(),
      );
      await tester.pumpWidget(harness(const Locale('hi'), [notif]));
      await tester.pumpAndSettle();

      // Switch to Maintenance tab ('रखरखाव')
      await tester.tap(find.text('रखरखाव'));
      await tester.pumpAndSettle();

      expect(find.text('वाहन सेवा की तिथि'), findsOneWidget);
    });

    testWidgets('Hindi-titled Payment notification renders with Payment category card', (tester) async {
      final notif = AppNotification(
        id: 'pay-1',
        title: '₹500 का टॉप-अप सफल',
        message: 'बटुआ अपडेट किया गया',
        type: AppNotificationType.payment,
        category: NotificationCategory.payment,
        createdAt: DateTime.now(),
      );
      await tester.pumpWidget(harness(const Locale('hi'), [notif]));
      await tester.pumpAndSettle();

      final cardFinder = find.byKey(const Key('notificationCard'));
      expect(cardFinder, findsOneWidget);
      expect(find.text('₹500 का टॉप-अप सफल'), findsOneWidget);
      expect(find.text('PAYMENT'), findsOneWidget);
      expect(find.byIcon(Icons.currency_rupee), findsWidgets);
    });
  });
}