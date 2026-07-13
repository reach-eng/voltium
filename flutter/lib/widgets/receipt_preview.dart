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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final isCredit = type.toUpperCase() == 'CREDIT';

    return Container(
      margin: const EdgeInsets.all(16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: isDark ? AppColors.slate800 : Colors.white,
        borderRadius: BorderRadius.circular(20),
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
                    style: AppTypography.overline
                        .copyWith(color: Colors.grey[500], letterSpacing: 1.5),
                  ),
                  SizedBox(height: 4),
                  Text(
                    '#${transactionId.substring(0, 8).toUpperCase()}',
                    style: AppTypography.bodyMediumEmphasis.copyWith(
                        color: isDark ? Colors.white : Colors.grey[800]),
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
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Text(
                  type.toUpperCase(),
                  style: AppTypography.microLabel.copyWith(
                      color: isCredit ? AppColors.success : AppColors.error),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          const Divider(),
          const SizedBox(height: 16),
          _buildRow('Date', _formatDate(date), isDark),
          _buildRow('Time', _formatTime(date), isDark),
          if (riderName != null) _buildRow('Rider', riderName!, isDark),
          if (vehicleNumber != null)
            _buildRow('Vehicle', vehicleNumber!, isDark),
          SizedBox(height: 16),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: isCredit
                  ? AppColors.success.withValues(alpha: 0.08)
                  : AppColors.error.withValues(alpha: 0.08),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isCredit ? 'Amount Credited' : 'Amount Debited',
                  style: AppTypography.bodyMediumEmphasis.copyWith(
                      color: isDark ? Colors.white : Colors.grey[800]),
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
                style: AppTypography.bodySmallEmphasis
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
              color: Colors.grey[500],
            ),
          ),
          Text(
            value,
            style: AppTypography.bodyMedium
                .copyWith(color: isDark ? Colors.white : Colors.grey[800]),
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
      padding: const EdgeInsets.all(16),
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
