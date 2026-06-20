import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/support/domain/repository.dart';

/// Implementation of [SupportRepository] using the Voltium API.
class SupportRepositoryImpl implements SupportRepository {
  final VoltiumApiClient _apiClient;

  SupportRepositoryImpl(this._apiClient);

  @override
  Future<Map<String, dynamic>> fetchFaqs() async {
    return await _apiClient.getSupportFaqs();
  }

  @override
  Future<Map<String, dynamic>> fetchTickets() async {
    return await _apiClient.getSupportTickets();
  }

  @override
  Future<Map<String, dynamic>> createTicket(
      String category, String subject, String message) async {
    final request = CreateTicketRequest(
      category: category,
      subject: subject,
      message: message,
    );
    final response = await _apiClient.postSupportTickets(request);
    return response.toJson();
  }

  @override
  Future<Map<String, dynamic>> getSupportChat() async {
    return await _apiClient.getSupportChat();
  }

  @override
  Future<void> sendChatMessage(String message) async {
    await _apiClient.postSupportChat({'message': message});
  }
}
