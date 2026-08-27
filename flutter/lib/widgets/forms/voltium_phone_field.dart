import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../features/pickup/widgets/pickup_hub_widgets.dart'
    show buildInputLabel;
import '../../gen/app_localizations.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '../../utils/form_validators.dart';
import '_voltium_field_borders.dart';

/// Standardized phone number field for Voltium forms supporting:
/// 1. Read-only display mode (for rider phone)
/// 2. Interactive OTP verification mode (for guarantor phone)
class VoltiumPhoneField extends StatelessWidget {
  final String label;
  final bool isReadOnly;
  final String? readOnlyDisplay;
  final TextEditingController? controller;
  final bool isPhoneVerified;
  final bool isSendingOtp;
  final bool isOtpSent;
  final bool isVerifyingOtp;
  final int resendCooldown;
  final VoidCallback? onSendOtp;
  final VoidCallback? onVerifyOtp;
  final Widget? otpBoxes;
  final String? Function(String?)? validator;
  final Key? fieldKey;

  const VoltiumPhoneField({
    super.key,
    required this.label,
    this.isReadOnly = false,
    this.readOnlyDisplay,
    this.controller,
    this.isPhoneVerified = false,
    this.isSendingOtp = false,
    this.isOtpSent = false,
    this.isVerifyingOtp = false,
    this.resendCooldown = 0,
    this.onSendOtp,
    this.onVerifyOtp,
    this.otpBoxes,
    this.validator,
    this.fieldKey,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);

    if (isReadOnly) {
      return Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          buildInputLabel(context, label.toUpperCase()),
          const SizedBox(height: 6),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            decoration: BoxDecoration(
              color: colors.outlineVariant,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: colors.outlineVariant, width: 1),
            ),
            child: Row(
              children: [
                Icon(Icons.phone, size: 18, color: colors.onSurfaceMuted),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    readOnlyDisplay ?? '',
                    style: AppTypography.bodyMedium
                        .copyWith(color: colors.onSurface),
                  ),
                ),
              ],
            ),
          ),
        ],
      );
    }

    final phoneDigits = (controller?.text ?? '').replaceAll(RegExp(r'\D'), '');
    final canSendOtp =
        !isSendingOtp && resendCooldown == 0 && phoneDigits.length == 10;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, label.toUpperCase()),
        const SizedBox(height: 6),
        Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              child: TextFormField(
                key: fieldKey,
                controller: controller,
                keyboardType: TextInputType.phone,
                maxLength: 10,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                readOnly: isPhoneVerified,
                validator: validator ?? FormValidators.indianPhone,
                style:
                    AppTypography.bodyMedium.copyWith(color: colors.onSurface),
                decoration: InputDecoration(
                  counterText: '',
                  hintText: l10n?.txtenterPhoneHint ?? 'Enter 10-digit number',
                  hintStyle: GoogleFonts.plusJakartaSans(
                    color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                    fontSize: 14,
                  ),
                  contentPadding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  filled: true,
                  fillColor: isPhoneVerified
                      ? colors.outlineVariant
                      : colors.iconBackground,
                  border: VoltiumFieldBorders.normal(colors),
                  enabledBorder: VoltiumFieldBorders.enabled(colors),
                  focusedBorder: VoltiumFieldBorders.focused(colors),
                  errorBorder: VoltiumFieldBorders.error(colors),
                  focusedErrorBorder: VoltiumFieldBorders.focusedError(colors),
                ),
              ),
            ),
            if (!isPhoneVerified) ...[
              const SizedBox(width: 12),
              SizedBox(
                height: 52,
                child: ElevatedButton(
                  key: const Key('sendOtpButton'),
                  onPressed: canSendOtp ? onSendOtp : null,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.info,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    elevation: 0,
                    minimumSize: const Size(100, 52),
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
                              : (isOtpSent
                                  ? (l10n?.txtresendOtp ?? 'RESEND')
                                  : (l10n?.txtsendOtp ?? 'SEND OTP')),
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
          const SizedBox(height: 8),
          Row(
            children: [
              const Icon(Icons.check_circle,
                  color: AppColors.success, size: 16),
              const SizedBox(width: 6),
              Text(
                l10n?.txtphoneNumberVerified ?? 'Phone Number Verified',
                style: AppTypography.bodySmall.copyWith(
                    fontWeight: FontWeight.w600, color: AppColors.success),
              ),
            ],
          ),
        ],
        if (isOtpSent && !isPhoneVerified) ...[
          const SizedBox(height: 16),
          Text(
            l10n?.txtenterOtp ?? 'Enter OTP',
            style: AppTypography.bodyMedium.copyWith(
                fontSize: 13,
                fontWeight: FontWeight.w600,
                color: colors.onSurfaceVariant),
          ),
          const SizedBox(height: 8),
          if (otpBoxes != null) otpBoxes!,
          const SizedBox(height: 16),
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
                        borderRadius: BorderRadius.circular(AppRadius.lg),
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
                            l10n?.txtverifyOtp ?? 'VERIFY OTP',
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
}
