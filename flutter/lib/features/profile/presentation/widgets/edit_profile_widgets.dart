import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class EditProfileTextField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final IconData icon;
  final TextInputType keyboardType;
  final bool readOnly;
  final Widget? suffixIcon;
  final String? helperText;
  final String? Function(String?)? validator;

  const EditProfileTextField({
    super.key,
    required this.label,
    required this.controller,
    required this.icon,
    this.keyboardType = TextInputType.text,
    this.readOnly = false,
    this.suffixIcon,
    this.helperText,
    this.validator,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(
            label,
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: colors.onSurfaceMuted),
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          readOnly: readOnly,
          validator: validator,
          style: AppTypography.bodyLarge
              .copyWith(fontWeight: FontWeight.w600)
              .copyWith(
                color: readOnly ? colors.onSurfaceMuted : colors.onSurface,
              ),
          decoration: InputDecoration(
            prefixIcon: Icon(
              icon,
              color: readOnly ? colors.outlineVariant : colors.onSurfaceVariant,
              size: 18,
            ),
            suffixIcon: suffixIcon,
            helperText: helperText,
            helperStyle: AppTypography.bodySmall.copyWith(
              color: colors.onSurfaceMuted,
              fontSize: 11,
            ),
            filled: true,
            fillColor: readOnly ? colors.surface : colors.card,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide(
                color: colors.outlineVariant.withValues(alpha: 0.5),
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide(
                color: colors.outlineVariant.withValues(alpha: 0.5),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide(
                color: readOnly ? colors.outlineVariant : AppColors.primary,
                width: 2,
              ),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: const BorderSide(
                color: AppColors.error,
                width: 1.5,
              ),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 16,
            ),
          ),
        ),
      ],
    );
  }
}

class EditProfileDateField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final VoidCallback onTap;

  const EditProfileDateField({
    super.key,
    required this.label,
    required this.controller,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(
            label,
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: colors.onSurfaceMuted),
          ),
        ),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          readOnly: true,
          style: AppTypography.bodyLarge
              .copyWith(fontWeight: FontWeight.w600)
              .copyWith(color: colors.onSurface),
          decoration: InputDecoration(
            prefixIcon: Icon(
              Icons.calendar_today_outlined,
              color: colors.onSurfaceVariant,
              size: 18,
            ),
            suffixIcon: const Icon(
              Icons.edit_calendar_outlined,
              color: AppColors.primary,
              size: 18,
            ),
            filled: true,
            fillColor: colors.card,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide(
                color: colors.outlineVariant.withValues(alpha: 0.5),
              ),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide(
                color: colors.outlineVariant.withValues(alpha: 0.5),
              ),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: const BorderSide(color: AppColors.primary, width: 2),
            ),
            contentPadding: const EdgeInsets.symmetric(
              horizontal: 16,
              vertical: 16,
            ),
            hintText: 'YYYY-MM-DD',
            hintStyle: TextStyle(color: colors.onSurfaceMuted),
          ),
          onTap: onTap,
        ),
      ],
    );
  }
}

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
        border: Border.all(color: AppColors.warningBorder),
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
