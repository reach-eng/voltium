import 'package:flutter/material.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/documents_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';

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

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  RiderModel createTestRider({
    KycStatus kycStatus = KycStatus.approved,
    bool withDocs = true,
  }) {
    return RiderModel(
      id: 'rider-123',
      riderId: 'rider-123',
      phone: '+919876543210',
      name: 'Rahul Sharma',
      kycStatus: kycStatus,
      aadhaarFront: withDocs ? 'https://example.com/aadhaar_f.jpg' : null,
      aadhaarBack: withDocs ? 'https://example.com/aadhaar_b.jpg' : null,
      panCard: withDocs ? 'https://example.com/pan.jpg' : null,
      signature: withDocs ? 'https://example.com/sig.png' : null,
      guarantorAadhaarFront:
          withDocs ? 'https://example.com/g_aadhaar_f.jpg' : null,
      guarantorAadhaarBack:
          withDocs ? 'https://example.com/g_aadhaar_b.jpg' : null,
      guarantorPan: withDocs ? 'https://example.com/g_pan.jpg' : null,
      guarantorVideo: withDocs ? 'https://example.com/g_video.mp4' : null,
      guarantorSignature: withDocs ? 'https://example.com/g_sig.png' : null,
    );
  }

  Widget buildTestScreen({
    RiderModel? rider,
    Locale locale = const Locale('en'),
    ThemeMode themeMode = ThemeMode.light,
  }) {
    final seededRider = rider ?? createTestRider();
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
        home: const MyDocumentsScreen(),
      ),
    );
  }

  group('My Documents Screen Deep Audit Tests', () {
    testWidgets(
        'renders all documents, verified security profile, and counts in English',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestScreen());
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('My Documents'), findsOneWidget);
      expect(find.text('SECURITY PROFILE'), findsOneWidget);
      expect(find.text('Verified & Secure'), findsOneWidget);
      expect(find.text('YOUR DOCUMENTS'), findsOneWidget);
      expect(find.text('4 FILES'), findsOneWidget);
      expect(find.text('Aadhaar Card (Front)'), findsOneWidget);
      expect(find.text('Aadhaar Card (Back)'), findsOneWidget);
      expect(find.text('PAN Card'), findsOneWidget);
      expect(find.text('Digital Signature'), findsOneWidget);

      expect(find.text("GUARANTOR'S DOCUMENTS"), findsOneWidget);
      expect(find.text('5 FILES'), findsOneWidget);
      expect(find.text("Guarantor's Aadhaar (Front)"), findsOneWidget);
      expect(find.text("Guarantor's Aadhaar (Back)"), findsOneWidget);
      expect(find.text("Guarantor's PAN Card"), findsOneWidget);
      expect(find.text('Verification Video'), findsOneWidget);
      expect(find.text("Guarantor's Signature"), findsOneWidget);

      expect(find.text('Having trouble with documents?'), findsOneWidget);
      expect(find.text('CONTACT SUPPORT'), findsOneWidget);
    });

    testWidgets('renders cleanly in Dark Mode without contrast crashes',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        buildTestScreen(themeMode: ThemeMode.dark),
      );
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.byType(MyDocumentsScreen), findsOneWidget);
      expect(find.text('My Documents'), findsOneWidget);
      expect(find.text('SECURITY PROFILE'), findsOneWidget);
      expect(find.text('4 FILES'), findsOneWidget);
      expect(find.text('5 FILES'), findsOneWidget);
    });

    testWidgets('renders localized Hindi strings when locale is Hindi',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(
        buildTestScreen(locale: const Locale('hi')),
      );
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('मेरे दस्तावेज़'), findsOneWidget);
      expect(find.text('सुरक्षा प्रोफ़ाइल'), findsOneWidget);
      expect(find.text('सत्यापित और सुरक्षित'), findsOneWidget);
      expect(find.text('आपके दस्तावेज़'), findsOneWidget);
      expect(find.text('4 फ़ाइलें'), findsOneWidget);
      expect(find.text('आधार कार्ड (सामने)'), findsOneWidget);
      expect(find.text('आधार कार्ड (पीछे)'), findsOneWidget);
      expect(find.text('पैन कार्ड'), findsOneWidget);
      expect(find.text('डिजिटल हस्ताक्षर'), findsOneWidget);

      expect(find.text('गारंटर के दस्तावेज़'), findsOneWidget);
      expect(find.text('5 फ़ाइलें'), findsOneWidget);
      expect(find.text('गारंटर का आधार (सामने)'), findsOneWidget);
      expect(find.text('गारंटर का आधार (पीछे)'), findsOneWidget);
      expect(find.text('गारंटर का पैन कार्ड'), findsOneWidget);
      expect(find.text('सत्यापन वीडियो'), findsOneWidget);
      expect(find.text('गारंटर के हस्ताक्षर'), findsOneWidget);
    });

    testWidgets('displays in-progress security profile when KYC is pending',
        (tester) async {
      final pendingRider = createTestRider(kycStatus: KycStatus.pending);
      await tester.pumpWidget(buildTestScreen(rider: pendingRider));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('Under Review'), findsOneWidget);
      expect(
        find.textContaining('Your verification is in progress'),
        findsOneWidget,
      );
    });

    testWidgets('displays empty state when rider has no documents uploaded',
        (tester) async {
      final emptyRider = createTestRider(withDocs: false);
      await tester.pumpWidget(buildTestScreen(rider: emptyRider));
      await tester.pump(const Duration(milliseconds: 500));

      expect(find.text('0 FILES'), findsNWidgets(2));
      expect(find.text('No documents submitted yet'), findsNWidgets(2));
    });

    testWidgets('tapping document item triggers viewing logic without crash',
        (tester) async {
      await tester.pumpWidget(buildTestScreen());
      await tester.pump(const Duration(milliseconds: 500));

      final docItem = find.text('Aadhaar Card (Front)');
      expect(docItem, findsOneWidget);

      await tester.tap(docItem);
      await tester.pump(const Duration(milliseconds: 500));

      expect(tester.takeException(), isNull);
    });

    testWidgets('tapping Contact Support navigates to SupportCenterScreen',
        (tester) async {
      tester.view.physicalSize = const Size(800, 2000);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(() {
        tester.view.resetPhysicalSize();
        tester.view.resetDevicePixelRatio();
      });

      await tester.pumpWidget(buildTestScreen());
      await tester.pump(const Duration(milliseconds: 500));

      final supportCta = find.text('CONTACT SUPPORT');
      expect(supportCta, findsOneWidget);

      await tester.tap(supportCta);
      await tester.pump();
      await tester.pump(const Duration(milliseconds: 600));

      expect(find.byType(SupportCenterScreen), findsOneWidget);
    });

    testWidgets('tapping AppBar back button triggers maybePop',
        (tester) async {
      await tester.pumpWidget(buildTestScreen());
      await tester.pump(const Duration(milliseconds: 500));

      final backButton = find.byIcon(Icons.arrow_back);
      expect(backButton, findsOneWidget);

      await tester.tap(backButton);
      await tester.pump(const Duration(milliseconds: 500));

      expect(tester.takeException(), isNull);
    });
  });
}
