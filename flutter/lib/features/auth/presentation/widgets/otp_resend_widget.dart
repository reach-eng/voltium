import 'package:flutter/material.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// "DIDN'T RECEIVE THE CODE?" + Resend button/countdown for
/// [OtpVerificationScreen].
///
/// The widget owns the countdown timer. While [remainingSeconds] is
/// > 0, the tap target is disabled and the label shows
/// "Resend in Ns". When it hits 0, the label flips to
/// "Resend Code" and taps invoke [onResend].
///
/// The parent owns the actual resend call (network + PostHog +
/// SnackBar) and is responsible for resetting the countdown by
/// passing a fresh [remainingSeconds] value (e.g. back to 30) on
/// success.
class OtpResendWidget extends StatelessWidget {
  /// Seconds remaining before the user can resend. 0 = ready to resend.
  final int remainingSeconds;

  /// Called when the user taps "Resend Code" (only when [remainingSeconds]
  /// is 0).
  final VoidCallback onResend;

  const OtpResendWidget({
    super.key,
    required this.remainingSeconds,
    required this.onResend,
  });

  bool get _canResend => remainingSeconds <= 0;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final title = l10n?.txtdidntReceiveCode ?? "DIDN'T RECEIVE THE CODE?";
    final resendText = _canResend
        ? (l10n?.txtresendCode ?? 'Resend Code')
        : (l10n?.txtresendIn(remainingSeconds) ??
            'Resend in ${remainingSeconds}s');

    return Column(
      children: [
        Text(
          title,
          style: AppTypography.bodySmall
              .copyWith(fontWeight: FontWeight.w800)
              .copyWith(
                letterSpacing: 1.2,
                color: colors.onSurfaceVariant,
              ),
        ),
        const SizedBox(height: 8),
        GestureDetector(
          key: const Key('resendCodeButton'),
          onTap: _canResend ? onResend : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12, horizontal: 16),
            child: Text(
              resendText,
              style: AppTypography.labelLarge
                  .copyWith(fontWeight: FontWeight.w700)
                  .copyWith(
                    color:
                        _canResend ? AppColors.primary : colors.onSurfaceMuted,
                  ),
            ),
          ),
        ),
      ],
    );
  }
}
