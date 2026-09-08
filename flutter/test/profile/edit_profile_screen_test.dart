import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:voltium_rider/features/profile/presentation/screens/edit_profile_screen.dart';
import 'package:voltium_rider/features/profile/presentation/providers/guarantor_verification_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:shared_preferences/shared_preferences.dart';

class _SeededRiderNotifier extends RiderNotifier {
  _SeededRiderNotifier(this._seed);
  final RiderModel _seed;

  @override
  RiderState build() => RiderState(
        rider: _seed,
        riderId: _seed.riderId.isNotEmpty ? _seed.riderId : _seed.id,
        phone: _seed.phone,
        dataState: DataState.fresh,
        hasFetchedOnce: true,
      );

  @override
  void updateRider(RiderModel newRider) {
    state = state.copyWith(rider: newRider);
  }
}

/// Captures the `UpdateProfileRequest` the screen builds so tests can
/// assert on the exact payload (guarantor receipt, pruned keys). Uses
/// the P1-1 repository seam — the screen routes its save through
/// `riderRepositoryProvider`, so overriding it intercepts the PUT
/// without any network.
class _CapturingRiderRepository implements RiderRepository {
  Object? lastRequest;
  int updateCalls = 0;

  @override
  Future<Map<String, dynamic>> getRiderProfile() async => {'success': true};

  @override
  Future<void> registerFCMToken(String token) async {}

  @override
  Future<void> updateProfile({
    required String riderId,
    required dynamic request,
  }) async {
    updateCalls++;
    lastRequest = request;
  }

  @override
  Future<String> uploadProfilePhoto(dynamic file,
      {required String category}) async {
    return 'https://files.test/profile.jpg';
  }

  @override
  Future<void> deleteUploadedFile(String url) async {}
}

Widget _buildTestApp({
  RiderModel? initialRider,
  _CapturingRiderRepository? repository,
  GuarantorVerificationNotifier Function()? guarantorVerification,
}) {
  final seed = initialRider ??
      const RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
      );

  return ProviderScope(
    overrides: [
      localeProviderRef.overrideWith(() => LocaleProvider()),
      themeProviderRef.overrideWith(() => ThemeProvider()),
      riderProvider.overrideWith(() => _SeededRiderNotifier(seed)),
      if (repository != null)
        riderRepositoryProvider.overrideWithValue(repository),
      // `Override` is not publicly exported by riverpod 3.x, so the
      // optional guarantor-verification override is passed as a typed
      // notifier-builder instead of a raw override list.
      if (guarantorVerification != null)
        guarantorVerificationProvider.overrideWith(guarantorVerification),
    ],
    child: const MaterialApp(
      locale: Locale('en'),
      localizationsDelegates: AppLocalizations.localizationsDelegates,
      supportedLocales: AppLocalizations.supportedLocales,
      home: EditProfileScreen(),
    ),
  );
}

