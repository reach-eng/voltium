import 'package:flutter/material.dart';
import 'package:voltium_rider/features/support/domain/entity.dart';


class TicketDetailScreen extends StatelessWidget {
  final TicketEntity ticket;

  const TicketDetailScreen({super.key, required this.ticket});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(ticket.ticketId),
        backgroundColor: Colors.white,
        elevation: 0,
        foregroundColor: Colors.black87,
      ),
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          // Original Complaint
          Text(
            'Issue: ${ticket.subject}',
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            ticket.message,
            style: const TextStyle(fontSize: 14, color: Colors.black87),
          ),
          const Divider(height: 32),

          const Text(
            'Resolution History:',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 12),

          if (ticket.messages.isEmpty)
            const Text(
              'No remarks yet.',
              style: TextStyle(color: Colors.grey, fontStyle: FontStyle.italic),
            ),

          // Timeline of Admin Remarks vs Rider Messages
          ...ticket.messages.map((msg) {
            final isAdmin = msg.senderType == 'ADMIN';

            return Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: isAdmin ? Colors.blue.shade50 : Colors.grey.shade100,
                borderRadius: BorderRadius.circular(12),
                border:
                    isAdmin ? Border.all(color: Colors.blue.shade200) : null,
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isAdmin ? 'Support Team' : 'You',
                    style: TextStyle(
                      fontWeight: FontWeight.bold,
                      color: isAdmin ? Colors.blue.shade800 : Colors.black87,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(msg.message),
                  const SizedBox(height: 4),
                  Text(
                    _formatDate(msg.createdAt),
                    style: TextStyle(fontSize: 10, color: Colors.grey.shade600),
                  )
                ],
              ),
            );
          }),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year} ${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}
