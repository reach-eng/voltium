import 'package:flutter/material.dart';
import '../../../models/rider_model.dart';
import '../../../theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/config/app_config.dart';

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
    final colors = AppColors.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final record = rider.depositRecord;
    final isRejected = record?.status == DepositStatus.rejected;
    final statusText = isRejected ? 'Rejected' : 'Awaiting Admin Approval';
    final statusColor = isRejected
        ? (isDark ? colors.errorLightForeground : AppColors.error)
        : (isDark ? colors.warningLightForeground : AppColors.warningDark);
    final statusBg = isRejected ? colors.errorLight : colors.warningLight;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.outlineVariant),
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
                style:
                    AppTypography.titleSmall.copyWith(color: colors.onSurface),
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
            const SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.all(Spacing.sm),
              decoration: BoxDecoration(
                color: colors.errorLight,
                borderRadius: BorderRadius.circular(AppRadius.md),
                border: Border.all(color: colors.error.withValues(alpha: 0.2)),
              ),
              child: Row(
                children: [
                  Icon(Icons.error_outline,
                      color: isDark
                          ? colors.errorLightForeground
                          : AppColors.error,
                      size: 16),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      'Reason: ${record!.rejectionReason}',
                      style: AppTypography.bodySmall.copyWith(
                          color: isDark
                              ? colors.errorLightForeground
                              : AppColors.error),
                    ),
                  ),
                ],
              ),
            ),
          ],
          const SizedBox(height: 16),
          _buildRow(context, 'Security Deposit', '₹${rider.securityDeposit}'),
          const SizedBox(height: 8),
          _buildRow(context, 'Rental Charges',
              '₹${topUpAmount - rider.securityDeposit}'),
          const Padding(
            padding: EdgeInsets.symmetric(vertical: 12),
            child: Divider(height: 1, color: AppColors.outlineVariant),
          ),
          _buildRow(context, 'Total Pending', '₹$topUpAmount', isBold: true),
          if (record?.proofUrl != null && record!.proofUrl!.isNotEmpty) ...[
            const SizedBox(height: 12),
            Row(
              children: [
                Text(
                  'Uploaded Proof:',
                  style: GoogleFonts.plusJakartaSans(
                    color: AppColors.of(context).onSurfaceVariant,
                    fontSize: 13,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const Spacer(),
                Builder(
                  builder: (ctx) {
                    var imgUrl = record.proofUrl!;
                    // PR-7 (F-065): single source of truth for the
                    // dev host. Was a `Platform.isAndroid ? ... : ...`
                    // ternary that drifted from api_client.dart.
                    final host = AppConfig.localDevHost;
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
                        cacheWidth: 150,
                        cacheHeight: 150,
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

  Widget _buildRow(BuildContext context, String label, String value,
      {bool isBold = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.plusJakartaSans(
            // DARK-MODE-AUDIT 2026-08-14 P0-7: same.
            color: isBold
                ? AppColors.of(context).onSurface
                : AppColors.of(context).onSurfaceVariant,
            fontSize: isBold ? 14 : 13,
            fontWeight: isBold ? FontWeight.bold : FontWeight.w500,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.plusJakartaSans(
            // DARK-MODE-AUDIT 2026-08-14 P0-7: same.
            color: AppColors.of(context).onSurface,
            fontSize: isBold ? 16 : 14,
            fontWeight: isBold ? FontWeight.w800 : FontWeight.w600,
          ),
        ),
      ],
    );
  }
}
