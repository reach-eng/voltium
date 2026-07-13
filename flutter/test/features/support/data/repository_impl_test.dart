import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/support/data/repository_impl.dart';

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}

class FakeCreateTicketRequest extends Fake implements CreateTicketRequest {}

void main() {
  late MockVoltiumApiClient mockVoltiumApiClient;
  late SupportRepositoryImpl repository;

  setUpAll(() {
    registerFallbackValue(FakeCreateTicketRequest());
  });

  setUp(() {
    mockVoltiumApiClient = MockVoltiumApiClient();
    repository = SupportRepositoryImpl(mockVoltiumApiClient);
  });

  group('SupportRepositoryImpl', () {
    // fetchFaqs
    test('fetchFaqs fetches and returns data', () async {
      final mockData = {'faqs': []};
      when(() => mockVoltiumApiClient.getSupportFaqs())
          .thenAnswer((_) async => mockData);

      final result = await repository.fetchFaqs();
      expect(result, mockData);
      verify(() => mockVoltiumApiClient.getSupportFaqs()).called(1);
    });

    test('fetchFaqs propagates exception on error', () async {
      when(() => mockVoltiumApiClient.getSupportFaqs())
          .thenThrow(Exception('API error'));

      expect(() => repository.fetchFaqs(), throwsException);
    });

    test('fetchFaqs returns properly populated faqs list', () async {
      final mockData = {
        'faqs': [
          {'q': 'What?', 'a': 'Nothing'}
        ]
      };
      when(() => mockVoltiumApiClient.getSupportFaqs())
          .thenAnswer((_) async => mockData);

      final result = await repository.fetchFaqs();
      expect((result['faqs'] as List).length, 1);
    });

    // fetchTickets
    test('fetchTickets fetches and returns tickets list', () async {
      final mockData = {'tickets': []};
      when(() => mockVoltiumApiClient.getSupportTickets())
          .thenAnswer((_) async => mockData);

      final result = await repository.fetchTickets();
      expect(result, mockData);
      verify(() => mockVoltiumApiClient.getSupportTickets()).called(1);
    });

    test('fetchTickets propagates exceptions', () async {
      when(() => mockVoltiumApiClient.getSupportTickets())
          .thenThrow(Exception('API error'));

      expect(() => repository.fetchTickets(), throwsException);
    });

    test('fetchTickets handles null or empty safely', () async {
      when(() => mockVoltiumApiClient.getSupportTickets())
          .thenAnswer((_) async => <String, dynamic>{});

      final result = await repository.fetchTickets();
      expect(result.isEmpty, true);
    });

    // createTicket
    test('createTicket maps parameters correctly and returns json', () async {
      final mockResponse = TicketResponse(id: 't1', status: 'OPEN');
      when(() => mockVoltiumApiClient.postSupportTickets(any()))
          .thenAnswer((_) async => mockResponse);

      final result = await repository.createTicket(
        'Billing',
        'Charge issue',
        'Wrong charge',
        riderId: 'r1',
        priority: 'HIGH',
      );

      expect(result['id'], 't1');
      expect(result['status'], 'OPEN');

      final captured =
          verify(() => mockVoltiumApiClient.postSupportTickets(captureAny()))
              .captured;
      final request = captured.first as CreateTicketRequest;
      expect(request.category, 'Billing');
      expect(request.subject, 'Charge issue');
      expect(request.message, 'Wrong charge');
      expect(request.riderId, 'r1');
      expect(request.priority, 'HIGH');
    });

    test('createTicket uses default priority and riderId if not provided',
        () async {
      final mockResponse = TicketResponse(id: 't2');
      when(() => mockVoltiumApiClient.postSupportTickets(any()))
          .thenAnswer((_) async => mockResponse);

      await repository.createTicket('App', 'Crash', 'App crashed');

      final captured =
          verify(() => mockVoltiumApiClient.postSupportTickets(captureAny()))
              .captured;
      final request = captured.first as CreateTicketRequest;
      expect(request.riderId, '');
      expect(request.priority, 'MEDIUM');
    });

    test('createTicket propagates exception when API fails', () async {
      when(() => mockVoltiumApiClient.postSupportTickets(any()))
          .thenThrow(Exception('Create ticket error'));

      expect(
        () => repository.createTicket('cat', 'subj', 'msg'),
        throwsException,
      );
    });

    // getSupportChat
    test('getSupportChat calls API and returns data', () async {
      final mockData = {'messages': []};
      when(() => mockVoltiumApiClient.getSupportChat())
          .thenAnswer((_) async => mockData);

      final result = await repository.getSupportChat();
      expect(result, mockData);
      verify(() => mockVoltiumApiClient.getSupportChat()).called(1);
    });

    test('getSupportChat propagates API exception', () async {
      when(() => mockVoltiumApiClient.getSupportChat())
          .thenThrow(Exception('Chat error'));

      expect(() => repository.getSupportChat(), throwsException);
    });

    test('getSupportChat handles missing keys gracefully', () async {
      when(() => mockVoltiumApiClient.getSupportChat())
          .thenAnswer((_) async => {'foo': 'bar'});
      final result = await repository.getSupportChat();
      expect(result['messages'], null);
      expect(result['foo'], 'bar');
    });

    // sendChatMessage
    test('sendChatMessage sends payload correctly', () async {
      when(() => mockVoltiumApiClient.postSupportChat(any()))
          .thenAnswer((_) async => {});

      await repository.sendChatMessage('Hello there');

      final captured =
          verify(() => mockVoltiumApiClient.postSupportChat(captureAny()))
              .captured;
      final payload = captured.first as Map<String, dynamic>;
      expect(payload['message'], 'Hello there');
    });

    test('sendChatMessage throws when API throws', () async {
      when(() => mockVoltiumApiClient.postSupportChat(any()))
          .thenThrow(Exception('Send chat error'));

      expect(() => repository.sendChatMessage('Hi'), throwsException);
    });

    test('sendChatMessage supports empty string', () async {
      when(() => mockVoltiumApiClient.postSupportChat(any()))
          .thenAnswer((_) async => {});

      await repository.sendChatMessage('');
      final captured =
          verify(() => mockVoltiumApiClient.postSupportChat(captureAny()))
              .captured;
      expect((captured.first as Map)['message'], '');
    });
  });
}
