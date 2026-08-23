import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/features/wallet/data/repository_impl.dart';
import 'package:voltium_rider/features/wallet/domain/entity.dart';

class MockApiClient extends Mock implements ApiClient {}

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late MockVoltiumApiClient mockVoltiumApiClient;
  late WalletRepositoryImpl repository;

  setUp(() {
    mockApiClient = MockApiClient();
    mockVoltiumApiClient = MockVoltiumApiClient();
    // PR-4 (F-011): the topup path now goes through `_client.post(...)`
    // with an Idempotency-Key header. The generated client's
    // `postTransactionTopup` is no longer called for topups.
    repository = WalletRepositoryImpl(mockApiClient, mockVoltiumApiClient);
  });

  group('WalletRepositoryImpl', () {
    test('submitTopup posts with Idempotency-Key header (F-011)', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'id': 'topup123'});

      const request = TopupRequest(
        riderId: 'r123',
        // PR-RUPEES-2026-08-08: rupees-shaped field, value in rupees.
        amountInRupees: 500,
        method: 'UPI',
        upiRef: 'REF123',
      );

      final result = await repository.submitTopup(request);

      expect(result, request);
      final captured = verify(() => mockApiClient.post(
            '/api/transaction/topup',
            body: captureAny(named: 'body'),
            idempotencyKey: captureAny(named: 'idempotencyKey'),
          )).captured;
      final body = captured.first as Map<String, dynamic>;
      expect(body['amount'], 500);
      expect(body['method'], 'UPI');
      expect(body['upiRef'], 'REF123');
    });

    test('submitTopup throws if response id is null or empty', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'id': ''});

      const request = TopupRequest(
        riderId: 'r123',
        amountInRupees: 500,
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
  });
}
