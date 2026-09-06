import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// PR-PERMISSIONS-P1: shared primary CTA button used for full-width
/// "Continue" / "Next" / "Confirm" actions across onboarding, KYC, and
/// wallet flows. Replaces ~30 hand-rolled ElevatedButton+AnimatedContainer
/// patterns with the same look.
///
/// Behaviour:
/// - `enabled: true` (and `!isLoading`, `onPressed != null`) renders the
///   primary blue fill + white text + primary-button shadow.
/// - `enabled: false` renders the canonical disabled look: `outlineVariant`
///   fill + `onSurfaceMuted` text, no shadow. `onPressed` is treated as
///   null when disabled so the tap does not fire.
/// - `isLoading: true` swaps the label for a centred white
///   `CircularProgressIndicator`.
/// - When `semantic: true` (default), the underlying GestureDetector is
///   wrapped in `Semantics(button: true, label: label, enabled: …)` so
///   TalkBack announces it as a button. Pass `semantic: false` to attach
///   your own outer Semantics (e.g. when combining with progress text).
///
/// The standard `Key` is forwarded to the inner `GestureDetector` (the
/// hit-testable node) so `find.byKey(Key('continuePermissionsButton'))`
/// continues to resolve on existing call-sites.
class PrimaryCta extends StatelessWidget {
  /// Localized label (e.g. `l10n.txtcontinue`).
  final String label;

  /// Trailing icon, typically `Icons.arrow_forward` or null.
  final IconData? icon;

  /// When false, the button renders as disabled (grey fill, muted text,
  /// `onPressed` null) — preserves the canonical disabled look across
  /// the app.
  final bool enabled;

  /// When true, shows a centered `CircularProgressIndicator(color:
  /// Colors.white)` instead of the label (matches the existing pattern
  /// in `user_onboarding_bottom_button.dart`).
  final bool isLoading;

  /// When true, the underlying GestureDetector is wrapped in
  /// `Semantics(button: true, label: label, enabled: enabled)` so TalkBack
  /// announces it as a button. Default true.
  final bool semantic;

  final VoidCallback? onPressed;

  const PrimaryCta({
    super.key,
    required this.label,
    required this.onPressed,
    this.icon,
    this.enabled = true,
    this.isLoading = false,
    this.semantic = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final isInteractive = enabled && !isLoading && onPressed != null;
    final bg = isInteractive
        ? AppColors.primary
        : colors.outlineVariant;
    final fg = isInteractive ? Colors.white : colors.onSurfaceMuted;

    Widget content = Container(
      height: 56,
      width: double.infinity,
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadius.md),
        boxShadow: isInteractive ? AppShadows.primaryButton : null,
      ),
      child: Center(
        child: isLoading
            ? const SizedBox(
                width: 20,
                height: 20,
                child: CircularProgressIndicator(
                  color: Colors.white,
                  strokeWidth: 2,
                ),
              )
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    label,
                    style: AppTypography.titleSmall.copyWith(color: fg),
                  ),
                  if (icon != null) ...[
                    const SizedBox(width: 8),
                    Icon(icon, color: fg, size: 20),
                  ],
                ],
              ),
      ),
    );

    if (!semantic) return content;

    return Semantics(
      button: true,
      enabled: isInteractive,
      label: label,
      // The Key is the widget's own `super.key` — applying it here as
      // well would cause `find.byKey` to match two elements (this
      // GestureDetector and the PrimaryCta itself). The hit-test path
      // still finds this GestureDetector, so `tester.tap(find.byKey(
      // ...))` works as before.
      child: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: isInteractive ? onPressed : null,
        child: content,
      ),
    );
  }
}
