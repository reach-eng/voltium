import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:voltium_rider/app/router.dart';
import 'package:voltium_rider/app/app_state.dart';
import 'package:voltium_rider/core/navigation/app_state.dart' as modern;
import 'package:voltium_rider/core/navigation/app_state_notifier.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/features/profile/domain/repository.dart';
import 'package:voltium_rider/features/rentals/data/repository_impl.dart';
import 'package:voltium_rider/features/support/data/repository_impl.dart';
import 'package:voltium_rider/features/wallet/data/repository_impl.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/active_dashboard_screen.dart';
import 'package:voltium_rider/features/dashboard/presentation/screens/hang_tight_screen.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

class _MockRiderRepository implements RiderRepository {
  final Map<String, dynamic>? customProfile;
  _MockRiderRepository([this.customProfile]);

  @override
  Future<Map<String, dynamic>> getRiderProfile() async => {
        'data': customProfile ??
            {
              'id': 'r1',
              'riderId': 'r1',
              'phone': '9876543210',
              'name': 'Active Rider',
              'accountStatus': 'ACTIVE',
              'kycStatus': 'APPROVED',
              'lifecycleStatus': 'ACTIVE',
              'pickupDone': true,
            }
      };

  @override
  Future<void> registerFCMToken(String token) async {}
}

