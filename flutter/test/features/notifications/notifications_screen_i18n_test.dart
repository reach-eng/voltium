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
import 'package:voltium_rider/gen/app_localizations_hi.dart';
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

  group('NotificationsScreen — i18n Localization (PR-N1)', () {
    testWidgets('Tab labels are English when locale is en', (tester) async {
      await tester.pumpWidget(harness(const Locale('en'), []));
      await tester.pumpAndSettle();

      expect(find.text('All'), findsOneWidget);
      expect(find.text('Payments'), findsOneWidget);
      expect(find.text('KYC'), findsOneWidget);
      expect(find.text('Maintenance'), findsOneWidget);
      expect(find.text('Announcements'), findsOneWidget);
    });

    testWidgets('Tab labels are Hindi when locale is hi', (tester) async {
      await tester.pumpWidget(harness(const Locale('hi'), []));
      await tester.pumpAndSettle();

      expect(find.text('सभी'), findsOneWidget);
      expect(find.text('भुगतान'), findsOneWidget);
      expect(find.text('केवाईसी'), findsOneWidget);
      expect(find.text('रखरखाव'), findsOneWidget);
      expect(find.text('घोषणाएँ'), findsOneWidget);
    });

    testWidgets('Empty state title and body are localized in Hindi', (tester) async {
      await tester.pumpWidget(harness(const Locale('hi'), []));
      await tester.pumpAndSettle();

      // tab=All by default
      expect(find.text('अभी कोई सूचना नहीं'), findsOneWidget);
      expect(find.text('आप पूरी तरह अप-टू-डेट हैं!'), findsOneWidget);
    });

    testWidgets('Delete dialog title and content are localized in Hindi', (tester) async {
      final notif = AppNotification(
        id: 'notif-test-1',
        title: 'Payment Received',
        message: '₹500 added',
        type: AppNotificationType.paymentReceived,
        createdAt: DateTime.now().subtract(const Duration(minutes: 5)),
        isRead: false,
      );

      await tester.pumpWidget(harness(const Locale('hi'), [notif]));
      await tester.pumpAndSettle();

      // Swipe dismissible to trigger confirm dialog
      await tester.drag(find.byType(Dismissible), const Offset(-500, 0));
      await tester.pumpAndSettle();

      expect(find.text('सूचना हटाएं'), findsOneWidget);
      expect(find.text('सभी पढ़ी गई सूचनाएँ हटाएँ? इसे वापस नहीं किया जा सकता。'), findsNothing);
      expect(find.text(AppLocalizationsHi().txtareYouSureYouWantToDeleteThisNotification), findsOneWidget);
    });
  });
}