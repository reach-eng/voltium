import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';

class MockApiClient extends Mock implements ApiClient {}

void main() {
  late MockApiClient mockApiClient;
  late VoltiumApiService service;

  setUp(() {
    mockApiClient = MockApiClient();
    service = VoltiumApiService.withClient(mockApiClient);
  });

  group('sendOtp', () {
    test('posts to /api/auth/send-otp with phone', () async {
      final expected = {'exists': false, 'otp': '123456'};
      when(() => mockApiClient.post('/api/auth/send-otp', body: any(named: 'body')))
          .thenAnswer((_) async => expected);

      final result = await service.sendOtp(phone: '9876543210');

      expect(result, expected);
      verify(() => mockApiClient.post(
            '/api/auth/send-otp',
            body: {'phone': '9876543210'},
          )).called(1);
    });
  });

  group('verifyOtp', () {
    test('posts to /api/auth/verify-otp with phone and otp', () async {
      final expected = {'riderId': 'VF-RD-001', 'token': 'jwt-token'};
      when(() => mockApiClient.post('/api/auth/verify-otp', body: any(named: 'body')))
          .thenAnswer((_) async => expected);

      final result = await service.verifyOtp(phone: '9876543210', otp: '123456');

      expect(result, expected);
      verify(() => mockApiClient.post(
            '/api/auth/verify-otp',
            body: {'phone': '9876543210', 'otp': '123456'},
          )).called(1);
    });
  });

  group('verifyPhone', () {
    test('posts to /api/auth/verify-phone with phone and otp', () async {
      when(() => mockApiClient.post('/api/auth/verify-phone', body: any(named: 'body')))
          .thenAnswer((_) async => {'verified': true});

      final result = await service.verifyPhone(phone: '9876543210', otp: '123456');

      expect(result, {'verified': true});
      verify(() => mockApiClient.post(
            '/api/auth/verify-phone',
            body: {'phone': '9876543210', 'otp': '123456'},
          )).called(1);
    });
  });

  group('fetchRiderProfile', () {
    test('returns rider profile json', () async {
      final expected = {'riderId': 'VF-RD-001', 'name': 'Test Rider'};
      when(() => mockApiClient.get('/api/rider/profile'))
          .thenAnswer((_) async => expected);

      final result = await service.fetchRiderProfile();

      expect(result, expected);
      verify(() => mockApiClient.get('/api/rider/profile')).called(1);
    });
  });

  group('fetchTransactionHistory', () {
    test('passes page and limit as query params', () async {
      when(() => mockApiClient.get(
            '/api/transaction/history',
            queryParams: any(named: 'queryParams'),
          )).thenAnswer((_) async => {'transactions': []});

      final result = await service.fetchTransactionHistory(riderId: 'VF-RD-001', page: 2, limit: 10);

      expect(result, {'transactions': []});
      verify(() => mockApiClient.get(
            '/api/transaction/history',
            queryParams: {'page': '2', 'limit': '10'},
          )).called(1);
    });

    test('uses default page=1 and limit=20', () async {
      when(() => mockApiClient.get(
            '/api/transaction/history',
            queryParams: any(named: 'queryParams'),
          )).thenAnswer((_) async => {'transactions': []});

      await service.fetchTransactionHistory(riderId: 'VF-RD-001');

      verify(() => mockApiClient.get(
            '/api/transaction/history',
            queryParams: {'page': '1', 'limit': '20'},
          )).called(1);
    });
  });

  group('submitTopUp', () {
    test('sends CASH topup', () async {
      when(() => mockApiClient.post('/api/transaction/topup', body: any(named: 'body')))
          .thenAnswer((_) async => {'status': 'success'});

      final result = await service.submitTopUp(
        riderId: 'VF-RD-001',
        amount: 500.0,
        method: 'CASH',
      );

      expect(result, {'status': 'success'});
      verify(() => mockApiClient.post(
            '/api/transaction/topup',
            body: {
              'riderId': 'VF-RD-001',
              'amount': 500.0,
              'method': 'CASH',
              'purpose': 'TOP_UP',
            },
          )).called(1);
    });

    test('sends UPI topup with optional ref', () async {
      when(() => mockApiClient.post('/api/transaction/topup', body: any(named: 'body')))
          .thenAnswer((_) async => {'status': 'success'});

      await service.submitTopUp(
        riderId: 'VF-RD-001',
        amount: 250.0,
        method: 'UPI',
        upiRef: 'upi-ref-123',
      );

      verify(() => mockApiClient.post(
            '/api/transaction/topup',
            body: {
              'riderId': 'VF-RD-001',
              'amount': 250.0,
              'method': 'UPI',
              'upiRef': 'upi-ref-123',
              'purpose': 'TOP_UP',
            },
          )).called(1);
    });
  });

  group('fetchPlans / subscribePlan', () {
    test('fetchPlans calls /api/rider/plans', () async {
      when(() => mockApiClient.get('/api/rider/plans'))
          .thenAnswer((_) async => {'plans': []});

      expect(await service.fetchPlans(), {'plans': []});
    });

    test('subscribePlan posts plan data', () async {
      when(() => mockApiClient.post('/api/rider/plans', body: any(named: 'body')))
          .thenAnswer((_) async => {'status': 'subscribed'});

      final result = await service.subscribePlan(
        hubId: 'hub-1',
        planId: 'plan-1',
        securityDeposit: 500.0,
      );

      expect(result, {'status': 'subscribed'});
      verify(() => mockApiClient.post(
            '/api/rider/plans',
            body: {'hubId': 'hub-1', 'planId': 'plan-1', 'securityDeposit': 500.0},
          )).called(1);
    });
  });

  group('session refresh', () {
    test('refreshSession posts to /api/auth/refresh', () async {
      when(() => mockApiClient.post('/api/auth/refresh', body: any(named: 'body')))
          .thenAnswer((_) async => {'token': 'new-jwt'});

      final result = await service.refreshSession('old-token');

      expect(result, {'token': 'new-jwt'});
      verify(() => mockApiClient.post(
            '/api/auth/refresh',
            body: {'refreshToken': 'old-token'},
          )).called(1);
    });
  });

  group('sync helpers', () {
    test('syncDeviceData posts type and data', () async {
      when(() => mockApiClient.post('/api/rider/sync/device-data', body: any(named: 'body')))
          .thenAnswer((_) async => {'status': 'ok'});

      await service.syncDeviceData(type: 'location', data: {'lat': 12.34});

      verify(() => mockApiClient.post(
            '/api/rider/sync/device-data',
            body: {'type': 'location', 'data': {'lat': 12.34}},
          )).called(1);
    });

    test('syncPermissionState posts device permissions', () async {
      when(() => mockApiClient.post('/api/rider/device/permissions', body: any(named: 'body')))
          .thenAnswer((_) async => {'status': 'ok'});

      await service.syncPermissionState(
        riderId: 'VF-RD-001',
        permissions: {'location': true},
      );

      verify(() => mockApiClient.post(
            '/api/rider/device/permissions',
            body: {'riderId': 'VF-RD-001', 'permissions': {'location': true}},
          )).called(1);
    });

    test('submitVehicleReturn posts vehicle return', () async {
      when(() => mockApiClient.post('/api/rider/rental/return', body: any(named: 'body')))
          .thenAnswer((_) async => {'status': 'returned'});

      final result = await service.submitVehicleReturn(
        riderId: 'VF-RD-001',
        photoUrls: ['https://cdn.example.com/photo1.jpg'],
      );

      expect(result, {'status': 'returned'});
      verify(() => mockApiClient.post(
            '/api/rider/rental/return',
            body: {
              'riderId': 'VF-RD-001',
              'photoUrls': ['https://cdn.example.com/photo1.jpg'],
            },
          )).called(1);
    });
  });

  group('raw get / post', () {
    test('get delegates with optional queryParams', () async {
      when(() => mockApiClient.get('/custom', queryParams: any(named: 'queryParams')))
          .thenAnswer((_) async => {'result': 'ok'});

      expect(await service.get('/custom', queryParams: {'a': '1'}), {'result': 'ok'});
    });

    test('post delegates with optional body', () async {
      when(() => mockApiClient.post('/custom', body: any(named: 'body')))
          .thenAnswer((_) async => {'result': 'ok'});

      expect(await service.post('/custom', body: {'key': 'val'}), {'result': 'ok'});
    });
  });

  group('singleton', () {
    test('factory returns same instance', () {
      VoltiumApiService.instance = null;
      final a = VoltiumApiService();
      final b = VoltiumApiService();
      expect(identical(a, b), isTrue);
    });
  });
}
