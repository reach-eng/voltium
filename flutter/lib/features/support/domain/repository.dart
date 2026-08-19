/// Abstract repository for customer support operations.
abstract class SupportRepository {
  /// Fetches FAQs.
  Future<Map<String, dynamic>> fetchFaqs();

  /// Fetches customer support tickets.
  Future<Map<String, dynamic>> fetchTickets();

  /// Creates a support ticket.
  ///
  /// [attachments] is an optional URL (storage path) of a photo the rider
  /// uploaded as evidence for the ticket (SUPPORT P0-4).
  Future<Map<String, dynamic>> createTicket(
    String category,
    String subject,
    String message, {
    String riderId = '',
    String priority = 'MEDIUM',
    String? attachments,
  });
}
