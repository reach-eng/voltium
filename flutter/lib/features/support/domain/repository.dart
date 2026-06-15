import '../domain/entity.dart';

/// Abstract repository for customer support operations.
abstract class SupportRepository {
  /// Fetches FAQs.
  Future<Map<String, dynamic>> fetchFaqs();

  /// Fetches customer support tickets.
  Future<Map<String, dynamic>> fetchTickets();

  /// Creates a support ticket.
  Future<Map<String, dynamic>> createTicket(String category, String subject, String message);

  /// Fetches support chat history.
  Future<Map<String, dynamic>> getSupportChat();

  /// Sends a support chat message.
  Future<void> sendChatMessage(String message);
}
