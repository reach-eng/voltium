import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class ReceiptPreview extends StatelessWidget {
  final String transactionId;
  final DateTime date;
  final String type;
  final int amount;
  final String? vehicleNumber;
  final String? riderName;

  const ReceiptPreview({
    super.key,
    required this.transactionId,
    required this.date,
    required this.type,
    required this.amount,
    this.vehicleNumber,
    this.riderName,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final isCredit = type.toUpperCase() == 'CREDIT';

    return Container(
      margin: Spacing.paddingMd,
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Transaction Receipt',
                    style: AppTypography.overline.copyWith(
                        color: AppColors.of(context).onSurfaceMuted,
                        letterSpacing: 1.5),
                  ),
                  SizedBox(height: 4),
                  Text(
                    // AUDIT FIX: guard substring against short ids.
                    '#${transactionId.length >= 8 ? transactionId.substring(0, 8).toUpperCase() : transactionId.toUpperCase()}',
                    style: AppTypography.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(color: colors.onSurface),
                  ),
                ],
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                decoration: BoxDecoration(
                  color: isCredit
                      ? AppColors.success.withValues(alpha: 0.1)
                      : AppColors.error.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppRadius.full),
                ),
                child: Text(
                  type.toUpperCase(),
                  style: AppTypography.labelSmall.copyWith(
                      color: isCredit ? AppColors.success : AppColors.error),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 16),
          _buildRow(context, 'Date', _formatDate(date)),
          _buildRow(context, 'Time', _formatTime(date)),
          if (riderName != null) _buildRow(context, 'Rider', riderName!),
          if (vehicleNumber != null)
            _buildRow(context, 'Vehicle', vehicleNumber!),
          const SizedBox(height: 16),
          Container(
            padding: Spacing.paddingMd,
            decoration: BoxDecoration(
              color: isCredit
                  ? AppColors.success.withValues(alpha: 0.08)
                  : AppColors.error.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isCredit ? 'Amount Credited' : 'Amount Debited',
                  style: AppTypography.bodyMedium
                      .copyWith(fontWeight: FontWeight.w600)
                      .copyWith(color: colors.onSurface),
                ),
                Text(
                  '₹${(amount / 100).toStringAsFixed(2)}',
                  style: AppTypography.headingMedium.copyWith(
                      color: isCredit ? AppColors.success : AppColors.error),
                ),
              ],
            ),
          ),
          SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.bolt,
                size: 16,
                color: AppColors.primary,
              ),
              SizedBox(width: 4),
              Text(
                'Voltium',
                style: AppTypography.bodySmall
                    .copyWith(fontWeight: FontWeight.w600)
                    .copyWith(color: AppColors.primary),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildRow(BuildContext context, String label, String value) {
    // PR-10 (2026-08-21): the `isDark` parameter was a leftover from
    // the pre-ThemeColors era; the row's text color now comes from
    // `AppColors.of(context).onSurface` so it reads in both modes.
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 14,
              color: colors.onSurfaceMuted,
            ),
          ),
          Text(
            value,
            style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
          ),
        ],
      ),
    );
  }

  String _formatDate(DateTime date) {
    return '${date.day.toString().padLeft(2, '0')}/${date.month.toString().padLeft(2, '0')}/${date.year}';
  }

  String _formatTime(DateTime date) {
    return '${date.hour.toString().padLeft(2, '0')}:${date.minute.toString().padLeft(2, '0')}';
  }
}

class ReceiptActions extends StatelessWidget {
  final VoidCallback? onShare;
  final VoidCallback? onDownload;
  final VoidCallback? onPrint;

  const ReceiptActions({
    super.key,
    this.onShare,
    this.onDownload,
    this.onPrint,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: Spacing.paddingMd,
      child: Row(
        children: [
          if (onDownload != null)
            Expanded(
              child: OutlinedButton.icon(
                onPressed: onDownload,
                icon: const Icon(Icons.download),
                label: const Text('Save'),
              ),
            ),
          if (onDownload != null && onShare != null) const SizedBox(width: 12),
          if (onShare != null)
            Expanded(
              child: ElevatedButton.icon(
                onPressed: onShare,
                icon: const Icon(Icons.share),
                label: const Text('Share'),
              ),
            ),
        ],
      ),
    );
  }
}
