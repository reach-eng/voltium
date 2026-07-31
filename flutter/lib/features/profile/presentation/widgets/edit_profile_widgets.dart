import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class EditProfileTextField extends StatelessWidget {
  final String label;
  final TextEditingController controller;
  final IconData icon;
  final TextInputType keyboardType;

  const EditProfileTextField({
    super.key,
    required this.label,
    required this.controller,
    required this.icon,
    this.keyboardType = TextInputType.text,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(
            label,
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: AppColors.slate500),
          ),
        ),
        SizedBox(height: 8),
        TextFormField(
          controller: controller,
          keyboardType: keyboardType,
          style: AppTypography.bodyLarge
              .copyWith(fontWeight: FontWeight.w600)
              .copyWith(color: AppColors.slate800),
          decoration: InputDecoration(
            prefixIcon: Icon(icon, color: AppColors.slate400, size: 18),
            filled: true,
            fillColor:
                AppColors.iconBackground, // AppColors.slate100 equivalent
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: const BorderSide(color: AppColors.primary, width: 2),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(left: 4),
          child: Text(
            label,
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: AppColors.slate500),
          ),
        ),
        SizedBox(height: 8),
        TextFormField(
          controller: controller,
          readOnly: true,
          style: AppTypography.bodyLarge
              .copyWith(fontWeight: FontWeight.w600)
              .copyWith(color: AppColors.slate800),
          decoration: InputDecoration(
            prefixIcon: const Icon(
              Icons.calendar_today_outlined,
              color: AppColors.slate400,
              size: 18,
            ),
            suffixIcon: const Icon(
              Icons.edit_calendar_outlined,
              color: AppColors.primary,
              size: 18,
            ),
            filled: true,
            fillColor:
                AppColors.iconBackground, // AppColors.slate100 equivalent
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              borderSide: BorderSide.none,
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
    return Padding(
      padding: const EdgeInsets.only(bottom: 12, left: 4),
      child: Text(
        title,
        style: AppTypography.bodySmall
            .copyWith(fontWeight: FontWeight.w800, letterSpacing: 1.2)
            .copyWith(color: AppColors.slate500, letterSpacing: 1.2),
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
              'Profile changes require admin approval before becoming active.',
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
