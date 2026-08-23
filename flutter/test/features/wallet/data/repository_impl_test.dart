import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/features/wallet/data/repository_impl.dart';
import 'package:voltium_rider/features/wallet/domain/entity.dart';

class MockApiClient extends Mock implements ApiClient {}

// Stub for the unused `VoltiumApiClient` arg kept for backwards
// compatibility with the constructor signature (the impl no longer
// touches it on the topup path).
class _NullVoltiumApiClient extends Mock implements VoltiumApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late WalletRepositoryImpl repository;

  setUp(() {
    mockApiClient = MockApiClient();
    // PR-4 (F-011): the impl now goes through `_client.post(...)`
    // directly (the generated `postTransactionTopup` had no
    // idempotency-key parameter). The constructor still takes the
    // generated client for backwards compatibility with call sites.
    repository = WalletRepositoryImpl(
      mockApiClient,
      _NullVoltiumApiClient(),
    );
  });

  group('WalletRepositoryImpl.submitTopup (PR-4 / F-011)', () {
    test('forwards amountInRupees as the body amount', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'id': 'tx-123'});

      final request = TopupRequest(
        riderId: 'r1',
        // PR-RUPEES-2026-08-08: the field is `amountInRupees`. The value
        // `500` is in rupees (₹500) — no /100 here.
        amountInRupees: 500,
        method: 'UPI',
        purpose: 'TOP_UP',
        upiRef: 'ref1',
        proofUrl: 'url1',
      );

      final result = await repository.submitTopup(request);

      expect(result, request);
      final captured = verify(() => mockApiClient.post(
            '/api/transaction/topup',
            body: captureAny(named: 'body'),
            idempotencyKey: captureAny(named: 'idempotencyKey'),
          )).captured;
      final body = captured.first as Map<String, dynamic>;
      expect(body['riderId'], 'r1');
      expect(body['amount'], 500);
      expect(body['method'], 'UPI');
      expect(body['purpose'], 'TOP_UP');
      expect(body['upiRef'], 'ref1');
      expect(body['proofUrl'], 'url1');
    });

    test('passes a fresh UUID v4 idempotency key per submit', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'id': 'tx-1'});

      final request = TopupRequest(
          riderId: 'r1',
          amountInRupees: 100,
          method: 'CASH',
          purpose: 'TOP_UP');
      await repository.submitTopup(request);
      await repository.submitTopup(request);
      final captured = verify(() => mockApiClient.post(
            '/api/transaction/topup',
            body: any(named: 'body'),
            idempotencyKey: captureAny(named: 'idempotencyKey'),
          )).captured;
      final keys = captured.cast<String?>();
      expect(keys.length, 2);
      expect(keys[0], isNotNull);
      expect(keys[0]!.length, 36, reason: 'UUID v4 is 36 chars with hyphens');
      expect(keys[0], isNot(equals(keys[1])),
          reason: 'F-011: every submit MUST get a fresh key — re-using a '
              'key would conflate the dedup window');
    });

    test('throws if response id is null', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'id': null});

      final request = TopupRequest(
          riderId: 'r1',
          amountInRupees: 100,
          method: 'CASH',
          purpose: 'TOP_UP');
      expect(() => repository.submitTopup(request), throwsException);
    });

    test('throws if response id is empty', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'id': ''});

      final request = TopupRequest(
          riderId: 'r1',
          amountInRupees: 100,
          method: 'CASH',
          purpose: 'TOP_UP');
      expect(() => repository.submitTopup(request), throwsException);
    });

    test('propagates API exceptions', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenThrow(Exception('Topup error'));

      final request = TopupRequest(
          riderId: 'r1',
          amountInRupees: 100,
          method: 'CASH',
          purpose: 'TOP_UP');
      expect(() => repository.submitTopup(request), throwsException);
    });

    test('handles optional fields mapped to null', () async {
      when(() => mockApiClient.post(
            any(),
            body: any(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).thenAnswer((_) async => {'id': 'tx-123'});

      final request = TopupRequest(
          riderId: 'r1',
          amountInRupees: 100,
          method: 'CASH',
          purpose: 'TOP_UP');
      await repository.submitTopup(request);
      final captured = verify(() => mockApiClient.post(
            '/api/transaction/topup',
            body: captureAny(named: 'body'),
            idempotencyKey: any(named: 'idempotencyKey'),
          )).captured;
      final body = captured.first as Map<String, dynamic>;
      expect(body['upiRef'], null);
      expect(body['proofUrl'], null);
    });
  });
}

// Sentinel unused VoltiumApiClient — the impl no longer touches the
// generated client on the topup path (F-011), but the constructor
// signature keeps the param for backwards compatibility with call
// sites and test doubles. The MockVoltiumApiClient above is the
// real sentinel.
