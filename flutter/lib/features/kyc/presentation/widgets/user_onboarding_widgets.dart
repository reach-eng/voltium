import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/widgets/pickup_hub_widgets.dart';
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
    final formattedPhone = phone.length >= 10
        ? '+91 ${phone.substring(0, 5)} ${phone.substring(5)}'
        : phone;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.xl),
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
            'Personal Details',
            style: AppTypography.titleSmall
                .copyWith(color: colors.onSurface, letterSpacing: -0.2),
          ),
          const SizedBox(height: 24),
          _buildTextField(
            context,
            'Full Name',
            'Enter full name',
            nameController,
            key: const Key('fullNameField'),
            enabled: nameEnabled,
          ),
          const SizedBox(height: 12),
          _buildDateField(
            context,
            'Date of Birth',
            'DD-MM-YYYY',
            dobController,
            onSelectDob,
            enabled: dobEnabled,
          ),
          const SizedBox(height: 12),
          _buildTextField(
            context,
            'Email Address',
            'Enter email address',
            emailController,
            key: const Key('emailField'),
            enabled: emailEnabled,
          ),
          const SizedBox(height: 12),
          _buildPhoneField(context, formattedPhone),
          const SizedBox(height: 12),
          _buildTextField(
            context,
            "Father's Name",
            "Enter father's name",
            fatherNameController,
            key: const Key('fatherNameField'),
            enabled: fatherNameEnabled,
          ),
          const SizedBox(height: 12),
          _buildTextField(
            context,
            "Mother's Name",
            "Enter mother's name",
            motherNameController,
            key: const Key('motherNameField'),
            enabled: motherNameEnabled,
          ),
          const SizedBox(height: 12),
          _buildTextArea(
            context,
            'Current Address',
            'Enter your full address',
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
        SizedBox(height: 8),
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
        SizedBox(height: 8),
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

  Widget _buildPhoneField(BuildContext context, String phone) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, 'PHONE NUMBER'),
        SizedBox(height: 8),
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
              SizedBox(width: 12),
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
        SizedBox(height: 8),
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

class IdentityVerificationCard extends StatelessWidget {
  final bool aadhaarFrontUploaded;
  final String? aadhaarFrontPath;
  final bool aadhaarBackUploaded;
  final String? aadhaarBackPath;
  final bool panUploaded;
  final String? panPath;
  final bool bankDetailsDone;
  final VoidCallback onPickAadhaarFront;
  final VoidCallback onPickAadhaarBack;
  final VoidCallback onPickPan;
  final VoidCallback onShowBankDialog;
  final bool aadhaarFrontEnabled;
  final bool aadhaarBackEnabled;
  final bool panEnabled;
  final bool bankEnabled;

