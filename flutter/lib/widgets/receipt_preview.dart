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
    final isDark = Theme.of(context).brightness == Brightness.dark;
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
                        color: AppColors.onSurfaceMuted, letterSpacing: 1.5),
                  ),
                  SizedBox(height: 4),
                  Text(
                    '#${transactionId.substring(0, 8).toUpperCase()}',
                    style: AppTypography.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(
                            color: isDark ? Colors.white : AppColors.onSurface),
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
          _buildRow(
              'Date', _formatDate(date), colors.onSurfaceMuted.hashCode == 0),
          _buildRow(
              'Time', _formatTime(date), colors.onSurfaceMuted.hashCode == 0),
          if (riderName != null) _buildRow('Rider', riderName!, false),
          if (vehicleNumber != null)
            _buildRow('Vehicle', vehicleNumber!, false),
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
                      .copyWith(
                          color: isDark ? Colors.white : AppColors.onSurface),
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

  Widget _buildRow(String label, String value, bool isDark) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 14,
              color: AppColors.onSurfaceMuted,
            ),
          ),
          Text(
            value,
            style: AppTypography.bodyMedium
                .copyWith(color: isDark ? Colors.white : AppColors.onSurface),
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
