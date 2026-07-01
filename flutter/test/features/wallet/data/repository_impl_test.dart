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
    // getWallet tests
    test('getWallet calls getRiderDashboard and maps to WalletEntity', () async {
      final mockResponse = {
        'balanceInPaise': 150050,
      };
      when(() => mockVoltiumApiClient.getRiderDashboard())
          .thenAnswer((_) async => mockResponse);

      final result = await repository.getWallet('rider-123');

      expect(result.balanceInRupees, 1500.5);
      verify(() => mockVoltiumApiClient.getRiderDashboard()).called(1);
    });

    test('getWallet handles zero balance correctly', () async {
      final mockResponse = {'balanceInPaise': 0};
      when(() => mockVoltiumApiClient.getRiderDashboard())
          .thenAnswer((_) async => mockResponse);

      final result = await repository.getWallet('rider-123');
      expect(result.balanceInRupees, 0.0);
    });

    test('getWallet handles null balance correctly by defaulting to 0', () async {
      final mockResponse = <String, dynamic>{};
      when(() => mockVoltiumApiClient.getRiderDashboard())
          .thenAnswer((_) async => mockResponse);

      final result = await repository.getWallet('rider-123');
      expect(result.balanceInRupees, 0.0);
    });

    test('getWallet propagates API exception', () async {
      when(() => mockVoltiumApiClient.getRiderDashboard())
          .thenThrow(Exception('Dashboard Error'));

      expect(() => repository.getWallet('r1'), throwsException);
    });



    // submitTopup tests
    test('submitTopup delegates to postTransactionTopup with mapped request', () async {
      when(() => mockVoltiumApiClient.postTransactionTopup(any()))
          .thenAnswer((_) async => api.TopupResponse(id: 'tx-123'));

      final request = TopupRequest(
        riderId: 'r1',
        amount: 500,
        method: 'UPI',
        purpose: 'TOP_UP',
        upiRef: 'ref1',
        proofUrl: 'url1',
      );

      final result = await repository.submitTopup(request);

      expect(result, request);
      final captured = verify(() => mockVoltiumApiClient.postTransactionTopup(captureAny())).captured;
      final payload = captured.first as api.TopupRequest;
      expect(payload.riderId, 'r1');
      expect(payload.amount, 500);
      expect(payload.method, 'UPI');
      expect(payload.purpose, 'TOP_UP');
      expect(payload.upiRef, 'ref1');
      expect(payload.proofUrl, 'url1');
    });

    test('submitTopup throws if response id is null', () async {
      when(() => mockVoltiumApiClient.postTransactionTopup(any()))
          .thenAnswer((_) async => api.TopupResponse(id: null));

      final request = TopupRequest(riderId: 'r1', amount: 100, method: 'CASH', purpose: 'TOP_UP');
      expect(() => repository.submitTopup(request), throwsException);
    });

    test('submitTopup throws if response id is empty', () async {
      when(() => mockVoltiumApiClient.postTransactionTopup(any()))
          .thenAnswer((_) async => api.TopupResponse(id: ''));

      final request = TopupRequest(riderId: 'r1', amount: 100, method: 'CASH', purpose: 'TOP_UP');
      expect(() => repository.submitTopup(request), throwsException);
    });

    test('submitTopup propagates API exceptions', () async {
      when(() => mockVoltiumApiClient.postTransactionTopup(any()))
          .thenThrow(Exception('Topup error'));

      final request = TopupRequest(riderId: 'r1', amount: 100, method: 'CASH', purpose: 'TOP_UP');
      expect(() => repository.submitTopup(request), throwsException);
    });

    test('submitTopup handles optional fields mapped to null', () async {
      when(() => mockVoltiumApiClient.postTransactionTopup(any()))
          .thenAnswer((_) async => api.TopupResponse(id: 'tx-123'));

      final request = TopupRequest(riderId: 'r1', amount: 100, method: 'CASH', purpose: 'TOP_UP');
      await repository.submitTopup(request);
      final captured = verify(() => mockVoltiumApiClient.postTransactionTopup(captureAny())).captured;
      final payload = captured.first as api.TopupRequest;
      expect(payload.upiRef, null);
      expect(payload.proofUrl, null);
    });

    // getTransactionHistory tests
    test('getTransactionHistory maps data to TransactionEntity list', () async {
      final mockData = {
        'data': [
          {'id': 'tx1', 'amount': 100.0, 'type': 'CREDIT'},
          {'id': 'tx2', 'amount': 50.0, 'type': 'DEBIT'}
        ]
      };
      when(() => mockVoltiumApiClient.getTransactionHistory(any(), any()))
          .thenAnswer((_) async => mockData);

      final result = await repository.getTransactionHistory('r1');
      expect(result.length, 2);
      expect(result[0].id, 'tx1');
      expect(result[1].type, 'DEBIT');
      verify(() => mockVoltiumApiClient.getTransactionHistory(1, 20)).called(1);
    });

    test('getTransactionHistory reads from transactions key if data is missing', () async {
      final mockData = {
        'transactions': [
          {'id': 'tx3', 'amount': 200.0, 'type': 'CREDIT'}
        ]
      };
      when(() => mockVoltiumApiClient.getTransactionHistory(any(), any()))
          .thenAnswer((_) async => mockData);

      final result = await repository.getTransactionHistory('r1');
      expect(result.length, 1);
      expect(result[0].id, 'tx3');
    });

    test('getTransactionHistory returns empty list if no data available', () async {
      when(() => mockVoltiumApiClient.getTransactionHistory(any(), any()))
          .thenAnswer((_) async => {});

      final result = await repository.getTransactionHistory('r1');
      expect(result.isEmpty, true);
    });

    test('getTransactionHistory passes custom page and limit arguments', () async {
      when(() => mockVoltiumApiClient.getTransactionHistory(any(), any()))
          .thenAnswer((_) async => {});

      await repository.getTransactionHistory('r1', page: 2, limit: 10);
      verify(() => mockVoltiumApiClient.getTransactionHistory(2, 10)).called(1);
    });



    test('getTransactionHistory propagates API exceptions', () async {
      when(() => mockVoltiumApiClient.getTransactionHistory(any(), any()))
          .thenThrow(Exception('History error'));

      expect(() => repository.getTransactionHistory('r1'), throwsException);
    });

    // deleteTransactionHistory tests
    test('deleteTransactionHistory calls ApiClient.delete on correct endpoint', () async {
      when(() => mockApiClient.delete(any()))
          .thenAnswer((_) async => {'success': true});

      await repository.deleteTransactionHistory('r1');
      verify(() => mockApiClient.delete('/api/transaction/history')).called(1);
    });

    test('deleteTransactionHistory propagates exception on failure', () async {
      when(() => mockApiClient.delete(any()))
          .thenThrow(Exception('Delete failed'));

      expect(() => repository.deleteTransactionHistory('r1'), throwsException);
    });

    test('deleteTransactionHistory handles missing API response gracefully if no return required', () async {
      when(() => mockApiClient.delete(any()))
          .thenAnswer((_) async => <String, dynamic>{});

      await repository.deleteTransactionHistory('r1');
      verify(() => mockApiClient.delete('/api/transaction/history')).called(1);
    });
  });
}
