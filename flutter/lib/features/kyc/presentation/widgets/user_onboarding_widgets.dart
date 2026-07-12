import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/widgets/pickup_hub_widgets.dart';
import '../../../../theme/app_theme.dart';

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
    final formattedPhone = phone.length >= 10
        ? '+91 ${phone.substring(0, 5)} ${phone.substring(5)}'
        : phone;

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: kSurfaceContainer,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: const Color(0xFFF3F4F6), width: 1),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Personal Details',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: kOnSurfaceColor,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 24),
          _buildTextField(
            'Full Name',
            'Enter full name',
            nameController,
            key: const Key('fullNameField'),
            enabled: nameEnabled,
          ),
          const SizedBox(height: 12),
          _buildDateField(
            'Date of Birth',
            'DD-MM-YYYY',
            dobController,
            onSelectDob,
            enabled: dobEnabled,
          ),
          const SizedBox(height: 12),
          _buildTextField(
            'Email Address',
            'Enter email address',
            emailController,
            key: const Key('emailField'),
            enabled: emailEnabled,
          ),
          const SizedBox(height: 12),
          _buildPhoneField(formattedPhone),
          const SizedBox(height: 12),
          _buildTextField(
            "Father's Name",
            "Enter father's name",
            fatherNameController,
            key: const Key('fatherNameField'),
            enabled: fatherNameEnabled,
          ),
          const SizedBox(height: 12),
          _buildTextField(
            "Mother's Name",
            "Enter mother's name",
            motherNameController,
            key: const Key('motherNameField'),
            enabled: motherNameEnabled,
          ),
          const SizedBox(height: 12),
          _buildTextArea(
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
    String label,
    String hint,
    TextEditingController controller, {
    Key? key,
    bool enabled = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(label.toUpperCase()),
        const SizedBox(height: 8),
        TextFormField(
          key: key,
          controller: controller,
          readOnly: !enabled,
          style: GoogleFonts.inter(
            color: kOnSurfaceColor,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.inter(
              color: kOutlineColor.withValues(alpha: 0.7),
              fontSize: 14,
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            filled: true,
            fillColor: const Color(0xFFF1F5F9),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: kPrimaryColor, width: 2),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildDateField(
    String label,
    String hint,
    TextEditingController controller,
    VoidCallback onTap, {
    bool enabled = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(label.toUpperCase()),
        const SizedBox(height: 8),
        GestureDetector(
          onTap: enabled ? onTap : null,
          child: AbsorbPointer(
            child: TextFormField(
              key: const Key('dobField'),
              controller: controller,
              style: GoogleFonts.inter(
                color: kOnSurfaceColor,
                fontSize: 14,
                fontWeight: FontWeight.w500,
              ),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: GoogleFonts.inter(
                  color: kOutlineColor.withValues(alpha: 0.7),
                  fontSize: 14,
                ),
                prefixIcon: const Icon(
                  Icons.calendar_today,
                  size: 18,
                  color: kOutlineColor,
                ),
                contentPadding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                filled: true,
                fillColor:
                    enabled ? const Color(0xFFF1F5F9) : const Color(0xFFE2E8F0),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: BorderSide.none,
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(16),
                  borderSide: const BorderSide(color: kPrimaryColor, width: 2),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneField(String phone) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel('PHONE NUMBER'),
        const SizedBox(height: 8),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
          decoration: BoxDecoration(
            color: const Color(0xFFE2E8F0), // Disabled slate look
            borderRadius: BorderRadius.circular(16),
          ),
          child: Row(
            children: [
              const Icon(Icons.phone, size: 18, color: kOutlineColor),
              const SizedBox(width: 12),
              Text(
                phone,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  color: kOutlineColor,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildTextArea(
    String label,
    String hint,
    TextEditingController controller, {
    bool enabled = true,
  }) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(label.toUpperCase()),
        const SizedBox(height: 8),
        TextFormField(
          controller: controller,
          maxLines: 3,
          readOnly: !enabled,
          style: GoogleFonts.inter(
            color: kOnSurfaceColor,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.inter(
              color: kOutlineColor.withValues(alpha: 0.7),
              fontSize: 14,
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            filled: true,
            fillColor: const Color(0xFFF1F5F9),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(16),
              borderSide: const BorderSide(color: kPrimaryColor, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}

class IdentityVerificationCard extends StatelessWidget {
  final bool aadhaarFrontUploaded;
  final bool aadhaarBackUploaded;
  final bool panUploaded;
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
    required this.aadhaarBackUploaded,
    required this.panUploaded,
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
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: kSurfaceContainer,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: const Color(0xFFF3F4F6), width: 1),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Identity Verification',
            style: GoogleFonts.inter(
              fontSize: 16,
              fontWeight: FontWeight.w700,
              color: kOnSurfaceColor,
              letterSpacing: -0.2,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Clear photos only. Max 5MB each.',
            style:
                GoogleFonts.inter(fontSize: 12, color: const Color(0xFF6B7280)),
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: DocTile(
                  label: 'Aadhaar Card\n(Front)',
                  icon: Icons.upload_file,
                  isUploaded: aadhaarFrontUploaded,
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
  final VoidCallback onTap;
  final bool enabled;

  const DocTile({
    super.key,
    required this.label,
    required this.icon,
    required this.isUploaded,
    required this.onTap,
    this.enabled = true,
  });

  @override
  Widget build(BuildContext context) {
    Widget content = Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 16, horizontal: 12),
      decoration: BoxDecoration(
        color: isUploaded ? kSuccessColor.withValues(alpha: 0.1) : Colors.white,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: isUploaded
                  ? kSuccessColor.withValues(alpha: 0.2)
                  : const Color(0xFFF1F5F9),
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(
              isUploaded ? Icons.check_circle : icon,
              color: isUploaded ? kSuccessColor : const Color(0xFF94A3B8),
              size: 20,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            isUploaded ? 'Uploaded' : label,
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 12,
              fontWeight: FontWeight.w600,
              color: isUploaded ? kSuccessColor : const Color(0xFF64748B),
            ),
          ),
        ],
      ),
    );

    if (!isUploaded) {
      content = Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: const Color(0xFFCBD5E1), width: 1.5),
        ),
        child: content,
      );
    } else {
      content = Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: kSuccessColor, width: 1.5),
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
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: kSurfaceContainer,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: const Color(0xFF0F172A).withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: const Color(0xFFF3F4F6), width: 1),
      ),
      padding: const EdgeInsets.all(24),
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
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: kOnSurfaceColor,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 24),
              if (selfieUploaded && selfiePath != null)
                ClipRRect(
                  borderRadius: BorderRadius.circular(8),
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
                    color: const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: kOutlineVariantColor, width: 1),
                  ),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(24),
                        ),
                        child: const Icon(
                          Icons.photo_camera,
                          color: kOutlineColor,
                          size: 28,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Take Rider Photo',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: kOutlineColor,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        'Tap to capture your photo',
                        style: GoogleFonts.inter(
                            fontSize: 12,
                            color: kOutlineColor.withValues(alpha: 0.7)),
                      ),
                    ],
                  ),
                ),
              if (selfieUploaded) ...[
                const SizedBox(height: 8),
                Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 10, vertical: 4),
                      decoration: BoxDecoration(
                        color: const Color(0xFFDCFCE7),
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: const Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.check, color: AppColors.success, size: 14),
                          SizedBox(width: 4),
                          Text(
                            'Photo Captured',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                              color: AppColors.successText,
                            ),
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
    return GestureDetector(
      onTap: enabled ? onTap : null,
      child: Opacity(
        opacity: enabled ? 1.0 : 0.5,
        child: Container(
          width: double.infinity,
          decoration: BoxDecoration(
            color: kSurfaceContainer,
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0F172A).withValues(alpha: 0.04),
                blurRadius: 24,
                offset: const Offset(0, 8),
              ),
            ],
            border: Border.all(color: const Color(0xFFF3F4F6), width: 1),
          ),
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Digital Signature',
                style: GoogleFonts.inter(
                  fontSize: 16,
                  fontWeight: FontWeight.w700,
                  color: kOnSurfaceColor,
                  letterSpacing: -0.2,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Sign below to authorize documentation.',
                style: GoogleFonts.inter(
                    fontSize: 12, color: const Color(0xFF6B7280)),
              ),
              const SizedBox(height: 24),
              GestureDetector(
                key: const Key('signatureTile'),
                onTap: enabled ? onTap : null,
                child: Container(
                  height: 120,
                  decoration: BoxDecoration(
                    color: signatureUploaded
                        ? kSuccessColor.withValues(alpha: 0.1)
                        : const Color(0xFFF3F4F6),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: signatureUploaded
                          ? kSuccessColor
                          : kOutlineVariantColor,
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
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: signatureUploaded
                                ? kSuccessColor
                                : kOutlineColor,
                          ),
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
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        border: const Border(
          top: BorderSide(color: Color(0xFFF3F4F6), width: 1),
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
                backgroundColor: kPrimaryColor,
                foregroundColor: Colors.white,
                disabledBackgroundColor: AppColors.outlineVariant,
                disabledForegroundColor: AppColors.slate400,
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(12),
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
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                        ],
                      ],
                    )
                  : Text(
                      'Confirm & Proceed',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING',
            textAlign: TextAlign.center,
            style: GoogleFonts.inter(
              fontSize: 9,
              fontWeight: FontWeight.w800,
              color: kOutlineColor.withValues(alpha: 0.7),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.inter(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: kOnSurfaceColor),
        ),
        const SizedBox(height: 4),
        TextFormField(
          controller: controller,
          style: GoogleFonts.inter(
            color: kOnSurfaceColor,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: GoogleFonts.inter(
                color: kOutlineColor.withValues(alpha: 0.7), fontSize: 14),
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: kOutlineVariantColor),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: kOutlineVariantColor),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(8),
              borderSide: const BorderSide(color: kPrimaryColor, width: 2),
            ),
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
          ),
        ),
      ],
    );
  }
}
