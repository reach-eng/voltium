import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import '../domain/repository.dart';

class SupportRepositoryImpl implements SupportRepository {
  final VoltiumApiClient _apiClient;

  SupportRepositoryImpl(this._apiClient);

  @override
  Future<Map<String, dynamic>> fetchFaqs() async {
    return _apiClient.getSupportFaqs();
  }

  @override
  Future<Map<String, dynamic>> fetchTickets() async {
    return _apiClient.getSupportTickets();
  }

  @override
  Future<Map<String, dynamic>> createTicket(String category, String subject, String message) async {
    final req = CreateTicketRequest(
      category: category,
      subject: subject,
      message: message,
    );
    final response = await _apiClient.postSupportTickets(req);
    return response.toJson();
  }

  @override
  Future<Map<String, dynamic>> getSupportChat() async {
    return _apiClient.getSupportChat();
  }

  @override
  Future<void> sendChatMessage(String message) async {
    await _apiClient.postSupportChat({'message': message});
  }
}
