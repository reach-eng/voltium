/// Support ticket status matching backend state machine.
enum TicketStatus { open, assigned, inProgress, resolved, closed }

/// Support domain entity.
class TicketEntity {
  final String id;
  final String ticketId;
  final String category;
  final String priority;
  final String subject;
  final String message;
  final TicketStatus status;
  final DateTime createdAt;
  final DateTime updatedAt;
  final List<TicketMessageEntity> messages;

  /// AUDIT FIX: photo evidence URLs uploaded at ticket creation were sent
  /// to the server but never surfaced — riders couldn't see their own
  /// attachments. Parsed from `attachments` (string array of URLs).
  final List<String> attachments;

  const TicketEntity({
    required this.id,
    required this.ticketId,
    this.category = '',
    this.priority = 'MEDIUM',
    required this.subject,
    this.message = '',
    this.status = TicketStatus.open,
    required this.createdAt,
    required this.updatedAt,
    this.messages = const [],
    this.attachments = const [],
  });

  factory TicketEntity.fromJson(Map<String, dynamic> json) {
    final effectiveId =
        (json['id'] as String?) ?? (json['ticketId'] as String?) ?? '';
    final effectiveTicketId = (json['ticketId'] as String?) ?? effectiveId;
    return TicketEntity(
      id: effectiveId,
      ticketId: effectiveTicketId,
      category: json['category'] as String? ?? '',
      priority: json['priority'] as String? ?? 'MEDIUM',
      subject: json['subject'] as String? ?? '',
      message: json['message'] as String? ?? '',
      status: _parseStatus(json['status'] as String?),
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      updatedAt: DateTime.tryParse(json['updatedAt'] as String? ?? '') ??
          DateTime.now(),
      messages: (json['messages'] as List<dynamic>?)
              ?.map(
                (m) => TicketMessageEntity.fromJson(m as Map<String, dynamic>),
              )
              .toList() ??
          [],
      // AUDIT FIX (P0 data-population): the server stores attachments as
      // a CSV string ("url1,url2"), not a JSON array. The old cast to
      // List<dynamic> threw TypeError, crashing the ENTIRE ticket list.
      attachments: _parseAttachments(json['attachments']),
    );
  }

  /// AUDIT FIX (P0): parse attachments from either a CSV string
  /// (the server-side storage format) or a JSON array (defensive).
  static List<String> _parseAttachments(dynamic raw) {
    if (raw == null) return [];
    if (raw is List) return raw.map((a) => a.toString()).toList();
    if (raw is String && raw.isNotEmpty) {
      return raw.split(',').where((a) => a.trim().isNotEmpty).toList();
    }
    return [];
  }

  static TicketStatus _parseStatus(String? status) {
    switch (status?.toUpperCase()) {
      case 'OPEN':
        return TicketStatus.open;
      case 'ASSIGNED':
        return TicketStatus.assigned;
      case 'IN_PROGRESS':
        return TicketStatus.inProgress;
      case 'RESOLVED':
        return TicketStatus.resolved;
      case 'CLOSED':
        return TicketStatus.closed;
      default:
        return TicketStatus.open;
    }
  }
}

/// Ticket message entity.
class TicketMessageEntity {
  final String id;
  final String senderId;
  final String senderType;
  final String message;
  final DateTime createdAt;

  const TicketMessageEntity({
    required this.id,
    this.senderId = '',
    this.senderType = 'RIDER',
    required this.message,
    required this.createdAt,
  });

  factory TicketMessageEntity.fromJson(Map<String, dynamic> json) {
    return TicketMessageEntity(
      id: json['id'] as String,
      senderId: json['senderId'] as String? ?? '',
      senderType: json['senderType'] as String? ?? 'RIDER',
      message: json['message'] as String? ?? '',
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}
