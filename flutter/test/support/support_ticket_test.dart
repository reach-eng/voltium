import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/create_ticket_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/ticket_detail_screen.dart';
import 'package:voltium_rider/features/support/domain/entity.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

class _SeededRiderNotifier extends RiderNotifier {
  final RiderModel _seed;
  _SeededRiderNotifier(this._seed);

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );
}

/// Comprehensive Support Feature Widget Tests
void main() {
  Widget buildTestApp({
    required Widget child,
    ThemeMode themeMode = ThemeMode.light,
    RiderModel? mockRider,
  }) {
    return ProviderScope(
      overrides: [
        localeProviderRef.overrideWith(() => LocaleProvider()),
        themeProviderRef.overrideWith(() => ThemeProvider()),
        if (mockRider != null)
          riderProvider.overrideWith(() => _SeededRiderNotifier(mockRider)),
      ],
      child: MaterialApp(
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

  group('Support Center Screen', () {
    testWidgets('support center renders without error', (tester) async {
      await tester.pumpWidget(buildTestApp(child: const SupportCenterScreen()));
      await tester.pump(const Duration(seconds: 1));
      expect(find.byType(SupportCenterScreen), findsAtLeastNWidgets(1));
    });

    testWidgets('support center shows support categories or options',
        (tester) async {
      await tester.pumpWidget(buildTestApp(child: const SupportCenterScreen()));
      await tester.pump(const Duration(seconds: 1));

      final hasListTile = find.byType(ListTile).evaluate().isNotEmpty;
      final hasCard = find.byType(Card).evaluate().isNotEmpty;
      final hasText = find.byType(Text).evaluate().isNotEmpty;

      expect(hasListTile || hasCard || hasText, isTrue);
    });

    testWidgets('displays team leader phone if rider has assigned TL',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      const mockRider = RiderModel(
        id: 'rider-123',
        riderId: 'R-123',
        name: 'John Rider',
        phone: '+919999999999',
        teamLeader: 'Arun Kumar',
        teamLeaderPhone: '+919876543210',
        emergencyContact: '+919111111111',
      );

      await tester.pumpWidget(buildTestApp(
        child: const SupportCenterScreen(),
        mockRider: mockRider,
      ));
      await tester.pumpAndSettle();

      expect(find.text('Arun Kumar'), findsAtLeastNWidgets(1));
      expect(find.text('Your Team Leader'), findsAtLeastNWidgets(1));
    });

    testWidgets('support center renders smoothly in dark mode', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: const SupportCenterScreen(),
        themeMode: ThemeMode.dark,
      ));
      await tester.pump(const Duration(milliseconds: 500));
      expect(find.byType(SupportCenterScreen), findsAtLeastNWidgets(1));
      expect(tester.takeException(), isNull);
    });
  });

  group('Create Ticket Screen', () {
    testWidgets('create ticket form renders form fields and attachment picker',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(child: const CreateTicketScreen()));
      await tester.pumpAndSettle();

      expect(find.text('Create Ticket'), findsAtLeastNWidgets(1));
      expect(find.text('Category'), findsAtLeastNWidgets(1));
      expect(find.text('Subject'), findsAtLeastNWidgets(1));
      expect(find.text('Message'), findsAtLeastNWidgets(1));
      expect(find.byKey(const Key('ticketAttachmentPicker')),
          findsAtLeastNWidgets(1));
      expect(find.text('Submit Ticket'), findsAtLeastNWidgets(1));
    });

    testWidgets('validates subject and message minimum lengths',
        (tester) async {
      tester.view.physicalSize = const Size(800, 1600);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestApp(child: const CreateTicketScreen()));
      await tester.pumpAndSettle();

      // Tap submit button without inputting text
      await tester.tap(find.text('Submit Ticket'));
      await tester.pumpAndSettle();

      expect(find.text('Please enter a subject'), findsAtLeastNWidgets(1));
      expect(find.text('Please enter a message'), findsAtLeastNWidgets(1));
    });

    testWidgets('create ticket renders cleanly in dark mode', (tester) async {
      await tester.pumpWidget(buildTestApp(
        child: const CreateTicketScreen(),
        themeMode: ThemeMode.dark,
      ));
      await tester.pumpAndSettle();
      expect(find.byType(CreateTicketScreen), findsAtLeastNWidgets(1));
      expect(tester.takeException(), isNull);
    });
  });

  group('Ticket Detail Screen', () {
    testWidgets('renders ticket details and messages timeline', (tester) async {
      final now = DateTime.now();
      final ticket = TicketEntity(
        id: '1',
        ticketId: 'TCK-1001',
        subject: 'Battery not charging properly',
        message: 'The battery indicator shows 20% even after 4 hours on plug.',
        category: 'BATTERY',
        status: TicketStatus.inProgress,
        createdAt: now.subtract(const Duration(hours: 3)),
        updatedAt: now.subtract(const Duration(hours: 1)),
        messages: [
          TicketMessageEntity(
            id: 'm1',
            message: 'Hello, our team is looking into your battery telemetry.',
            senderType: 'ADMIN',
            createdAt: now.subtract(const Duration(hours: 2)),
          ),
          TicketMessageEntity(
            id: 'm2',
            message: 'Thank you for checking, let me know if you need logs.',
            senderType: 'RIDER',
            createdAt: now.subtract(const Duration(hours: 1)),
          ),
        ],
      );

      await tester.pumpWidget(buildTestApp(
        child: TicketDetailScreen(ticket: ticket),
      ));
      await tester.pumpAndSettle();

      expect(find.text('TCK-1001'), findsAtLeastNWidgets(1));
      expect(find.text('Issue: Battery not charging properly'),
          findsAtLeastNWidgets(1));
      expect(find.text('Support Team'), findsAtLeastNWidgets(1));
      expect(find.text('You'), findsAtLeastNWidgets(1));
    });
  });
}
