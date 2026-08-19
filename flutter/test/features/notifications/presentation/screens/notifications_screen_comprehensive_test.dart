import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notification_preferences_screen.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/notification_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/theme/theme_provider.dart';

class _SeededEngagementNotifier extends EngagementNotifier {
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

  final mockNotifications = [
    AppNotification(
      id: 'notif-1',
      title: 'Payment Received',
      message: '₹1500 added to your Voltium wallet.',
      type: AppNotificationType.paymentReceived,
      createdAt: DateTime.now().subtract(const Duration(minutes: 10)),
      isRead: false,
    ),
    AppNotification(
      id: 'notif-2',
      title: 'KYC Verification Approved',
      message: 'Your documents have been verified successfully.',
      type: AppNotificationType.system,
      createdAt: DateTime.now().subtract(const Duration(hours: 2)),
      isRead: false,
    ),
    AppNotification(
      id: 'notif-3',
      title: 'Vehicle Maintenance Scheduled',
      message: 'Free routine checkup available at Hub 4.',
      type: AppNotificationType.system,
      createdAt: DateTime.now().subtract(const Duration(days: 1)),
      isRead: true,
    ),
    AppNotification(
      id: 'notif-4',
      title: 'Monsoon Special Offer',
      message: 'Get 20% cashback on weekly battery swap plans.',
      type: AppNotificationType.promo,
      createdAt: DateTime.now().subtract(const Duration(days: 3)),
      isRead: true,
    ),
  ];

  final mockEngagementState = EngagementState(
    notifications: mockNotifications,
    unreadCount: 2,
  );

  Widget buildTestApp({
    Widget child = const NotificationsScreen(),
    ThemeMode themeMode = ThemeMode.light,
    EngagementState? state,
  }) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        engagementProvider.overrideWith(
          () => _SeededEngagementNotifier(state ?? mockEngagementState),
        ),
      ],
      child: MaterialApp(
        locale: const Locale('en'),
        supportedLocales: LocaleProvider.supportedLocales,
        themeMode: themeMode,
        theme: ThemeData.light(),
        darkTheme: ThemeData.dark(),
        localizationsDelegates: const [
          AppLocalizations.delegate,
          GlobalMaterialLocalizations.delegate,
          GlobalWidgetsLocalizations.delegate,
          GlobalCupertinoLocalizations.delegate,
        ],
        home: child,
      ),
    );
  }

  group('NotificationsScreen - UI, UX & Header Actions', () {
    testWidgets('renders header, unread badge count, and all notification items',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      expect(find.text('Notifications'), findsAtLeastNWidgets(1));
      expect(find.text('2'), findsAtLeastNWidgets(1)); // unread badge

      // Header actions
      expect(find.byKey(const Key('markAllReadButton')), findsOneWidget);
      expect(find.byIcon(Icons.delete_sweep), findsOneWidget);
      expect(find.byIcon(Icons.settings_outlined), findsOneWidget);

      // Notification cards
      expect(find.text('Payment Received'), findsOneWidget);
      expect(find.text('KYC Verification Approved'), findsOneWidget);
      expect(find.text('Vehicle Maintenance Scheduled'), findsOneWidget);
      expect(find.text('Monsoon Special Offer'), findsOneWidget);
    });

    testWidgets('mark all as read marks notifications as read locally',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      final markAllBtn = find.byKey(const Key('markAllReadButton'));
      expect(markAllBtn, findsOneWidget);

      await tester.tap(markAllBtn);
      await tester.pumpAndSettle();

      // Badge disappears when unreadCount is 0
      expect(find.byKey(const Key('markAllReadButton')), findsNothing);
    });

    testWidgets('tapping settings icon navigates to NotificationPreferencesScreen',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      final settingsBtn = find.byIcon(Icons.settings_outlined);
      expect(settingsBtn, findsOneWidget);

      await tester.tap(settingsBtn);
      await tester.pumpAndSettle();

      expect(find.byType(NotificationPreferencesScreen), findsOneWidget);
    });
  });

  group('NotificationsScreen - Tab Filtering & Empty State', () {
    testWidgets('filters notifications by category tab', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      // Tap Payments tab
      await tester.tap(find.text('Payments'));
      await tester.pumpAndSettle();

      expect(find.text('Payment Received'), findsOneWidget);
      expect(find.text('KYC Verification Approved'), findsNothing);

      // Tap KYC tab
      await tester.tap(find.text('KYC'));
      await tester.pumpAndSettle();

      expect(find.text('KYC Verification Approved'), findsOneWidget);
      expect(find.text('Payment Received'), findsNothing);

      // Tap Maintenance tab
      await tester.tap(find.text('Maintenance'));
      await tester.pumpAndSettle();

      expect(find.text('Vehicle Maintenance Scheduled'), findsOneWidget);

      // Tap Announcements tab
      await tester.tap(find.text('Announcements'));
      await tester.pumpAndSettle();

      expect(find.text('Monsoon Special Offer'), findsOneWidget);
    });

    testWidgets('renders empty state when no notifications match tab',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      const emptyState = EngagementState(notifications: [], unreadCount: 0);
      await tester.pumpWidget(buildTestApp(state: emptyState));
      await tester.pumpAndSettle();

      expect(find.text('No all notifications'), findsOneWidget);
      expect(find.text("You're all caught up!"), findsOneWidget);
    });
  });

  group('NotificationsScreen - Dismissible & Dark Mode', () {
    testWidgets('renders cleanly in dark mode without errors', (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(themeMode: ThemeMode.dark));
      await tester.pumpAndSettle();

      expect(find.byType(NotificationsScreen), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('swipe to delete shows confirmation dialog and cancels',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp());
      await tester.pumpAndSettle();

      // Swipe the first notification
      final dismissible = find.byKey(const Key('notif_notif-1'));
      expect(dismissible, findsOneWidget);

      await tester.drag(dismissible, const Offset(-500, 0));
      await tester.pumpAndSettle();

      // Confirm dialog appears
      expect(find.byType(AlertDialog), findsOneWidget);
      expect(find.text('Delete Notification'), findsOneWidget);

      // Tap Cancel
      await tester.tap(find.text('Cancel'));
      await tester.pumpAndSettle();

      // Item is not deleted
      expect(find.text('Payment Received'), findsOneWidget);
    });
  });
}
