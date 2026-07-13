import 'package:flutter/material.dart';
import '../models/rider_model.dart';
import '../theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class TopUpRequestSentCard extends StatelessWidget {
  final RiderModel rider;
  final int topUpAmount;
  final VoidCallback onResubmit;

  const TopUpRequestSentCard({
    super.key,
    required this.rider,
    required this.topUpAmount,
    required this.onResubmit,
  });

  @override
  Widget build(BuildContext context) {
    final record = rider.depositRecord;
    final isRejected = record?.status == DepositStatus.rejected;
    final statusText = isRejected ? 'Rejected' : 'Awaiting Admin Approval';
    final statusColor = isRejected ? AppColors.error : AppColors.warning;
    final statusBg =
        isRejected ? AppColors.errorSurface : AppColors.warningSurface;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: AppColors.outlineVariant),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 24,
            offset: Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Top-up Request',
                style: AppTypography.titleSmall
                    .copyWith(color: AppColors.slate800),
              ),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: statusBg,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  statusText.toUpperCase(),
                  style:
                      AppTypography.microOverline.copyWith(color: statusColor),
                ),
              ),
            ],
          ),
          if (isRejected && record?.rejectionReason != null) ...[
            SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: AppColors.errorSurface,
                borderRadius: BorderRadius.circular(12),
                border:
                    Border.all(color: AppColors.error.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  const Icon(Icons.error_outline,
                      color: AppColors.error, size: 16),
                  SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Reason: ${record!.rejectionReason}',
                      style: AppTypography.bodySmall
                          .copyWith(color: AppColors.error),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          _buildRow('Security Deposit', '₹${rider.securityDeposit}'),
          const SizedBox(height: 8),
          _buildRow(
              'Rental Charges', '₹${topUpAmount - rider.securityDeposit}'),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: AppColors.outlineVariant),
          ),
          _buildRow('Total Pending', '₹$topUpAmount', isBold: true),
          if (isRejected) ...[
            SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onResubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12),
                  ),
                  elevation: 0,
                ),
                icon: const Icon(Icons.refresh, size: 18),
                label: Text(
                  'Resubmit Request',
                  style: AppTypography.labelLarge,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildRow(String label, String value, {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            color: isBold ? AppColors.slate800 : AppColors.slate500,
            fontSize: isBold ? 14 : 13,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            color: AppColors.slate800,
            fontSize: isBold ? 16 : 14,
            fontWeight: isBold ? FontWeight.w900 : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
