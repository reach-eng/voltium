import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class SelfieCard extends StatelessWidget {
  final bool selfieUploaded;
  final String? selfiePath;
  final VoidCallback onTap;
  final bool enabled;

  const SelfieCard({
    super.key,
    required this.selfieUploaded,
    this.selfiePath,
    required this.onTap,
    this.enabled = true,
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
      child: GestureDetector(
        key: const Key('selfieTile'),
        onTap: enabled ? onTap : null,
        child: Opacity(
          opacity: enabled ? 1.0 : 0.5,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Rider Photo',
                style: AppTypography.titleSmall
                    .copyWith(color: colors.onSurface, letterSpacing: -0.2),
              ),
              const SizedBox(height: 24),
              if (selfieUploaded && selfiePath != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  child: Image.file(
                    File(selfiePath!),
                    height: 160,
                    fit: BoxFit.cover,
                  ),
                )
              else
                Container(
                  height: 120,
                  decoration: BoxDecoration(
                    color: colors.surface,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    border: Border.all(color: colors.outlineVariant, width: 1),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: colors.card,
                          borderRadius:
                              BorderRadius.circular(AppRadius.radiusModal),
                        ),
                        child: Icon(
                          Icons.photo_camera,
                          color: colors.onSurfaceMuted,
                          size: 28,
                        ),
                      ),
                      SizedBox(height: 12),
                      Text(
                        'Take Rider Photo',
                        style: AppTypography.bodyMedium
                            .copyWith(fontWeight: FontWeight.w600)
                            .copyWith(color: colors.onSurfaceMuted),
                      ),
                      SizedBox(height: 2),
                      Text(
                        'Tap to capture your photo',
                        style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            color:
                                colors.onSurfaceMuted.withValues(alpha: 0.7)),
                      ),
                    ],
                  ),
                ),
              if (selfieUploaded) ...[
                SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.successLight,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check, color: AppColors.success, size: 14),
                          SizedBox(width: 4),
                          Text(
                            'Photo Captured',
                            style: AppTypography.bodySmall
                                .copyWith(color: AppColors.onSurface),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}
