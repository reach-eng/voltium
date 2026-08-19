import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class SignatureCard extends StatelessWidget {
  final bool signatureUploaded;
  final VoidCallback onTap;
  final bool enabled;

  const SignatureCard({
    super.key,
    required this.signatureUploaded,
    required this.onTap,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);

    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.5,
        child: Container(
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
                l10n?.txtdigitalSignature ?? 'Digital Signature',
                style: AppTypography.titleSmall
                    .copyWith(color: colors.onSurface, letterSpacing: -0.2),
              ),
              const SizedBox(height: 4),
              Text(
                l10n?.txtsignBelowToAuthorizeDocumentation ??
                    'Sign below to authorize documentation.',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12, color: colors.onSurfaceMuted),
              ),
              const SizedBox(height: 24),
              GestureDetector(
                key: const Key('signatureTile'),
                onTap: enabled ? onTap : null,
                child: Container(
                  height: 120,
                  decoration: BoxDecoration(
                    color: signatureUploaded
                        ? AppColors.success.withValues(alpha: 0.1)
                        : colors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(
                      color: signatureUploaded
                          ? AppColors.success
                          : colors.outlineVariant,
                      width: 1,
                    ),
                  ),
                  child: Stack(
                    children: [
                      Center(
                        child: Text(
                          signatureUploaded
                              ? (l10n?.txtverified ?? 'Signature Captured')
                              : (l10n?.txtdrawSignature ??
                                  'Tap to draw signature'),
                          style: AppTypography.bodyMedium
                              .copyWith(fontWeight: FontWeight.w600)
                              .copyWith(
                                  color: signatureUploaded
                                      ? AppColors.success
                                      : colors.onSurfaceMuted),
                        ),
                      ),
                      if (signatureUploaded)
                        Positioned(
                          top: 8,
                          right: 8,
                          child: Container(
                            padding: const EdgeInsets.all(2),
                            decoration: const BoxDecoration(
                              color: AppColors.success,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(
                              Icons.check,
                              color: Colors.white,
                              size: 12,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
