import 'package:flutter/material.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'dart:ui' as ui;

/// "Verify & Proceed" floating button at the bottom of
/// [OtpVerificationScreen].
///
/// Renders a backdrop-blurred glass strip pinned to the bottom safe
/// area. The button is tappable when [canVerify] is true OR the app
/// is in test mode (so the integration test harness can submit
/// without filling the OTP). The "press" effect uses
/// [AnimatedScale] for a subtle 0.96× downscale on tap-down.
class OtpVerifyButton extends StatefulWidget {
  /// True when the user has filled a complete 6-digit code and the
  /// app is not currently in flight.
  final bool canVerify;

  /// True while the network verify call is in flight.
  final bool isLoading;

  /// Called when the user taps the button.
  final VoidCallback onPressed;

  const OtpVerifyButton({
    super.key,
    required this.canVerify,
    required this.isLoading,
    required this.onPressed,
  });

  @override
  State<OtpVerifyButton> createState() => _OtpVerifyButtonState();
}

class _OtpVerifyButtonState extends State<OtpVerifyButton> {
  bool _isPressed = false;

  bool get _isInteractive =>
      AppConstants.isTestMode || (widget.canVerify && !widget.isLoading);

  @override
  Widget build(BuildContext context) {
    final canShowFull = widget.canVerify && !widget.isLoading;
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final verifyingText = l10n?.txtverifying ?? 'Verifying…';
    final verifyAndProceedText =
        l10n?.txtverifyAndProceed ?? 'Verify & Proceed';

    return ClipRRect(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: EdgeInsets.fromLTRB(
              20, 20, 20, MediaQuery.of(context).padding.bottom + 20),
          decoration: BoxDecoration(
            color: colors.card.withValues(alpha: 0.8),
            border: Border(
              top: BorderSide(
                color: colors.outline.withValues(alpha: 0.2),
                width: 1,
              ),
            ),
          ),
          child: GestureDetector(
            key: const Key('verifyOtpButton'),
            behavior: HitTestBehavior.opaque,
            onTapDown: _isInteractive
                ? (_) => setState(() => _isPressed = true)
                : null,
            onTapUp: _isInteractive
                ? (_) => setState(() => _isPressed = false)
                : null,
            onTapCancel: () => setState(() => _isPressed = false),
            onTap: _isInteractive
                ? () {
                    // PR #6: medium haptic on this high-stakes auth action.
                    HapticService.medium();
                    widget.onPressed();
                  }
                : null,
            child: AnimatedScale(
              scale: _isPressed ? 0.96 : 1.0,
              duration: const Duration(milliseconds: 150),
              curve: Curves.easeOutCubic,
              child: AnimatedOpacity(
                opacity: canShowFull ? 1.0 : 0.4,
                duration: const Duration(milliseconds: 200),
                child: Container(
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: AppGradients.primary,
                    borderRadius: BorderRadius.circular(AppRadius.full),
                    boxShadow: canShowFull ? AppShadows.primaryButton : null,
                  ),
                  child: Center(
                    child: widget.isLoading
                        ? Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const SizedBox(
                                width: 20,
                                height: 20,
                                child: CircularProgressIndicator(
                                  color: Colors.white,
                                  strokeWidth: 2,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Text(
                                verifyingText,
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w700,
                                  fontSize: 14,
                                ),
                              ),
                            ],
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                verifyAndProceedText,
                                style: AppTypography.labelLarge
                                    .copyWith(fontWeight: FontWeight.w700)
                                    .copyWith(color: Colors.white),
                              ),
                              const SizedBox(width: 8),
                              const Icon(
                                Icons.arrow_forward,
                                size: 20,
                                color: Colors.white,
                              ),
                            ],
                          ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
