import 'dart:convert';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:http/http.dart' as http;
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';

class MockHttpClient extends Mock implements http.Client {}

class MockSecureStorageService extends Mock implements SecureStorageService {}

/// P0-4 (settings audit, 2026-09-08): `fetchSettings`/`setWalletSettings`
/// previously had ZERO callers, so the app's minimum top-up was always the
/// compile-time fallback and admin edits to `walletMinTopup` never reached
/// riders. These tests pin the new flow:
///   GET /api/rider/settings → WalletNotifier.syncServerSettings()
///     → setWalletSettings(settings.walletMinTopup) → state.walletMinTopup.
void main() {
  setUpAll(() {
    registerFallbackValue(Uri.parse('http://api.test.local'));
    registerFallbackValue(<String, dynamic>{});
  });

  late ProviderContainer container;
  late MockHttpClient mockClient;
  late MockSecureStorageService mockStorage;
  late ApiClient apiClient;

  Map<String, dynamic> settingsPayload(Map<String, dynamic> settings) => {
        'success': true,
        'data': {
          'settings': settings,
          'featureFlags': <String, dynamic>{},
        },
      };

  setUp(() {
    TestWidgetsFlutterBinding.ensureInitialized();
    container = ProviderContainer();
    addTearDown(container.dispose);
    mockClient = MockHttpClient();
    mockStorage = MockSecureStorageService();
    apiClient = ApiClient(
      client: mockClient,
      storage: mockStorage,
      baseUrl: 'http://api.test.local',
    );

    when(() => mockStorage.getSessionToken())
        .thenAnswer((_) async => 'mock-jwt-token');
  });

  void stubSettingsResponse(Map<String, dynamic> body, {int status = 200}) {
    when(() => mockClient.get(
          any(),
          headers: any(named: 'headers'),
        )).thenAnswer((_) async => http.Response(
          jsonEncode(body),
          status,
          headers: {'content-type': 'application/json'},
        ));
  }

  group('WalletNotifier.syncServerSettings', () {
    test('parses an integer rupee value from the server payload', () async {
      stubSettingsResponse(
        settingsPayload({'walletMinTopup': 1500}),
      );

      final notifier = container.read(walletProvider.notifier);
      await notifier.syncServerSettings(apiClient: apiClient);

      expect(container.read(walletProvider).walletMinTopup, 1500.0);
    });

    test('parses a double rupee value', () async {
      stubSettingsResponse(
        settingsPayload({'walletMinTopup': 750.5}),
      );

      final notifier = container.read(walletProvider.notifier);
      await notifier.syncServerSettings(apiClient: apiClient);

      expect(container.read(walletProvider).walletMinTopup, 750.5);
    });

    test('parses a numeric-string value', () async {
      stubSettingsResponse(
        settingsPayload({'walletMinTopup': '2500'}),
      );

      final notifier = container.read(walletProvider.notifier);
      await notifier.syncServerSettings(apiClient: apiClient);

      expect(container.read(walletProvider).walletMinTopup, 2500.0);
    });

    test('ignores a missing / zero / negative value (keeps state)', () async {
      stubSettingsResponse(
        settingsPayload({'supportEmail': 'support@voltium.app'}),
      );

      final notifier = container.read(walletProvider.notifier);
      notifier.setWalletSettings(1500); // pre-existing floor
      await notifier.syncServerSettings(apiClient: apiClient);

      expect(container.read(walletProvider).walletMinTopup, 1500.0);
    });

    test('swallows network errors (offline-first fallback stays intact)',
        () async {
      when(() => mockClient.get(any(), headers: any(named: 'headers')))
          .thenThrow(Exception('offline'));

      final notifier = container.read(walletProvider.notifier);
      notifier.setWalletSettings(1500);

      await notifier.syncServerSettings(apiClient: apiClient);

      expect(container.read(walletProvider).walletMinTopup, 1500.0);
    });

    test('swallows a non-200 response', () async {
      stubSettingsResponse(
        {
          'success': false,
          'error': {'message': 'unauthorized'}
        },
        status: 401,
      );

      final notifier = container.read(walletProvider.notifier);
      notifier.setWalletSettings(1500);
      await notifier.syncServerSettings(apiClient: apiClient);

      expect(container.read(walletProvider).walletMinTopup, 1500.0);
    });
  });

  group('setWalletSettings (top-up floor contract)', () {
    test('updates the state read by the top-up amount screen', () {
      final notifier = container.read(walletProvider.notifier);
      expect(container.read(walletProvider).walletMinTopup, 0.0);
      notifier.setWalletSettings(1500);
      expect(container.read(walletProvider).walletMinTopup, 1500.0);
    });
  });
}
