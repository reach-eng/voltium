import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/features/kyc/presentation/widgets/user_onboarding_widgets.dart'
    show DocTile;
import 'package:voltium_rider/widgets/pickup_hub_widgets.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class GuarantorDetailsCard extends StatelessWidget {
  final TextEditingController nameController;
  final TextEditingController dobController;
  final TextEditingController phoneController;
  final TextEditingController fatherNameController;
  final TextEditingController motherNameController;
  final TextEditingController addressController;
  final bool isPhoneVerified;
  final bool isSendingOtp;
  final bool isOtpSent;
  final bool isVerifyingOtp;
  final VoidCallback onSendOtp;
  final VoidCallback onVerifyOtp;
  final VoidCallback onSelectDob;
  final Widget otpBoxes;

  const GuarantorDetailsCard({
    super.key,
    required this.nameController,
    required this.dobController,
    required this.phoneController,
    required this.fatherNameController,
    required this.motherNameController,
    required this.addressController,
    required this.isPhoneVerified,
    required this.isSendingOtp,
    required this.isOtpSent,
    required this.isVerifyingOtp,
    required this.onSendOtp,
    required this.onVerifyOtp,
    required this.onSelectDob,
    required this.otpBoxes,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: colors.onSurface.withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: colors.surfaceSubtle, width: 1),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'GUARANTOR DETAILS',
            style: AppTypography.bodySmallStrong
                .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.5),
          ),
          const SizedBox(height: 24),
          _buildTextField(
            context,
            'Full Name',
            'Enter guarantor\'s full name',
            nameController,
            key: const Key('guarantorFullNameField'),
          ),
          const SizedBox(height: 12),
          _buildDateField(
            context,
            'Date of Birth',
            'DD-MM-YYYY',
            dobController,
            onSelectDob,
          ),
          const SizedBox(height: 12),
          _buildPhoneField(context),
          const SizedBox(height: 12),
          _buildTextField(
            context,
            'Father\'s Name',
            'Enter father\'s name',
            fatherNameController,
            key: const Key('guarantorFatherNameField'),
          ),
          const SizedBox(height: 12),
          _buildTextField(
            context,
            'Mother\'s Name',
            'Enter mother\'s name',
            motherNameController,
            key: const Key('guarantorMotherNameField'),
          ),
          const SizedBox(height: 12),
          _buildTextArea(
            context,
            'Current Address',
            'Enter full address',
            addressController,
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
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: colors.outlineVariant, width: 1),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: colors.outlineVariant, width: 1),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  const BorderSide(color: AppColors.primary, width: 1.5),
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
    VoidCallback onTap,
  ) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, label.toUpperCase()),
        SizedBox(height: 8),
        GestureDetector(
          onTap: onTap,
          child: AbsorbPointer(
            child: TextFormField(
              key: const Key('guarantorDobField'),
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
                fillColor: colors.iconBackground,
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      BorderSide(color: colors.outlineVariant, width: 1),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      BorderSide(color: colors.outlineVariant, width: 1),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(12),
                  borderSide:
                      const BorderSide(color: AppColors.primary, width: 1.5),
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildPhoneField(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, 'GUARANTOR PHONE NUMBER'),
        SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: TextFormField(
                key: const Key('guarantorPhoneField'),
                controller: phoneController,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                enabled: !isPhoneVerified,
                style:
                    AppTypography.bodyMedium.copyWith(color: colors.onSurface),
                decoration: InputDecoration(
                  counterText: '',
                  hintText: 'Enter 10-digit number',
                  hintStyle: GoogleFonts.plusJakartaSans(
                    color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                    fontSize: 14,
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  filled: true,
                  fillColor: colors.iconBackground,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide:
                        BorderSide(color: colors.outlineVariant, width: 1),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide:
                        BorderSide(color: colors.outlineVariant, width: 1),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(12),
                    borderSide:
                        const BorderSide(color: AppColors.primary, width: 1.5),
                  ),
                ),
              ),
            ),
            if (!isPhoneVerified) ...[
              SizedBox(width: 12),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  key: const Key('sendOtpButton'),
                  onPressed: isSendingOtp || phoneController.text.length < 10
                      ? null
                      : onSendOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.info,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    elevation: 0,
                    minimumSize:
                        const Size(100, 52), // Override global double.infinity
                  ),
                  child: isSendingOtp
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          isOtpSent ? 'RESEND' : 'SEND OTP',
                          style: GoogleFonts.plusJakartaSans(
                            color: Colors.white,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                ),
              ),
            ],
          ],
        ),
        if (isPhoneVerified) ...[
          SizedBox(height: 8),
          Row(
            children: [
              Icon(Icons.check_circle, color: AppColors.success, size: 16),
              SizedBox(width: 6),
              Text(
                'Phone Number Verified',
                style: AppTypography.bodySmallEmphasis
                    .copyWith(color: AppColors.success),
              ),
            ],
          ),
        ],
        if (isOtpSent && !isPhoneVerified) ...[
          SizedBox(height: 16),
          Text(
            'Enter OTP',
            style: AppTypography.bodyCompactEmphasis
                .copyWith(color: colors.onSurfaceVariant),
          ),
          const SizedBox(height: 8),
          otpBoxes,
          SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: SizedBox(
                  height: 48,
                  child: ElevatedButton(
                    key: const Key('verifyOtpButton'),
                    onPressed: isVerifyingOtp ? null : onVerifyOtp,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.success,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                      elevation: 0,
                    ),
                    child: isVerifyingOtp
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : Text(
                            'VERIFY OTP',
                            style: GoogleFonts.plusJakartaSans(
                              color: Colors.white,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                  ),
                ),
              ),
            ],
          ),
        ],
      ],
    );
  }

  Widget _buildTextArea(
    BuildContext context,
    String label,
    String hint,
    TextEditingController controller,
  ) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, label.toUpperCase()),
        SizedBox(height: 8),
        TextFormField(
          key: const Key('guarantorAddressField'),
          controller: controller,
          maxLines: 3,
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
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: colors.outlineVariant, width: 1),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide(color: colors.outlineVariant, width: 1),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide:
                  const BorderSide(color: AppColors.primary, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}