Widget _createTestRouter({
  required ProviderContainer container,
}) {
  return UncontrolledProviderScope(
    container: container,
    child: const MaterialApp(
      localizationsDelegates: [
        AppLocalizations.delegate,
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      home: AppRouter(),
    ),
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('F-02: AppState synchronization in AppRouter', () {
    setUp(() async {
      SharedPreferences.setMockInitialValues({});
      await CacheService().init();
      AppConstants.isTestModeOverride = true;
    });

    testWidgets(
        'cold-start session restoration transitions appStateProvider to ActiveDashboard',
        (tester) async {
      // 1. Seed cached active rider and saved dashboard state
      await CacheService().cacheRider({
        'id': 'r1',
        'name': 'Active Rider',
        'phone': '9876543210',
        'accountStatus': 'ACTIVE',
        'kycStatus': 'APPROVED',
        'lifecycleStatus': 'ACTIVE',
        'pickupDone': true,
      });
      await CacheService()
          .setString('voltium_saved_auth_state', AuthState.dashboard.name);
      await CacheService().setBool('legal_accepted_v1', true);

      final client = ApiClient.testOverride(baseUrl: 'http://test.invalid');
      final vClient = VoltiumApiClient(client);

      final container = ProviderContainer(
        overrides: [
          riderRepositoryProvider.overrideWithValue(_MockRiderRepository()),
          rentalRepositoryProvider
              .overrideWithValue(RentalRepositoryImpl(vClient)),
          walletRepositoryProvider
              .overrideWithValue(WalletRepositoryImpl(vClient)),
          supportRepositoryProvider
              .overrideWithValue(SupportRepositoryImpl(vClient)),
          filesRepositoryProvider
              .overrideWithValue(FilesRepository(client, vClient)),
        ],
      );

      // Initially, appStateProvider starts at Splash
      expect(container.read(appStateProvider), isA<modern.Splash>());

      await tester.pumpWidget(_createTestRouter(container: container));

      // Allow splash animation and navigation to complete
      await tester.pump(const Duration(seconds: 5));

      // Verify that router navigated to dashboard
      expect(find.byType(ActiveDashboardScreen), findsOneWidget);

      // F-02 assertion: appStateProvider MUST have transitioned to ActiveDashboard
      final currentAppState = container.read(appStateProvider);
      expect(currentAppState, isA<modern.ActiveDashboard>(),
          reason:
              'AppState must advance to ActiveDashboard on restored session');

      // Verify post-pickup poller / device sync are started and running
      final riderNotifier = container.read(riderProvider.notifier);
      expect(() => riderNotifier.startPostPickupPoll(), returnsNormally);

      // Reset AppState to Splash to cleanly stop all background sync timers & pollers
      container.read(appStateProvider.notifier).reset();
      riderNotifier.stopPolling();

      // Drain entrance animation timers so no animations are left pending
      await tester.pump(const Duration(seconds: 2));
      await tester.pumpWidget(const SizedBox());
      container.dispose();
    });

    testWidgets(
        'cold-start session restoration for hangTight transitions appStateProvider to HangTight',
        (tester) async {
      await CacheService().cacheRider({
        'id': 'r2',
        'name': 'Pickup Scheduled Rider',
        'phone': '9876543211',
        'accountStatus': 'ACTIVE',
        'kycStatus': 'APPROVED',
        'lifecycleStatus': 'PICKUP_SCHEDULED',
        'pickupDone': false,
      });
      await CacheService()
          .setString('voltium_saved_auth_state', AuthState.hangTight.name);
      await CacheService().setBool('legal_accepted_v1', true);

      final client = ApiClient.testOverride(baseUrl: 'http://test.invalid');
      final vClient = VoltiumApiClient(client);

      final container = ProviderContainer(
        overrides: [
          riderRepositoryProvider.overrideWithValue(_MockRiderRepository({
            'id': 'r2',
            'riderId': 'r2',
            'phone': '9876543211',
            'name': 'Pickup Scheduled Rider',
            'accountStatus': 'ACTIVE',
            'kycStatus': 'APPROVED',
            'lifecycleStatus': 'PICKUP_SCHEDULED',
            'pickupDone': false,
          })),
          rentalRepositoryProvider
              .overrideWithValue(RentalRepositoryImpl(vClient)),
          walletRepositoryProvider
              .overrideWithValue(WalletRepositoryImpl(vClient)),
          supportRepositoryProvider
              .overrideWithValue(SupportRepositoryImpl(vClient)),
          filesRepositoryProvider
              .overrideWithValue(FilesRepository(client, vClient)),
        ],
      );

      await tester.pumpWidget(_createTestRouter(container: container));
      await tester.pump(const Duration(seconds: 5));

      expect(find.byType(HangTightScreen), findsOneWidget);

      // F-02 assertion: appStateProvider transitioned to HangTight
      expect(container.read(appStateProvider), isA<modern.HangTight>());

      // Verify startOnboardingPoll succeeds and is not blocked by HangTight guard
      final riderNotifier = container.read(riderProvider.notifier);
      expect(() => riderNotifier.startOnboardingPoll(), returnsNormally);

      container.read(appStateProvider.notifier).reset();
      riderNotifier.stopPolling();
      await tester.pumpWidget(const SizedBox());
      container.dispose();
    });

    testWidgets(
        'first-time user without session transitions appStateProvider away from Splash',
        (tester) async {
      await CacheService().setBool('legal_accepted_v1', true);

      final client = ApiClient.testOverride(baseUrl: 'http://test.invalid');
      final vClient = VoltiumApiClient(client);

      final container = ProviderContainer(
        overrides: [
          riderRepositoryProvider.overrideWithValue(_MockRiderRepository()),
          rentalRepositoryProvider
              .overrideWithValue(RentalRepositoryImpl(vClient)),
          walletRepositoryProvider
              .overrideWithValue(WalletRepositoryImpl(vClient)),
          supportRepositoryProvider
              .overrideWithValue(SupportRepositoryImpl(vClient)),
          filesRepositoryProvider
              .overrideWithValue(FilesRepository(client, vClient)),
        ],
      );

      await tester.pumpWidget(_createTestRouter(container: container));
      await tester.pump(const Duration(seconds: 5));

      // Should have advanced beyond Splash
      final appState = container.read(appStateProvider);
      expect(appState, isNot(isA<modern.Splash>()));

      container.read(appStateProvider.notifier).reset();
      container.read(riderProvider.notifier).stopPolling();
      await tester.pumpWidget(const SizedBox());
      container.dispose();
    });
  });
}
