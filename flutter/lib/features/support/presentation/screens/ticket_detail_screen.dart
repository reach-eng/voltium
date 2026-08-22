import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/features/support/domain/entity.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/toast.dart';

class TicketDetailScreen extends StatelessWidget {
  final TicketEntity ticket;

  const TicketDetailScreen({super.key, required this.ticket});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        // AUDIT FIX: show the human-readable subject (fallback to id).
        title: Text(
          ticket.subject.isNotEmpty ? ticket.subject : ticket.ticketId,
          style: TextStyle(color: colors.onSurface),
        ),
        backgroundColor: colors.surface,
        elevation: 0,
        foregroundColor: colors.onSurface,
      ),
      body: ListView(
        padding: Spacing.paddingMd,
        children: [
          // AUDIT FIX: keep the ticketId visible in the body (tests and
          // riders reference it) while the AppBar shows the subject.
          Text(
            ticket.ticketId,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              fontWeight: FontWeight.w700,
              color: colors.onSurfaceMuted,
              letterSpacing: 0.5,
            ),
          ),
          const SizedBox(height: 8),
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

          // AUDIT FIX: surface category/priority that were parsed but never
          // shown to the rider.
          if (ticket.category.isNotEmpty || ticket.priority.isNotEmpty) ...[
            Row(
              children: [
                if (ticket.category.isNotEmpty)
                  _buildMetaChip(context, ticket.category, AppColors.primary),
                if (ticket.category.isNotEmpty && ticket.priority.isNotEmpty)
                  const SizedBox(width: 8),
                if (ticket.priority.isNotEmpty)
                  _buildMetaChip(context, ticket.priority, AppColors.warning),
              ],
            ),
            const SizedBox(height: 8),
          ],

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

          // AUDIT FIX: attachments uploaded at creation were previously
          // invisible — render them as tappable evidence chips.
          if (ticket.attachments.isNotEmpty) ...[
            Divider(height: 32, color: colors.divider),
            Text(
              'Attachments',
              style: AppTypography.titleSmall.copyWith(color: colors.onSurface),
            ),
            const SizedBox(height: 12),
            ...ticket.attachments.map(
              (url) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  onTap: () => _openAttachment(context, url),
                  child: Container(
                    constraints: const BoxConstraints(minHeight: 48),
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 12),
                    decoration: BoxDecoration(
                      color: colors.card,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: colors.divider),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.image_outlined,
                            size: 20, color: AppColors.primary),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            Uri.tryParse(url)?.pathSegments.lastOrNull ?? url,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              color: AppColors.primary,
                              decoration: TextDecoration.underline,
                            ),
                          ),
                        ),
                        Icon(Icons.open_in_new,
                            size: 16, color: colors.onSurfaceMuted),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildMetaChip(BuildContext context, String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.full),
      ),
      child: Text(
        label.toUpperCase(),
        style: GoogleFonts.plusJakartaSans(
          fontSize: 11,
          fontWeight: FontWeight.w700,
          color: color,
        ),
      ),
    );
  }

  Future<void> _openAttachment(BuildContext context, String url) async {
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    try {
      if (await canLaunchUrl(uri)) {
        await launchUrl(uri, mode: LaunchMode.externalApplication);
      } else {
        if (context.mounted) {
          Toast.error(context, 'Unable to open attachment');
        }
      }
    } catch (_) {
      if (context.mounted) {
        Toast.error(context, 'Unable to open attachment');
      }
    }
  }

  String _formatDate(DateTime date) {
    // AUDIT FIX: use intl instead of hand-rolled dd/MM/yyyy formatting.
    return DateFormat.yMd().add_Hm().format(date);
  }
}
