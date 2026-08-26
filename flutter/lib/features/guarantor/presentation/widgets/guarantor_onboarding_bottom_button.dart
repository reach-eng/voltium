import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class GuarantorOnboardingBottomButton extends StatelessWidget {
  final bool canProceed;
  final bool isUploading;
  final String uploadProgressText;
  final String buttonText;
  final VoidCallback? onSubmit;
  final VoidCallback? onSkip;

  const GuarantorOnboardingBottomButton({
    super.key,
    required this.canProceed,
    required this.isUploading,
    this.uploadProgressText = '',
    this.buttonText = 'FINISH SETUP',
    this.onSubmit,
    this.onSkip,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        border: Border(
          top: BorderSide(color: colors.surface, width: 1),
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.04),
            blurRadius: 10,
            offset: const Offset(0, -4),
          ),
        ],
      ),
      padding: const EdgeInsets.only(
        left: 24,
        right: 24,
        top: 16,
        bottom: 24,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              if (onSkip != null) ...[
                SizedBox(
                  height: 48,
                  child: TextButton(
                    key: const Key('skipGuarantorButton'),
                    onPressed: isUploading ? null : onSkip,
                    style: TextButton.styleFrom(
                      foregroundColor: colors.onSurfaceMuted,
                      padding: const EdgeInsets.symmetric(horizontal: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                    ),
                    child: Text('Skip',
                        style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w600)),
                  ),
                ),
                const SizedBox(width: 8),
              ],
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    key: const Key('completeOnboardingButton'),
                    onPressed: (!isUploading && canProceed) ? onSubmit : null,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.primary,
                      foregroundColor: Colors.white,
                      disabledBackgroundColor: colors.outlineVariant,
                      disabledForegroundColor: colors.onSurfaceMuted,
                      elevation: 0,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                    ),
                    child: isUploading
                        ? Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              ),
                              if (uploadProgressText.isNotEmpty) ...[
                                SizedBox(width: 12),
                                Text(
                                  uploadProgressText,
                                  style: AppTypography.bodyMedium
                                      .copyWith(fontWeight: FontWeight.w600),
                                ),
                              ],
                            ],
                          )
                        : Text(
                            buttonText,
                            style: AppTypography.labelLarge
                                .copyWith(fontWeight: FontWeight.w700),
                          ),
                  ),
                ),
              ),
            ],
          ),
          SizedBox(height: 12),
          Text(
            'ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING',
            textAlign: TextAlign.center,
            style: AppTypography.labelSmall.copyWith(fontSize: 9).copyWith(
                  color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                  letterSpacing: 1.0,
                ),
          ),
        ],
      ),
    );
  }
}
