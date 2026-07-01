import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/support/data/repository_impl.dart';

class MockVoltiumApiClient extends Mock implements VoltiumApiClient {}
class FakeCreateTicketRequest extends Fake implements CreateTicketRequest {}

void main() {
  late MockVoltiumApiClient mockApiClient;
  late SupportRepositoryImpl repository;

  setUpAll(() {
    registerFallbackValue(FakeCreateTicketRequest());
  });

  setUp(() {
    mockApiClient = MockVoltiumApiClient();
    repository = SupportRepositoryImpl(mockApiClient);
  });

  group('SupportRepositoryImpl', () {
    test('fetchFaqs calls getSupportFaqs', () async {
      when(() => mockApiClient.getSupportFaqs())
          .thenAnswer((_) async => {'faqs': []});

      final result = await repository.fetchFaqs();
      expect(result['faqs'], isEmpty);
      verify(() => mockApiClient.getSupportFaqs()).called(1);
    });

    test('fetchTickets calls getSupportTickets', () async {
      when(() => mockApiClient.getSupportTickets())
          .thenAnswer((_) async => {'tickets': []});

      final result = await repository.fetchTickets();
      expect(result['tickets'], isEmpty);
      verify(() => mockApiClient.getSupportTickets()).called(1);
    });

    test('createTicket calls postSupportTickets', () async {
      when(() => mockApiClient.postSupportTickets(any()))
          .thenAnswer((_) async => TicketResponse(id: 't123'));

      final result = await repository.createTicket(
        'BILLING',
        'Issue with payment',
        'Help me',
        riderId: 'r123',
      );

      expect(result['id'], 't123');
      final captured = verify(() => mockApiClient.postSupportTickets(captureAny())).captured;
      final req = captured.first as CreateTicketRequest;
      expect(req.category, 'BILLING');
      expect(req.subject, 'Issue with payment');
      expect(req.message, 'Help me');
      expect(req.riderId, 'r123');
    });

    test('getSupportChat calls getSupportChat', () async {
      when(() => mockApiClient.getSupportChat())
          .thenAnswer((_) async => {'messages': []});

      final result = await repository.getSupportChat();
      expect(result['messages'], isEmpty);
      verify(() => mockApiClient.getSupportChat()).called(1);
    });

    test('sendChatMessage calls postSupportChat', () async {
      when(() => mockApiClient.postSupportChat(any()))
          .thenAnswer((_) async => {});

      await repository.sendChatMessage('Hello there');

      final captured = verify(() => mockApiClient.postSupportChat(captureAny())).captured;
      final req = captured.first as Map<String, dynamic>;
      expect(req['message'], 'Hello there');
    });
  });
}
