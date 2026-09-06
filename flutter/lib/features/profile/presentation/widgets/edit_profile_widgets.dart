import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class EditProfileSectionHeader extends StatelessWidget {
  final String title;

  const EditProfileSectionHeader({super.key, required this.title});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, left: 4),
      child: Text(
        title,
        style: AppTypography.bodySmall
            .copyWith(fontWeight: FontWeight.w800, letterSpacing: 1.2)
            .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.2),
      ),
    );
  }
}

class EditProfileAdminNote extends StatelessWidget {
  const EditProfileAdminNote({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: AppColors.warningSurface,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(color: AppColors.of(context).warningBorder),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline,
              color: AppColors.warningDark, size: 22),
          SizedBox(width: 16),
          Expanded(
            child: Text(
              'Most profile changes require admin approval before becoming active. Emergency contact is updated immediately.',
              style: GoogleFonts.plusJakartaSans(
                color: AppColors.warningDark,
                fontSize: 13,
                fontWeight: FontWeight.w600,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }
}
