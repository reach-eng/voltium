import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/features/pickup/widgets/pickup_hub_widgets.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class PersonalDetailsCard extends StatelessWidget {
  final TextEditingController nameController;
  final TextEditingController dobController;
  final TextEditingController emailController;
  final TextEditingController fatherNameController;
  final TextEditingController motherNameController;
  final TextEditingController addressController;
  final String phone;
  final VoidCallback onSelectDob;
  final bool nameEnabled;
  final bool dobEnabled;
  final bool emailEnabled;
  final bool fatherNameEnabled;
  final bool motherNameEnabled;
  final bool addressEnabled;

  const PersonalDetailsCard({
    super.key,
    required this.nameController,
    required this.dobController,
    required this.emailController,
    required this.fatherNameController,
    required this.motherNameController,
    required this.addressController,
    required this.phone,
    required this.onSelectDob,
    this.nameEnabled = true,
    this.dobEnabled = true,
    this.emailEnabled = true,
    this.fatherNameEnabled = true,
    this.motherNameEnabled = true,
    this.addressEnabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);

    final cleanDigits = phone.replaceAll(RegExp(r'\D'), '');
    final tenDigits = cleanDigits.length >= 10
        ? cleanDigits.substring(cleanDigits.length - 10)
        : cleanDigits;
    final formattedPhone = tenDigits.length == 10
        ? '+91 ${tenDigits.substring(0, 5)} ${tenDigits.substring(5)}'
        : phone;

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
            l10n?.txtpersonalDetails ?? 'Personal Details',
            style: AppTypography.titleSmall
                .copyWith(color: colors.onSurface, letterSpacing: -0.2),
          ),
          const SizedBox(height: 24),
          _buildTextField(
            context,
            l10n?.txtfullName ?? 'Full Name',
            l10n?.txtenterFullName ?? 'Enter full name',
            nameController,
            key: const Key('fullNameField'),
            enabled: nameEnabled,
          ),
          const SizedBox(height: 12),
          _buildDateField(
            context,
            l10n?.txtdateOfBirth ?? 'Date of Birth',
            'YYYY-MM-DD',
            dobController,
            onSelectDob,
            enabled: dobEnabled,
          ),
          const SizedBox(height: 12),
          _buildTextField(
            context,
            l10n?.txtemailAddress ?? 'Email Address',
            l10n?.txtenterEmailAddress ?? 'Enter email address',
            emailController,
            key: const Key('emailField'),
            enabled: emailEnabled,
          ),
          const SizedBox(height: 12),
          _buildPhoneField(
            context,
            l10n?.txtphoneNumber.toUpperCase() ?? 'PHONE NUMBER',
            formattedPhone,
          ),
          const SizedBox(height: 12),
          _buildTextField(
            context,
            l10n?.txtfathersName ?? "Father's Name",
            l10n?.txtenterFathersName ?? "Enter father's name",
            fatherNameController,
            key: const Key('fatherNameField'),
            enabled: fatherNameEnabled,
          ),
          const SizedBox(height: 12),
          _buildTextField(
            context,
            l10n?.txtmothersName ?? "Mother's Name",
            l10n?.txtenterMothersName ?? "Enter mother's name",
            motherNameController,
            key: const Key('motherNameField'),
            enabled: motherNameEnabled,
          ),
          const SizedBox(height: 12),
          _buildTextArea(
            context,
            l10n?.txtcurrentAddress ?? 'Current Address',
            l10n?.txtenterYourFullAddress ?? 'Enter your full address',
            addressController,
            enabled: addressEnabled,
          ),
        ],
      ),
    );
  }

  Widget _buildTextField(
    BuildContext context,
    String label,
    String hint,
    TextEditingController controller, {
    Key? key,
    bool enabled = true,
  }) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, label.toUpperCase()),
        const SizedBox(height: 8),
        TextFormField(
          key: key,
          controller: controller,
          readOnly: !enabled,
          style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.plusJakartaSans(
              color: colors.onSurfaceMuted.withValues(alpha: 0.7),
              fontSize: 14,
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            filled: true,
            fillColor: colors.iconBackground,
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
          ),
        ),
      ],
    );
  }

  Widget _buildDateField(
    BuildContext context,
    String label,
    String hint,
    TextEditingController controller,
    VoidCallback onTap, {
    bool enabled = true,
  }) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, label.toUpperCase()),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: enabled ? onTap : null,
          child: AbsorbPointer(
            child: TextFormField(
              key: const Key('dobField'),
              controller: controller,
              style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: GoogleFonts.plusJakartaSans(
                  color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                  fontSize: 14,
                ),
                prefixIcon: Icon(
                  Icons.calendar_today,
                  size: 18,
                  color: colors.onSurfaceMuted,
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                filled: true,
                fillColor:
                    enabled ? colors.iconBackground : colors.outlineVariant,
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
                  borderSide:
                      const BorderSide(color: AppColors.primary, width: 2),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneField(
    BuildContext context,
    String phoneLabel,
    String phone,
  ) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, phoneLabel),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: colors.outlineVariant, // Disabled slate look
            borderRadius: BorderRadius.circular(AppRadius.lg),
          ),
          child: Row(
            children: [
              Icon(Icons.phone, size: 18, color: colors.onSurfaceMuted),
              const SizedBox(width: 12),
              Text(
                phone,
                style: AppTypography.bodyMedium
                    .copyWith(color: colors.onSurfaceMuted),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTextArea(
    BuildContext context,
    String label,
    String hint,
    TextEditingController controller, {
    bool enabled = true,
  }) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, label.toUpperCase()),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          maxLines: 3,
          readOnly: !enabled,
          style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.plusJakartaSans(
              color: colors.onSurfaceMuted.withValues(alpha: 0.7),
              fontSize: 14,
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            filled: true,
            fillColor: colors.iconBackground,
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
          ),
        ),
      ],
    );
  }
}
