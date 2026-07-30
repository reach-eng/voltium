import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/accessibility.dart';
import 'package:voltium_rider/utils/app_constants.dart';

/// The "Enter" / "Send OTP" pill button at the bottom of [LoginScreen].
///
/// In test mode, the button is always tappable (so the integration test
/// harness can submit). Otherwise, [canSubmit] gates both the visual
/// state (opacity, shadow) and the actual [onPressed] callback.
///
/// The widget is a [StatefulWidget] only because it tracks the
/// `_isPressed` flag for the AnimatedScale on press-down. There is no
/// business state here — the parent owns the loading flag and the
/// submission lifecycle.
class OtpTriggerWidget extends StatefulWidget {
  /// When true, button is at full opacity and tappable.
  final bool canSubmit;

  /// When true, shows a spinner instead of the "Enter" label.
  final bool isLoading;

  /// Called when the user taps a tappable button.
  final VoidCallback onPressed;

  const OtpTriggerWidget({
    super.key,
    required this.canSubmit,
    required this.isLoading,
    required this.onPressed,
  });

  @override
  State<OtpTriggerWidget> createState() => _OtpTriggerWidgetState();
}

class _OtpTriggerWidgetState extends State<OtpTriggerWidget> {
  bool _isPressed = false;

  bool get _isInteractive => widget.canSubmit || AppConstants.isTestMode;

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: a11yButton('Send OTP'),
      child: Focus(
        child: GestureDetector(
          key: const Key('sendOtpButton'),
          behavior: HitTestBehavior.opaque,
          onTapDown:
              _isInteractive ? (_) => setState(() => _isPressed = true) : null,
          onTapUp:
              _isInteractive ? (_) => setState(() => _isPressed = false) : null,
          onTapCancel: () => setState(() => _isPressed = false),
          onTap: AppConstants.isTestMode
              ? widget.onPressed
              : (widget.canSubmit ? widget.onPressed : null),
          child: AnimatedScale(
            scale: _isPressed ? 0.96 : 1.0,
            duration: const Duration(milliseconds: 150),
            curve: Curves.easeOutCubic,
            child: AnimatedOpacity(
              opacity: widget.canSubmit ? 1.0 : 0.4,
              duration: const Duration(milliseconds: 200),
              child: Container(
                width: double.infinity,
                height: 56,
                decoration: BoxDecoration(
                  gradient: AppGradients.primary,
                  borderRadius: BorderRadius.circular(AppRadius.full),
                  boxShadow: widget.canSubmit ? AppShadows.primaryButton : null,
                ),
                child: Center(
                  child: widget.isLoading
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(
                            color: Colors.white,
                            strokeWidth: 2,
                          ),
                        )
                      : Text(
                          'Enter',
                          style: AppTypography.buttonMedium
                              .copyWith(color: Colors.white),
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