  const IdentityVerificationCard({
    super.key,
    required this.aadhaarFrontUploaded,
    this.aadhaarFrontPath,
    required this.aadhaarBackUploaded,
    this.aadhaarBackPath,
    required this.panUploaded,
    this.panPath,
    required this.bankDetailsDone,
    required this.onPickAadhaarFront,
    required this.onPickAadhaarBack,
    required this.onPickPan,
    required this.onShowBankDialog,
    this.aadhaarFrontEnabled = true,
    this.aadhaarBackEnabled = true,
    this.panEnabled = true,
    this.bankEnabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.xl),
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
            'Identity Verification',
            style: AppTypography.titleSmall
                .copyWith(color: colors.onSurface, letterSpacing: -0.2),
          ),
          SizedBox(height: 4),
          Text(
            'Clear photos only. Max 5MB each.',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 12, color: colors.onSurfaceMuted),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: DocTile(
                  label: 'Aadhaar Card\n(Front)',
                  icon: Icons.upload_file,
                  isUploaded: aadhaarFrontUploaded,
                  filePath: aadhaarFrontPath,
                  onTap: onPickAadhaarFront,
                  enabled: aadhaarFrontEnabled,
                  key: const Key('aadhaarFrontTile'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DocTile(
                  label: 'Aadhaar Card\n(Back)',
                  icon: Icons.upload_file,
                  isUploaded: aadhaarBackUploaded,
                  filePath: aadhaarBackPath,
                  onTap: onPickAadhaarBack,
                  enabled: aadhaarBackEnabled,
                  key: const Key('aadhaarBackTile'),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: DocTile(
                  label: 'PAN Card',
                  icon: Icons.upload_file,
                  isUploaded: panUploaded,
                  filePath: panPath,
                  onTap: onPickPan,
                  enabled: panEnabled,
                  key: const Key('panTile'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DocTile(
                  label: 'Bank Details',
                  icon: Icons.account_balance,
                  isUploaded: bankDetailsDone,
                  onTap: onShowBankDialog,
                  enabled: bankEnabled,
                  key: const Key('bankTile'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class DocTile extends StatelessWidget {
  final String label;
  final IconData icon;
  final bool isUploaded;
  final String? filePath;
  final VoidCallback onTap;
  final bool enabled;

  const DocTile({
    super.key,
    required this.label,
    required this.icon,
    required this.isUploaded,
    this.filePath,
    required this.onTap,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final hasLocalImage = isUploaded &&
        filePath != null &&
        filePath!.isNotEmpty &&
        File(filePath!).existsSync();

    Widget content = Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 8),
      decoration: BoxDecoration(
        color:
            isUploaded ? AppColors.success.withValues(alpha: 0.1) : colors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (hasLocalImage)
            ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              child: Image.file(
                File(filePath!),
                height: 48,
                width: double.infinity,
                fit: BoxFit.cover,
              ),
            )
          else
            Container(
              padding: Spacing.paddingSm,
              decoration: BoxDecoration(
                color: isUploaded
                    ? AppColors.success.withValues(alpha: 0.2)
                    : colors.iconBackground,
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: Icon(
                isUploaded ? Icons.check_circle : icon,
                color: isUploaded ? AppColors.success : colors.onSurfaceMuted,
                size: 20,
              ),
            ),
          SizedBox(height: 8),
          Text(
            isUploaded ? 'Uploaded' : label,
            textAlign: TextAlign.center,
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w600)
                .copyWith(
                    color: isUploaded
                        ? AppColors.success
                        : colors.onSurfaceVariant),
          ),
        ],
      ),
    );

    if (!isUploaded) {
      content = Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: colors.outlineVariant, width: 1.5),
        ),
        child: content,
      );
    } else {
      content = Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: AppColors.success, width: 1.5),
        ),
        child: content,
      );
    }

    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.5,
        child: content,
      ),
    );
  }
}

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
        borderRadius: BorderRadius.circular(AppRadius.xl),
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
                          borderRadius: BorderRadius.circular(AppRadius.xl),
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
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.5,
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(AppRadius.xl),
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
                'Digital Signature',
                style: AppTypography.titleSmall
                    .copyWith(color: colors.onSurface, letterSpacing: -0.2),
              ),
              SizedBox(height: 4),
              Text(
                'Sign below to authorize documentation.',
                style: GoogleFonts.plusJakartaSans(
                    fontSize: 12, color: colors.onSurfaceMuted),
              ),
              SizedBox(height: 24),
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
                              ? 'Signature Captured'
                              : 'Tap to draw signature',
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
                      'Confirm & Proceed',
                      style: AppTypography.labelLarge
                          .copyWith(fontWeight: FontWeight.w700),
                    ),
            ),
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

class UserOnboardingDialogField extends StatelessWidget {
  final String label;
  final String hint;
  final TextEditingController controller;

  const UserOnboardingDialogField({
    super.key,
    required this.label,
    required this.hint,
    required this.controller,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: AppTypography.bodyMedium
              .copyWith(fontSize: 13)
              .copyWith(color: colors.onSurface),
        ),
        SizedBox(height: 4),
        TextFormField(
          controller: controller,
          style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.plusJakartaSans(
                color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                fontSize: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              borderSide: BorderSide(color: colors.outlineVariant),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              borderSide: BorderSide(color: colors.outlineVariant),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.sm),
              borderSide: const BorderSide(color: AppColors.primary, width: 2),
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          ),
        ),
      ],
    );
  }
}
