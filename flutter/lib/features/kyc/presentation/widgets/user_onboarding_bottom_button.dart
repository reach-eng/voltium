import 'package:flutter/material.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class UserOnboardingBottomButton extends StatelessWidget {
  final bool canProceed;
  final bool isUploading;
  final String uploadProgressText;
  final VoidCallback? onNext;

  const UserOnboardingBottomButton({
    super.key,
    required this.canProceed,
    required this.isUploading,
    this.uploadProgressText = '',
    this.onNext,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);

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
          SizedBox(
            width: double.infinity,
            height: 48,
            child: ElevatedButton(
              key: const Key('nextOnboardingButton'),
              onPressed: !isUploading && canProceed ? onNext : null,
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
                          const SizedBox(width: 12),
                          Text(
                            uploadProgressText,
                            style: AppTypography.bodyMedium
                                .copyWith(fontWeight: FontWeight.w600),
                          ),
                        ],
                      ],
                    )
                  : Text(
                      l10n?.txtconfirmAndProceed ?? 'Confirm & Proceed',
                      style: AppTypography.labelLarge
                          .copyWith(fontWeight: FontWeight.w700),
                    ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            l10n?.txtensureAllDetailsAccurate ??
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
