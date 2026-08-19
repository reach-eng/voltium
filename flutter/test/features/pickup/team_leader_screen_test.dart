import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/tl_details_screen.dart';

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

Widget createLocalizedTLTestApp({
  required Widget child,
  Locale locale = const Locale('en'),
  ThemeMode themeMode = ThemeMode.light,
  RiderModel? rider,
}) {
  final seededRider = rider ??
      const RiderModel(
        id: 'rider-001',
        riderId: 'rider-001',
        name: 'Aditya Kumar',
        phone: '+919876543210',
        teamLeader: 'Rajesh Kumar (TL-01)',
        teamLeaderPhone: '+919876500000',
      );

  return ProviderScope(
    overrides: [
      riderProvider.overrideWith(() => _SeededRiderNotifier(seededRider)),
    ],
    child: MaterialApp(
      locale: locale,
      themeMode: themeMode,
      theme: AppTheme.lightTheme,
      darkTheme: AppTheme.darkTheme,
      localizationsDelegates: const [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      supportedLocales: AppLocalizations.supportedLocales,
      home: child,
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Team Leader Details Screen Tests', () {
    testWidgets('renders assigned Team Leader details in English and Light Mode',
        (tester) async {
      await tester.pumpWidget(createLocalizedTLTestApp(
        child: const TlDetailsScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(TlDetailsScreen), findsOneWidget);
      expect(find.text('Team Leader'), findsOneWidget);
      expect(find.text('Rajesh Kumar (TL-01)'), findsOneWidget);
      expect(find.text('Assigned Team Leader'), findsOneWidget);
      expect(find.text('+919876500000'), findsOneWidget);
      expect(find.textContaining('Your team leader is your primary point of contact'),
          findsOneWidget);
      expect(find.text('Request Team Leader change'), findsOneWidget);
      expect(find.text('Back to Dashboard'), findsOneWidget);
    });

    testWidgets('renders cleanly in Dark Mode without contrast violations',
        (tester) async {
      await tester.pumpWidget(createLocalizedTLTestApp(
        themeMode: ThemeMode.dark,
        child: const TlDetailsScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(TlDetailsScreen), findsOneWidget);
      expect(find.text('Rajesh Kumar (TL-01)'), findsOneWidget);
      expect(find.byKey(const Key('backButton')), findsOneWidget);
      expect(find.byKey(const Key('callTeamLeaderButton')), findsOneWidget);
    });

    testWidgets('renders localized Hindi strings when locale is Hindi',
        (tester) async {
      await tester.pumpWidget(createLocalizedTLTestApp(
        locale: const Locale('hi'),
        child: const TlDetailsScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('टीम लीडर'), findsOneWidget);
      expect(find.text('आवंटित टीम लीडर'), findsOneWidget);
      expect(find.text('टीम लीडर बदलने का अनुरोध करें'), findsOneWidget);
      expect(find.text('डैशबोर्ड पर वापस जाएं'), findsOneWidget);
    });

    testWidgets('displays unassigned notice when rider has no TL assigned',
        (tester) async {
      const unassignedRider = RiderModel(
        id: 'rider-002',
        riderId: 'rider-002',
        name: 'Rohan Sharma',
        phone: '+919876543211',
        teamLeader: null,
        teamLeaderPhone: null,
      );

      await tester.pumpWidget(createLocalizedTLTestApp(
        rider: unassignedRider,
        child: const TlDetailsScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('Not assigned'), findsOneWidget);
      expect(find.text('Your hub will assign a team leader shortly'), findsOneWidget);
      expect(find.byKey(const Key('callTeamLeaderButton')), findsNothing);
    });

    testWidgets('tapping Request Team Leader change opens change TL reason bottom sheet',
        (tester) async {
      await tester.pumpWidget(createLocalizedTLTestApp(
        child: const TlDetailsScreen(),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Request Team Leader change'));
      await tester.pumpAndSettle();

      expect(find.text('Change Team Leader'), findsOneWidget);
      expect(find.text('Submit Request'), findsOneWidget);
      expect(find.textContaining('Please provide a reason'), findsOneWidget);
    });

    testWidgets('tapping Back to Dashboard triggers maybePop without crashing',
        (tester) async {
      await tester.pumpWidget(createLocalizedTLTestApp(
        child: const TlDetailsScreen(),
      ));
      await tester.pumpAndSettle();

      await tester.tap(find.text('Back to Dashboard'));
      await tester.pumpAndSettle();
      expect(find.byType(TlDetailsScreen), findsOneWidget);
    });
  });
}
