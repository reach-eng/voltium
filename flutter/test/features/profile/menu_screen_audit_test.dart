import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/profile/presentation/screens/profile_screen.dart';
import 'package:voltium_rider/features/profile/presentation/screens/profile_detail_screen.dart';
import 'package:voltium_rider/features/profile/presentation/screens/settings_screen.dart';
import 'package:voltium_rider/features/profile/presentation/widgets/profile_widgets.dart';

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

Widget createMenuTestApp({
  required Widget child,
  Locale locale = const Locale('en'),
  ThemeMode themeMode = ThemeMode.light,
  RiderModel? rider,
}) {
  final seededRider = rider ??
      RiderModel(
        id: 'rider-001',
        riderId: 'rider-001',
        name: 'Aditya Kumar',
        phone: '+919876543210',
        email: 'aditya@voltium.io',
        dob: DateTime(1995, 5, 20),
        fatherName: 'Ramesh Kumar',
        motherName: 'Sunita Devi',
        currentAddress: 'Sector 62, Noida, UP',
        emergencyContact: '+919876500000',
        assignedVehicle: 'VLT-EV-101',
        vehicleModel: 'Voltium Flash Pro',
        teamLeader: 'Rajesh Kumar (TL-01)',
        teamLeaderPhone: '+919876599999',
        kycStatus: KycStatus.approved,
        guarantorName: 'Vikram Singh',
        guarantorPhone: '+919876588888',
        guarantorRelation: 'Brother',
        guarantorStatus: GuarantorStatus.verified,
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

  group('Menu Screen (ProfileScreen) Deep Audit Tests', () {
    testWidgets('renders all menu links and rider header in Light Mode',
        (tester) async {
      await tester.pumpWidget(createMenuTestApp(child: const ProfileScreen()));
      await tester.pumpAndSettle();

      expect(find.byType(ProfileScreen), findsOneWidget);
      expect(find.text('Menu'), findsOneWidget);
      expect(find.text('Aditya Kumar'), findsOneWidget);
      expect(find.byKey(const Key('profileMenuLink')), findsOneWidget);
      expect(find.byKey(const Key('myDocumentsLink')), findsOneWidget);
      expect(find.byKey(const Key('rewardsLink')), findsOneWidget);
      expect(find.byKey(const Key('referralLink')), findsOneWidget);
      expect(find.byKey(const Key('workflowHubLink')), findsOneWidget);
      expect(find.byKey(const Key('appSettingsLink')), findsOneWidget);
      expect(find.byKey(const Key('languageLink')), findsOneWidget);
      expect(find.byType(ProfileEmergencySosTile), findsOneWidget);
    });

    testWidgets('renders cleanly in Dark Mode without overflowing',
        (tester) async {
      await tester.pumpWidget(createMenuTestApp(
        themeMode: ThemeMode.dark,
        child: const ProfileScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(ProfileScreen), findsOneWidget);
      expect(find.text('Aditya Kumar'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('renders localized Hindi menu titles and headers',
        (tester) async {
      await tester.pumpWidget(createMenuTestApp(
        locale: const Locale('hi'),
        child: const ProfileScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('मेनू'), findsOneWidget);
      expect(find.text('खाता'), findsOneWidget);
      expect(find.text('प्रोफ़ाइल'), findsOneWidget);
      expect(find.text('मेरे दस्तावेज़'), findsOneWidget);
      expect(find.text('इनाम'), findsOneWidget);
      expect(find.text('रेफ़रल प्रोग्राम'), findsOneWidget);
    });

    testWidgets('tapping Profile link opens ProfileDetailScreen',
        (tester) async {
      await tester.pumpWidget(createMenuTestApp(child: const ProfileScreen()));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('profileMenuLink')));
      await tester.pumpAndSettle();

      expect(find.byType(ProfileDetailScreen), findsOneWidget);
    });
  });

  group('Profile Detail Screen Deep Audit Tests', () {
    testWidgets(
        'renders full rider personal details, vehicle, and guarantor in Light Mode',
        (tester) async {
      await tester.pumpWidget(createMenuTestApp(
        child: const ProfileDetailScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(ProfileDetailScreen), findsOneWidget);
      expect(find.text('Aditya Kumar'), findsAtLeastNWidgets(1));
      expect(find.text('aditya@voltium.io'), findsOneWidget);
      expect(find.text('+919876543210'), findsOneWidget);
      expect(find.text('Ramesh Kumar'), findsOneWidget);
      expect(find.text('Sunita Devi'), findsOneWidget);
      expect(find.text('Sector 62, Noida, UP'), findsOneWidget);
      expect(find.text('+919876500000'), findsOneWidget);
      expect(find.text('VLT-EV-101 · Voltium Flash Pro'), findsOneWidget);
      expect(find.text('Rajesh Kumar (TL-01)'), findsOneWidget);
      expect(find.text('Vikram Singh'), findsOneWidget);
    });

    testWidgets('renders cleanly in Dark Mode and handles back navigation',
        (tester) async {
      await tester.pumpWidget(createMenuTestApp(
        themeMode: ThemeMode.dark,
        child: const ProfileDetailScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.byType(ProfileDetailScreen), findsOneWidget);
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });

    testWidgets(
        'renders localized Hindi personal details in ProfileDetailScreen',
        (tester) async {
      await tester.pumpWidget(createMenuTestApp(
        locale: const Locale('hi'),
        child: const ProfileDetailScreen(),
      ));
      await tester.pumpAndSettle();

      expect(find.text('प्रोफ़ाइल'), findsOneWidget);
      expect(find.text('व्यक्तिगत विवरण'), findsOneWidget);
      expect(find.text('ईमेल पता'), findsOneWidget);
      expect(find.text('फ़ोन'), findsOneWidget);
      expect(find.text('पिता का नाम'), findsOneWidget);
      expect(find.text('माता का नाम'), findsOneWidget);
      expect(find.text('पता'), findsOneWidget);
      expect(find.text('आपातकालीन संपर्क'), findsOneWidget);
    });
  });

  group('Settings Screen Deep Audit Tests', () {
    testWidgets(
        'renders SettingsScreen in Light Mode with all preferences tiles',
        (tester) async {
      await tester.pumpWidget(createMenuTestApp(child: const SettingsScreen()));
      await tester.pumpAndSettle();

      expect(find.byType(SettingsScreen), findsOneWidget);
      expect(find.text('Settings'), findsOneWidget);
      expect(find.byKey(const Key('themeOption')), findsOneWidget);
      expect(find.byKey(const Key('notificationsTile')), findsOneWidget);
    });

    testWidgets('tapping Theme Option opens theme dialog in SettingsScreen',
        (tester) async {
      await tester.pumpWidget(createMenuTestApp(child: const SettingsScreen()));
      await tester.pumpAndSettle();

      await tester.tap(find.byKey(const Key('themeOption')));
      await tester.pumpAndSettle();

      expect(find.byKey(const Key('themeSystemRadio')), findsOneWidget);
      expect(find.byKey(const Key('themeLightRadio')), findsOneWidget);
      expect(find.byKey(const Key('themeDarkRadio')), findsOneWidget);
    });
  });
}
