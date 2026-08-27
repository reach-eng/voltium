import 'package:flutter/material.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/form_validators.dart';
import 'package:voltium_rider/widgets/forms/forms.dart';

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

  static String _formatPhone(String rawPhone) {
    final cleanDigits = rawPhone.replaceAll(RegExp(r'\D'), '');
    final tenDigits = cleanDigits.length >= 10
        ? cleanDigits.substring(cleanDigits.length - 10)
        : cleanDigits;
    return tenDigits.length == 10
        ? '+91 ${tenDigits.substring(0, 5)} ${tenDigits.substring(5)}'
        : rawPhone;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final formattedPhone = _formatPhone(phone);

    return VoltiumFormCard(
      title: l10n?.txtpersonalDetails ?? 'Personal Details',
      contextLine: Text(
        l10n?.txtkycContextLine ??
            'These details are required by RBI for two-wheeler rentals',
        style: AppTypography.bodySmall.copyWith(
          color: colors.onSurfaceVariant,
          fontStyle: FontStyle.italic,
        ),
      ),
      children: [
        VoltiumTextField(
          fieldKey: const Key('fullNameField'),
          label: l10n?.txtfullName ?? 'Full Name',
          hint: l10n?.txtenterFullName ?? 'Enter full name',
          controller: nameController,
          enabled: nameEnabled,
          keyboardType: TextInputType.name,
          textCapitalization: TextCapitalization.words,
          maxLength: 80,
          validator: (v) => FormValidators.required(
            v,
            l10n?.txtfullName ?? 'Full Name',
          ),
        ),
        VoltiumTextField(
          fieldKey: const Key('fatherNameField'),
          label: l10n?.txtfathersName ?? "Father's Name",
          hint: l10n?.txtenterFathersName ?? "Enter father's name",
          controller: fatherNameController,
          enabled: fatherNameEnabled,
          keyboardType: TextInputType.name,
          textCapitalization: TextCapitalization.words,
          maxLength: 80,
          validator: (v) => FormValidators.required(
            v,
            l10n?.txtfathersName ?? "Father's Name",
          ),
        ),
        VoltiumTextField(
          fieldKey: const Key('motherNameField'),
          label: l10n?.txtmothersName ?? "Mother's Name",
          hint: l10n?.txtenterMothersName ?? "Enter mother's name",
          controller: motherNameController,
          enabled: motherNameEnabled,
          keyboardType: TextInputType.name,
          textCapitalization: TextCapitalization.words,
          maxLength: 80,
          validator: (v) => FormValidators.required(
            v,
            l10n?.txtmothersName ?? "Mother's Name",
          ),
        ),
        VoltiumDateField(
          fieldKey: const Key('dobField'),
          label: l10n?.txtdateOfBirth ?? 'Date of Birth',
          hint: l10n?.txtdobFormatHint ?? 'YYYY-MM-DD',
          controller: dobController,
          enabled: dobEnabled,
          onTap: onSelectDob,
          validator: (v) => FormValidators.required(
            v,
            l10n?.txtdateOfBirth ?? 'Date of Birth',
          ),
        ),
        VoltiumTextField(
          fieldKey: const Key('emailField'),
          label: l10n?.txtemailAddress ?? 'Email Address',
          hint: l10n?.txtenterEmailAddress ?? 'Enter email address',
          controller: emailController,
          enabled: emailEnabled,
          keyboardType: TextInputType.emailAddress,
          textCapitalization: TextCapitalization.none,
          maxLength: 100,
          validator: (v) => FormValidators.email(v),
        ),
        VoltiumPhoneField(
          label: l10n?.txtphoneNumber ?? 'Phone Number',
          isReadOnly: true,
          readOnlyDisplay: formattedPhone,
        ),
        VoltiumTextField(
          fieldKey: const Key('addressField'),
          label: l10n?.txtcurrentAddress ?? 'Current Address',
          hint: l10n?.txtenterYourFullAddress ?? 'Enter your full address',
          helperText: l10n?.txtaddressHelperText ??
              'House no, street, city, state, pin code',
          controller: addressController,
          enabled: addressEnabled,
          keyboardType: TextInputType.streetAddress,
          textCapitalization: TextCapitalization.sentences,
          maxLines: 3,
          maxLength: 200,
          validator: (v) => FormValidators.required(
            v,
            l10n?.txtcurrentAddress ?? 'Current Address',
          ),
        ),
      ],
    );
  }
}
