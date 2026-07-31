import 'package:flutter/material.dart';
import 'package:universal_io/io.dart';
import '../../../models/rider_model.dart';
import '../../../theme/app_theme.dart';
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
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.outlineVariant),
        boxShadow: const [
          BoxShadow(
            color: AppColors.shadowSoftColor,
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
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(
                  statusText.toUpperCase(),
                  style: AppTypography.overline.copyWith(color: statusColor),
                ),
              ),
            ],
          ),
          if (isRejected && record?.rejectionReason != null) ...[
            SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(Spacing.sm),
              decoration: BoxDecoration(
                color: AppColors.errorSurface,
                borderRadius: BorderRadius.circular(AppRadius.md),
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
          if (record?.proofUrl != null && record!.proofUrl!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Text(
                  'Uploaded Proof:',
                  style: GoogleFonts.plusJakartaSans(
                    color: AppColors.slate500,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                Builder(
                  builder: (ctx) {
                    var imgUrl = record.proofUrl!;
                    final host = Platform.isAndroid ? '10.0.2.2' : '127.0.0.1';
                    if (imgUrl.startsWith('http')) {
                      imgUrl = imgUrl.replaceAll('localhost', host);
                    } else if (imgUrl.startsWith('/')) {
                      imgUrl = 'http://$host:8081$imgUrl';
                    } else {
                      imgUrl = 'http://$host:8081/api/files/download/$imgUrl';
                    }
                    return ClipRRect(
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                      child: Image.network(
                        imgUrl,
                        width: 50,
                        height: 50,
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.image,
                          size: 32,
                          color: AppColors.slate400,
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ],
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
                    borderRadius: BorderRadius.circular(AppRadius.md),
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
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
