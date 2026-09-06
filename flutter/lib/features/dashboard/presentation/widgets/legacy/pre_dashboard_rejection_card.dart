import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Custom rejection card for the KYC rejection flow on the
/// pre-dashboard. Distinct from the standard [RejectionCard] used
/// for plan/deposit rejections because the KYC rejection needs a
/// larger title + icon badge layout and a fixed "Re-upload
/// Documents" CTA that goes back to the user form.
///
/// This widget is intentionally its own thing rather than a flag on
/// the standard [RejectionCard] because the layout diverges
/// significantly (icon badge with backdrop, larger title, hardcoded
/// fallback copy).
class PreDashboardKycRejectionCard extends StatelessWidget {
  /// Optional KYC rejection reason from the rider. When null/empty
  /// a sensible fallback is shown.
  final String? reason;

  /// Called when the user taps "Re-upload Documents".
  final VoidCallback onResubmit;

  const PreDashboardKycRejectionCard({
    super.key,
    required this.reason,
    required this.onResubmit,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final text = (reason != null && reason!.isNotEmpty)
        ? reason!
        : 'The uploaded PAN card document was blurry and unreadable. '
            'Please ensure all details are clearly visible in the new upload.';
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.of(context).errorRose,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border:
            Border.all(color: AppColors.of(context).errorBorder, width: 1.5),
      ),
      child: Padding(
        padding: Spacing.paddingLg,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.of(context).errorRose,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: const Icon(
                    Icons.error_outline,
                    color: AppColors.error,
                    size: 24,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Rejection Remarks',
                        style: AppTypography.titleLarge
                            .copyWith(color: colors.onSurface),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        text,
                        style: AppTypography.bodyLarge.copyWith(
                            color: colors.onSurfaceVariant, height: 1.4),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onResubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.upload_file, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      'Re-upload Documents',
                      style: AppTypography.titleSmall,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