void main() {
  setUpAll(() async {
    SharedPreferences.setMockInitialValues({});
  });

  group('Edit Profile Screen', () {
    testWidgets('renders without error', (tester) async {
      await tester.pumpWidget(_buildTestApp());
      await tester.pumpAndSettle();
      expect(find.byType(EditProfileScreen), findsOneWidget);
    });

    testWidgets('displays edit profile title', (tester) async {
      await tester.pumpWidget(_buildTestApp());
      await tester.pumpAndSettle();
      expect(find.text('Edit Profile'), findsOneWidget);
    });

    testWidgets('save button is disabled when not dirty', (tester) async {
      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
      );
      await tester.pumpWidget(_buildTestApp(initialRider: rider));
      await tester.pumpAndSettle();

      final submitBtn = tester.widget<ElevatedButton>(
        find.byKey(const Key('submitProfileButton')),
      );
      expect(submitBtn.onPressed, isNull);
    });

    testWidgets('typing a new name enables save button (dirty state)',
        (tester) async {
      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
      );
      await tester.pumpWidget(_buildTestApp(initialRider: rider));
      await tester.pumpAndSettle();

      // Enter a new name
      await tester.enterText(
          find.byKey(const Key('editFullNameField')), 'Jane Doe');
      await tester.pumpAndSettle();

      final submitBtn = tester.widget<ElevatedButton>(
        find.byKey(const Key('submitProfileButton')),
      );
      expect(submitBtn.onPressed, isNotNull);
    });

    testWidgets('shows discard dialog when dirty and tapping back button',
        (tester) async {
      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
      );
      await tester.pumpWidget(_buildTestApp(initialRider: rider));
      await tester.pumpAndSettle();

      // Make dirty
      await tester.enterText(
          find.byKey(const Key('editFullNameField')), 'Jane Doe');
      await tester.pumpAndSettle();

      // Tap back button
      await tester.tap(find.byIcon(Icons.arrow_back));
      await tester.pumpAndSettle();

      // Discard dialog should appear
      expect(find.text('Discard changes?'), findsOneWidget);
      expect(find.text('Keep Editing'), findsOneWidget);
      expect(find.text('Discard'), findsOneWidget);

      // Tap Keep Editing
      await tester.tap(find.text('Keep Editing'));
      await tester.pumpAndSettle();
      expect(find.text('Discard changes?'), findsNothing);
    });

    testWidgets('shows validation error for invalid name and email',
        (tester) async {
      tester.view.physicalSize = const Size(1080, 2400);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
      );
      await tester.pumpWidget(_buildTestApp(initialRider: rider));
      await tester.pumpAndSettle();

      // Enter invalid inputs
      await tester.enterText(find.byKey(const Key('editFullNameField')), 'A');
      await tester.enterText(
          find.byKey(const Key('editEmailField')), 'invalid-email');
      await tester.pumpAndSettle();

      // Tap submit
      final submitFinder = find.byKey(const Key('submitProfileButton'));
      await tester.tap(submitFinder);
      await tester.pumpAndSettle();

      expect(find.text('Enter a valid name (at least 2 characters)'),
          findsOneWidget);
      expect(find.text('Enter a valid email address'), findsOneWidget);
    });

    // ── EDIT-PROFILE-AUDIT test gaps 6 & 8 (2026-09-08) ────────────
    // Gap 6: OTP-gated save. A changed guarantor number must block the
    // save with the re-verify toast until a receipt exists; marking the
    // provider verified (what a successful OTP verify does) unblocks
    // it and the PUT carries the receipt.
    testWidgets(
        'gap 6: changed guarantor phone without receipt blocks save with the re-verify toast',
        (tester) async {
      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        guarantorName: 'Original Guarantor',
        guarantorPhone: '9000000001',
      );
      final repo = _CapturingRiderRepository();
      await tester
          .pumpWidget(_buildTestApp(initialRider: rider, repository: repo));
      await tester.pumpAndSettle();

      // Touch an unrelated field so the form is dirty, then change the
      // guarantor number.
      await tester.enterText(
          find.byKey(const Key('editFullNameField')), 'Jane Doe');
      await tester.enterText(
          find.byKey(const Key('editGuarantorPhoneField')), '9888877777');
      await tester.pumpAndSettle();

      final submitFinder = find.byKey(const Key('submitProfileButton'));
      await tester.ensureVisible(submitFinder);
      await tester.pumpAndSettle();
      await tester.tap(submitFinder, warnIfMissed: false);
      await tester.pumpAndSettle();

      // Save blocked: the repository never fired. The verify-flag gate
      // (first gate in `_saveProfile`) catches a changed number with no
      // verification session — the re-verify receipt gate is the
      // second-line guard for the "verified flag but lost receipt" case.
      expect(repo.updateCalls, 0,
          reason:
              'changed guarantor number must NOT reach the PUT without verification');
      expect(
        find.textContaining('verify the new guarantor phone number'),
        findsOneWidget,
      );
    });

    testWidgets('gap 6b: after OTP verify, the receipt rides along on the PUT',
        (tester) async {
      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        guarantorName: 'Original Guarantor',
        guarantorPhone: '9000000001',
      );
      final repo = _CapturingRiderRepository();
      await tester
          .pumpWidget(_buildTestApp(initialRider: rider, repository: repo));
      await tester.pumpAndSettle();

      await tester.enterText(
          find.byKey(const Key('editFullNameField')), 'Jane Doe');
      await tester.enterText(
          find.byKey(const Key('editGuarantorPhoneField')), '9888877777');
      await tester.pumpAndSettle();

      // Simulate a successful OTP verify AFTER the number is typed
      // (the real flow: type → send OTP → verify → markVerified). The
      // screen's onChanged clears any pre-existing receipt when the
      // number changes, so the receipt must be set post-typing — this
      // ordering is the production contract.
      final screenContext = tester.element(find.byType(EditProfileScreen));
      ProviderScope.containerOf(screenContext)
          .read(guarantorVerificationProvider.notifier)
          .markVerified(phone: '9888877777', receipt: 'test-receipt-token');
      await tester.pumpAndSettle();

      final submitFinder = find.byKey(const Key('submitProfileButton'));
      await tester.ensureVisible(submitFinder);
      await tester.pumpAndSettle();
      await tester.tap(submitFinder, warnIfMissed: false);
      await tester.pumpAndSettle();

      // The save proceeds and the receipt is attached to the request.
      expect(repo.updateCalls, 1,
          reason: 'a verified number must let the save through');
      final request = repo.lastRequest as dynamic;
      expect(request.guarantorPhone, '9888877777');
      expect(request.guarantorPhoneReceipt, 'test-receipt-token');
    });

    // Gap 8: mid-edit background refresh rebase. The screen listens on
    // the rider model; a server-side update should silently rebase
    // untouched fields (no banner) and flag touched ones (banner).
    testWidgets(
        'gap 8: mid-edit background refresh flags conflicting fields and rebases untouched ones',
        (tester) async {
      final rider = RiderModel(
        id: 'r-1',
        riderId: 'r-1',
        phone: '9876543210',
        name: 'John Doe',
        email: 'john@example.com',
        currentAddress: '12 Old Street',
        updatedAt: DateTime(2026, 9, 8, 10, 0, 0),
      );
      final notifier = _SeededRiderNotifier(rider);
      await tester.pumpWidget(
        ProviderScope(
          overrides: [
            localeProviderRef.overrideWith(() => LocaleProvider()),
            themeProviderRef.overrideWith(() => ThemeProvider()),
            riderProvider.overrideWith(() => notifier),
          ],
          child: const MaterialApp(
            locale: Locale('en'),
            localizationsDelegates: AppLocalizations.localizationsDelegates,
            supportedLocales: AppLocalizations.supportedLocales,
            home: EditProfileScreen(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      // Sanity: no banner before any server update.
      expect(find.textContaining('updated elsewhere'), findsNothing);

      // User edits ONLY the name (touched).
      await tester.enterText(
          find.byKey(const Key('editFullNameField')), 'Jane Doe');
      await tester.pumpAndSettle();

      // Server update lands mid-edit: name unchanged server-side,
      // address corrected by admin. Name (touched, server same) →
      // no conflict; address (untouched, server changed) → silent
      // rebase.
      notifier.updateRider(
        rider.copyWith(
          currentAddress: '99 New Avenue',
          updatedAt: DateTime(2026, 9, 8, 10, 5, 0),
        ),
      );
      await tester.pumpAndSettle();

      // The untouched address field was silently rebased to the server
      // value; the touched name keeps the user's text; NO banner (no
      // true conflict).
      expect(find.text('99 New Avenue'), findsOneWidget,
          reason: 'untouched field must silently rebase to the server value');
      expect(find.text('Jane Doe'), findsOneWidget,
          reason: 'touched field must keep the user text');
      expect(find.textContaining('updated elsewhere'), findsNothing);

      // Now a true conflict: the server changes the NAME the user is
      // editing.
      notifier.updateRider(
        rider.copyWith(
          name: 'Server Name',
          currentAddress: '99 New Avenue',
          updatedAt: DateTime(2026, 9, 8, 10, 10, 0),
        ),
      );
      await tester.pumpAndSettle();

      // The banner appears and the user's text is preserved.
      expect(find.textContaining('updated elsewhere'), findsOneWidget);
      expect(find.text('Jane Doe'), findsOneWidget,
          reason: 'conflicting field must NOT be silently overwritten');
      expect(find.text('Server Name'), findsNothing);
    });
  });
}
