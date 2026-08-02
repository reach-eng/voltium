import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class GuarantorVideoProofCard extends StatelessWidget {
  final bool videoUploaded;
  final String? videoPath;
  final VoidCallback onTap;

  const GuarantorVideoProofCard({
    super.key,
    required this.videoUploaded,
    required this.videoPath,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: [
          BoxShadow(
            color: colors.onSurface.withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: colors.surface, width: 1),
      ),
      padding: Spacing.paddingLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'CONSENT VIDEO (COMPULSORY)',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.5),
          ),
          SizedBox(height: 4),
          Text(
            'Record a 5-sec video holding ID, saying "I agree to be the guarantor for [Rider Name]"',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: colors.onSurfaceMuted,
            ),
          ),
          SizedBox(height: 24),
          GestureDetector(
            key: const Key('guarantorVideoTile'),
            onTap: onTap,
            child: Container(
              height: 140,
              decoration: BoxDecoration(
                color: videoUploaded
                    ? AppColors.success.withValues(alpha: 0.1)
                    : colors.surface,
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(
                  color:
                      videoUploaded ? AppColors.success : colors.outlineVariant,
                  width: videoUploaded ? 1 : 2,
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      videoUploaded ? Icons.check_circle : Icons.videocam,
                      color: videoUploaded
                          ? AppColors.success
                          : colors.onSurfaceMuted,
                      size: 36,
                    ),
                    SizedBox(height: 8),
                    Text(
                      videoUploaded ? 'Video Recorded' : 'Record Consent Video',
                      style: AppTypography.bodyMedium
                          .copyWith(fontWeight: FontWeight.w600)
                          .copyWith(
                              color: videoUploaded
                                  ? AppColors.success
                                  : colors.onSurface),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