class GuarantorIdentityVerificationCard extends StatelessWidget {
  final bool aadhaarFrontUploaded;
  final bool aadhaarBackUploaded;
  final bool panUploaded;
  final bool photoUploaded;
  final VoidCallback onPickAadhaarFront;
  final VoidCallback onPickAadhaarBack;
  final VoidCallback onPickPan;
  final VoidCallback onPickPhoto;

  const GuarantorIdentityVerificationCard({
    super.key,
    required this.aadhaarFrontUploaded,
    required this.aadhaarBackUploaded,
    required this.panUploaded,
    required this.photoUploaded,
    required this.onPickAadhaarFront,
    required this.onPickAadhaarBack,
    required this.onPickPan,
    required this.onPickPhoto,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: colors.onSurface.withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: colors.surfaceSubtle, width: 1),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'DOCUMENTS UPLOAD',
            style: AppTypography.bodySmallStrong
                .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.5),
          ),
          SizedBox(height: 4),
          Text(
            'Clear photos only. Max 5MB each.',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: colors.onSurfaceMuted,
            ),
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
                  key: const Key('guarantorAadhaarFrontTile'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DocTile(
                  label: 'Aadhaar Card\n(Back)',
                  icon: Icons.upload_file,
                  isUploaded: aadhaarBackUploaded,
                  onTap: onPickAadhaarBack,
                  key: const Key('guarantorAadhaarBackTile'),
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
                  key: const Key('guarantorPanTile'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: DocTile(
                  label: 'Guarantor Photo',
                  icon: Icons.face,
                  isUploaded: photoUploaded,
                  onTap: onPickPhoto,
                  key: const Key('guarantorPhotoTile'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class GuarantorVideoProofCard extends StatelessWidget {
  final bool videoUploaded;
  final String? videoPath;
  final VoidCallback onTap;

  const GuarantorVideoProofCard({
    super.key,
    required this.videoUploaded,
    required this.videoPath,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: colors.onSurface.withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: colors.surfaceSubtle, width: 1),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'CONSENT VIDEO (COMPULSORY)',
            style: AppTypography.bodySmallStrong
                .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.5),
          ),
          SizedBox(height: 4),
          Text(
            'Record a 5-sec video holding ID, saying "I agree to be the guarantor for [Rider Name]"',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: colors.onSurfaceMuted,
            ),
          ),
          SizedBox(height: 24),
          GestureDetector(
            key: const Key('guarantorVideoTile'),
            onTap: onTap,
            child: Container(
              height: 140,
              decoration: BoxDecoration(
                color: videoUploaded
                    ? AppColors.success.withValues(alpha: 0.1)
                    : colors.surfaceSubtle,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color:
                      videoUploaded ? AppColors.success : colors.outlineVariant,
                  width: videoUploaded ? 1 : 2,
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      videoUploaded ? Icons.check_circle : Icons.videocam,
                      color: videoUploaded
                          ? AppColors.success
                          : colors.onSurfaceMuted,
                      size: 36,
                    ),
                    SizedBox(height: 8),
                    Text(
                      videoUploaded ? 'Video Recorded' : 'Record Consent Video',
                      style: AppTypography.bodyMediumEmphasis.copyWith(
                          color: videoUploaded
                              ? AppColors.success
                              : colors.onSurface),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class GuarantorSignatureCard extends StatelessWidget {
  final bool signatureUploaded;
  final VoidCallback onTap;

  const GuarantorSignatureCard({
    super.key,
    required this.signatureUploaded,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: colors.onSurface.withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: colors.surfaceSubtle, width: 1),
      ),
      padding: const EdgeInsets.all(24),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'GUARANTOR SIGNATURE',
            style: AppTypography.bodySmallStrong
                .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.5),
          ),
          SizedBox(height: 4),
          Text(
            'Sign on screen to authorize details.',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: colors.onSurfaceMuted,
            ),
          ),
          SizedBox(height: 24),
          GestureDetector(
            key: const Key('guarantorSignatureTile'),
            onTap: onTap,
            child: Container(
              height: 140,
              decoration: BoxDecoration(
                color: signatureUploaded
                    ? AppColors.success.withValues(alpha: 0.1)
                    : colors.surfaceSubtle,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(
                  color: signatureUploaded
                      ? AppColors.success
                      : colors.outlineVariant,
                  width: signatureUploaded ? 1 : 2,
                ),
              ),
              child: Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      signatureUploaded ? Icons.check_circle : Icons.draw,
                      color: signatureUploaded
                          ? AppColors.success
                          : colors.onSurfaceMuted,
                      size: 36,
                    ),
                    SizedBox(height: 8),
                    Text(
                      signatureUploaded ? 'Signature Saved' : 'Draw Signature',
                      style: AppTypography.bodyMediumEmphasis.copyWith(
                          color: signatureUploaded
                              ? AppColors.success
                              : colors.onSurface),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class GuarantorOnboardingHeader extends StatelessWidget {
  final VoidCallback? onBack;

  const GuarantorOnboardingHeader({super.key, this.onBack});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: colors.card,
        border:
            Border(bottom: BorderSide(color: colors.outlineVariant, width: 1)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: onBack,
            ),
            Expanded(
              child: Text(
                'Guarantor\'s Onboarding',
                textAlign: TextAlign.center,
                style: AppTypography.titleMedium,
              ),
            ),
            Padding(
              padding: EdgeInsets.only(right: 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'Step',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 12, color: colors.onSurfaceMuted),
                  ),
                  Text(
                    '2/2',
                    style: AppTypography.bodySmallEmphasis,
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class GuarantorOnboardingProgressSection extends StatelessWidget {
  const GuarantorOnboardingProgressSection({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      color: colors.card,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: Container(
              height: 8,
              color: AppColors.success,
            ),
          ),
          SizedBox(height: 24),
          Text(
            'One more step',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 24, fontWeight: FontWeight.w700),
          ),
          SizedBox(height: 8),
          Text(
            'We need a few more details to set up your fleet profile securely.',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 14, color: colors.onSurfaceMuted),
          ),
        ],
      ),
    );
  }
}

class GuarantorOnboardingOtpBoxes extends StatelessWidget {
  final List<TextEditingController> otpControllers;
  final List<FocusNode> otpFocusNodes;
  final Function(int, String) onChanged;

  const GuarantorOnboardingOtpBoxes({
    super.key,
    required this.otpControllers,
    required this.otpFocusNodes,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: List.generate(6, (i) {
        return SizedBox(
          width: 40,
          height: 48,
          child: TextFormField(
            controller: otpControllers[i],
            focusNode: otpFocusNodes[i],
            keyboardType: TextInputType.number,
            maxLength: 1,
            textAlign: TextAlign.center,
            textInputAction:
                i < 5 ? TextInputAction.next : TextInputAction.done,
            style: AppTypography.titleMedium,
            decoration: InputDecoration(
              counterText: '',
              filled: true,
              fillColor: colors.iconBackground,
              contentPadding: EdgeInsets.zero,
              enabledBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide: BorderSide(color: colors.outlineVariant),
              ),
              focusedBorder: OutlineInputBorder(
                borderRadius: BorderRadius.circular(8),
                borderSide:
                    const BorderSide(color: AppColors.primary, width: 2),
              ),
            ),
            onChanged: (v) => onChanged(i, v),
          ),
        );
      }),
    );
  }
}

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
          top: BorderSide(color: colors.surfaceSubtle, width: 1),
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
                        borderRadius: BorderRadius.circular(12),
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
                                SizedBox(width: 12),
                                Text(
                                  uploadProgressText,
                                  style: AppTypography.bodyMediumEmphasis,
                                ),
                              ],
                            ],
                          )
                        : Text(
                            buttonText,
                            style: AppTypography.buttonMedium,
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
            style: AppTypography.microBadge.copyWith(
              color: colors.onSurfaceMuted.withValues(alpha: 0.7),
              letterSpacing: 1.0,
            ),
          ),
        ],
      ),
    );
  }
}
