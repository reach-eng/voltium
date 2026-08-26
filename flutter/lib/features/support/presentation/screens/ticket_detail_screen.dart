import 'package:flutter/material.dart';
import 'package:voltium_rider/features/support/domain/entity.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class TicketDetailScreen extends StatelessWidget {
  final TicketEntity ticket;

  const TicketDetailScreen({super.key, required this.ticket});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        title: Text(ticket.ticketId, style: TextStyle(color: colors.onSurface)),
        backgroundColor: colors.surface,
        elevation: 0,
        foregroundColor: colors.onSurface,
      ),
      body: ListView(
        padding: Spacing.paddingMd,
        children: [
          // Original Complaint
          Text(
            'Issue: ${ticket.subject}',
            style: AppTypography.titleSmall.copyWith(color: colors.onSurface),
          ),
          const SizedBox(height: 8),
          Text(
            ticket.message,
            style: GoogleFonts.plusJakartaSans(
                fontSize: 14, color: colors.onSurfaceVariant),
          ),
          Divider(height: 32, color: colors.divider),

          Text(
            'Resolution History:',
            style: AppTypography.titleSmall.copyWith(color: colors.onSurface),
          ),
          const SizedBox(height: 12),

          if (ticket.messages.isEmpty)
            Text(
              'No remarks yet.',
              style: GoogleFonts.plusJakartaSans(
                  color: colors.onSurfaceMuted, fontStyle: FontStyle.italic),
            ),

          // Timeline of Admin Remarks vs Rider Messages
          ...ticket.messages.map((msg) {
            final isAdmin = msg.senderType == 'ADMIN';

            return Container(
              margin: const EdgeInsets.symmetric(vertical: 8),
              padding: const EdgeInsets.all(Spacing.sm),
              decoration: BoxDecoration(
                color: isAdmin ? colors.primarySurface : colors.card,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(
                  color: isAdmin ? colors.outline : colors.divider,
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    isAdmin ? 'Support Team' : 'You',
                    style: GoogleFonts.plusJakartaSans(
                      fontWeight: FontWeight.bold,
                      color: isAdmin ? AppColors.primary : colors.onSurface,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    msg.message,
                    style: GoogleFonts.plusJakartaSans(color: colors.onSurface),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _formatDate(msg.createdAt),
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 10, color: colors.onSurfaceMuted),
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
