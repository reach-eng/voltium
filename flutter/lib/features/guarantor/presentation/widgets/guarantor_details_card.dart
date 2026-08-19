import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/features/pickup/widgets/pickup_hub_widgets.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/form_validators.dart';

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
  final int resendCooldown;
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
    this.resendCooldown = 0,
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
            'GUARANTOR DETAILS',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.5),
          ),
          const SizedBox(height: 24),
          _buildTextField(
            context,
            'Full Name',
            'Enter guarantor\'s full name',
            nameController,
            key: const Key('guarantorFullNameField'),
            validator: (v) => (v == null || v.trim().length < 2)
                ? 'Enter a valid name (at least 2 characters)'
                : null,
          ),
          const SizedBox(height: 12),
          _buildDateField(
            context,
            'Date of Birth',
            'YYYY-MM-DD',
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
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Enter father\'s name' : null,
          ),
          const SizedBox(height: 12),
          _buildTextField(
            context,
            'Mother\'s Name',
            'Enter mother\'s name',
            motherNameController,
            key: const Key('guarantorMotherNameField'),
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Enter mother\'s name' : null,
          ),
          const SizedBox(height: 12),
          _buildTextArea(
            context,
            'Current Address',
            'Enter full address',
            addressController,
            validator: (v) =>
                (v == null || v.trim().isEmpty) ? 'Enter full address' : null,
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
    String? Function(String?)? validator,
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
          validator: validator,
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
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(color: colors.outlineVariant, width: 1),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(color: colors.outlineVariant, width: 1),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide:
                  const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: const BorderSide(color: AppColors.error, width: 1),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: const BorderSide(color: AppColors.error, width: 1.5),
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
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide:
                      BorderSide(color: colors.outlineVariant, width: 1),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  borderSide:
                      BorderSide(color: colors.outlineVariant, width: 1),
                ),
                focusedBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
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
                validator: FormValidators.indianPhone,
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
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    borderSide:
                        BorderSide(color: colors.outlineVariant, width: 1),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    borderSide:
                        BorderSide(color: colors.outlineVariant, width: 1),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
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
                  onPressed: isSendingOtp ||
                          resendCooldown > 0 ||
                          phoneController.text
                                  .replaceAll(RegExp(r'\D'), '')
                                  .length <
                              10
                      ? null
                      : onSendOtp,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.info,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
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
                          resendCooldown > 0
                              ? '${resendCooldown}s'
                              : (isOtpSent ? 'RESEND' : 'SEND OTP'),
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
                style: AppTypography.bodySmall
                    .copyWith(fontWeight: FontWeight.w600)
                    .copyWith(color: AppColors.success),
              ),
            ],
          ),
        ],
        if (isOtpSent && !isPhoneVerified) ...[
          SizedBox(height: 16),
          Text(
            'Enter OTP',
            style: AppTypography.bodyMedium
                .copyWith(fontSize: 13, fontWeight: FontWeight.w600)
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
                        borderRadius: BorderRadius.circular(AppRadius.md),
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
    TextEditingController controller, {
    String? Function(String?)? validator,
  }) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, label.toUpperCase()),
        SizedBox(height: 8),
        TextFormField(
          key: const Key('guarantorAddressField'),
          controller: controller,
          validator: validator,
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
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(color: colors.outlineVariant, width: 1),
            ),
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: BorderSide(color: colors.outlineVariant, width: 1),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide:
                  const BorderSide(color: AppColors.primary, width: 1.5),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: const BorderSide(color: AppColors.error, width: 1),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(AppRadius.md),
              borderSide: const BorderSide(color: AppColors.error, width: 1.5),
            ),
          ),
        ),
      ],
    );
  }
}
