import 'package:flutter/material.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/form_validators.dart';
import 'package:voltium_rider/widgets/forms/forms.dart';

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
    final l10n = AppLocalizations.of(context);

    return VoltiumFormCard(
      title: l10n?.txtguarantorDetails ?? 'Guarantor Details',
      contextLine: Text(
        l10n?.txtkycGuarantorContextLine ??
            "Your guarantor's details are required by RBI for verification",
        style: AppTypography.bodySmall.copyWith(
          color: colors.onSurfaceVariant,
          fontStyle: FontStyle.italic,
        ),
      ),
      children: [
        VoltiumTextField(
          fieldKey: const Key('guarantorFullNameField'),
          label: l10n?.txtguarantorFullName ?? 'Full Name',
          hint:
              l10n?.txtguarantorEnterFullName ?? "Enter guarantor's full name",
          controller: nameController,
          keyboardType: TextInputType.name,
          textCapitalization: TextCapitalization.words,
          maxLength: 80,
          validator: (v) => (v == null || v.trim().length < 2)
              ? (l10n?.txtenterValidName ??
                  'Enter a valid name (at least 2 characters)')
              : null,
        ),
        VoltiumDateField(
          fieldKey: const Key('guarantorDobField'),
          label: l10n?.txtdateOfBirth ?? 'Date of Birth',
          hint: l10n?.txtdobFormatHint ?? 'YYYY-MM-DD',
          controller: dobController,
          onTap: onSelectDob,
          validator: (v) => FormValidators.required(
            v,
            l10n?.txtdateOfBirth ?? 'Date of Birth',
          ),
        ),
        VoltiumPhoneField(
          fieldKey: const Key('guarantorPhoneField'),
          label: l10n?.txtguarantorPhoneNumber ?? 'Guarantor Phone Number',
          isReadOnly: false,
          controller: phoneController,
          isPhoneVerified: isPhoneVerified,
          isSendingOtp: isSendingOtp,
          isOtpSent: isOtpSent,
          isVerifyingOtp: isVerifyingOtp,
          resendCooldown: resendCooldown,
          onSendOtp: onSendOtp,
          onVerifyOtp: onVerifyOtp,
          otpBoxes: otpBoxes,
          validator: FormValidators.indianPhone,
        ),
        VoltiumTextField(
          fieldKey: const Key('guarantorFatherNameField'),
          label: l10n?.txtguarantorFathersName ?? "Father's Name",
          hint: l10n?.txtenterFathersName ?? "Enter father's name",
          controller: fatherNameController,
          keyboardType: TextInputType.name,
          textCapitalization: TextCapitalization.words,
          maxLength: 80,
          validator: (v) => (v == null || v.trim().isEmpty)
              ? (l10n?.txtenterFatherName ?? "Enter father's name")
              : null,
        ),
        VoltiumTextField(
          fieldKey: const Key('guarantorMotherNameField'),
          label: l10n?.txtguarantorMothersName ?? "Mother's Name",
          hint: l10n?.txtenterMothersName ?? "Enter mother's name",
          controller: motherNameController,
          keyboardType: TextInputType.name,
          textCapitalization: TextCapitalization.words,
          maxLength: 80,
          validator: (v) => (v == null || v.trim().isEmpty)
              ? (l10n?.txtenterMotherName ?? "Enter mother's name")
              : null,
        ),
        VoltiumTextField(
          fieldKey: const Key('guarantorAddressField'),
          label: l10n?.txtguarantorCurrentAddress ?? 'Current Address',
          hint: l10n?.txtguarantorEnterAddress ??
              "Enter guarantor's full address",
          helperText: l10n?.txtaddressHelperText ??
              'House no, street, city, state, pin code',
          controller: addressController,
          keyboardType: TextInputType.streetAddress,
          textCapitalization: TextCapitalization.sentences,
          maxLines: 3,
          maxLength: 200,
          validator: (v) => (v == null || v.trim().isEmpty)
              ? (l10n?.txtenterFullAddress ?? 'Enter full address')
              : null,
        ),
      ],
    );
  }
}
