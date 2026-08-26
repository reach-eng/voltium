import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart' as api;
import 'package:voltium_rider/features/wallet/data/repository_impl.dart';
import 'package:voltium_rider/features/wallet/domain/entity.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

class FakeTopupRequest extends Fake implements api.TopupRequest {}

void main() {
  late MockApiClient mockApiClient;
  late MockVoltiumApiClient mockVoltiumApiClient;
  late WalletRepositoryImpl repository;

  setUpAll(() {
    registerFallbackValue(FakeTopupRequest());
  });

  setUp(() {
    mockApiClient = MockApiClient();
    mockVoltiumApiClient = MockVoltiumApiClient();
    repository = WalletRepositoryImpl(mockApiClient, mockVoltiumApiClient);
  });

  group('WalletRepositoryImpl', () {
    test('getWallet calls getRiderDashboard', () async {
      when(() => mockVoltiumApiClient.getRiderDashboard())
          .thenAnswer((_) async => {'riderId': 'r123', 'balanceInPaise': 5000});

      final result = await repository.getWallet('r123');

      expect(result.riderId, 'r123');
      expect(result.balanceInPaise, 5000);
      verify(() => mockVoltiumApiClient.getRiderDashboard()).called(1);
    });

    test('submitTopup calls postTransactionTopup', () async {
      when(() => mockVoltiumApiClient.postTransactionTopup(any()))
          .thenAnswer((_) async => api.TopupResponse(id: 'topup123'));

      const request = TopupRequest(
        riderId: 'r123',
        amount: 500,
        method: 'UPI',
        upiRef: 'REF123',
      );

      final result = await repository.submitTopup(request);

      expect(result, request);
      final captured =
          verify(() => mockVoltiumApiClient.postTransactionTopup(captureAny()))
              .captured;
      final req = captured.first as api.TopupRequest;
      expect(req.amount, 500);
      expect(req.method, 'UPI');
      expect(req.upiRef, 'REF123');
    });

    test('submitTopup throws if response id is null or empty', () async {
      when(() => mockVoltiumApiClient.postTransactionTopup(any()))
          .thenAnswer((_) async => api.TopupResponse(id: ''));

      const request = TopupRequest(
        riderId: 'r123',
        amount: 500,
        method: 'UPI',
      );

      expect(
        () => repository.submitTopup(request),
        throwsA(isA<Exception>()),
      );
    });

    test('getTransactionHistory extracts from data or transactions list',
        () async {
      when(() => mockVoltiumApiClient.getTransactionHistory(any(), any()))
          .thenAnswer((_) async => {
                'data': [
                  {'id': 'tx1', 'amount': 100},
                  {'id': 'tx2', 'amount': 200},
                ]
              });

      final result =
          await repository.getTransactionHistory('r123', page: 1, limit: 10);

      expect(result.length, 2);
      expect(result[0].id, 'tx1');
      expect(result[1].id, 'tx2');
    });

    test('deleteTransactionHistory calls delete on api client', () async {
      when(() => mockApiClient.delete(any())).thenAnswer((_) async => {});

      await repository.deleteTransactionHistory('r123');

      verify(() => mockApiClient.delete('/api/transaction/history')).called(1);
    });
  });
}
