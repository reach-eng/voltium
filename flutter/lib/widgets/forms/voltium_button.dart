import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';

/// Visual variants for [VoltiumButton]. Maps to the four canonical
/// surface styles in the Voltium design system:
///
/// * [primary] — main CTA. Voltium Blue background, white label.
/// * [secondary] — secondary CTA. Tinted surface, primary-blue label.
/// * [destructive] — destructive action (e.g. delete, cancel).
///   Error-tinted background, white label.
/// * [text] — low-emphasis text button. No background, primary label.
enum VoltiumButtonVariant { primary, secondary, destructive, text }

/// Shared button widget for the Voltium rider app (T-2 / P2,O3 from
/// the design audit, 2026-09-07).
///
/// Centralises the four button styles in one place so screens don't
/// re-roll `ElevatedButton.styleFrom(...)` blocks with subtly
/// different disabled-background colors, foreground colors, or
/// radius values. Adds:
///   * `isLoading` — when true, replaces the label with a
///     [CircularProgressIndicator] and disables the button (sets
///     `onPressed: null` so the disabled-state tokens take over).
///   * `Semantics(button: true, ...)` wrapper — screen readers
///     announce the button as a button and read the
///     [semanticsLabel] (or the visible label).
///
/// Pass either [labelText] (a String) or [label] (a custom Widget).
/// `labelText` is preferred for accessibility — it gets exposed to
/// the screen reader as the button's name.
class VoltiumButton extends StatelessWidget {
  /// Visual variant. Defaults to [VoltiumButtonVariant.primary].
  final VoltiumButtonVariant variant;

  /// Tap handler. When [isLoading] is true, the button is forced
  /// into a disabled state internally (onPressed is null) so the
  /// disabled-style tokens take over. Pass `null` to render a
  /// permanently disabled button.
  final VoidCallback? onPressed;

  /// The button's text label. Required unless [label] is provided.
  /// Styled with [AppTypography.titleSmall].
  final String? labelText;

  /// Custom label widget. Use this when you need more than a Text
  /// (e.g. an icon + text combo controlled by [leadingIcon] plus
  /// custom styling). If both [label] and [labelText] are provided,
  /// [label] wins.
  final Widget? label;

  /// Optional icon to render before the label. Hidden when
  /// [isLoading] is true.
  final IconData? leadingIcon;

  /// When true, renders a [CircularProgressIndicator] in place of
  /// the label and disables the button.
  final bool isLoading;

  /// Read by screen readers as the button's name. Defaults to
  /// [labelText] when null.
  final String? semanticsLabel;

  /// When true, the button fills the parent's width (no padding
  /// adjustment — just `SizedBox.expand` style). Defaults to false.
  final bool expand;

  /// Escape hatch for callers that need a token the variants
  /// don't cover. Applied last so it wins over the variant
  /// defaults.
  final ButtonStyle? styleOverride;

  const VoltiumButton({
    super.key,
    this.variant = VoltiumButtonVariant.primary,
    required this.onPressed,
    this.labelText,
    this.label,
    this.leadingIcon,
    this.isLoading = false,
    this.semanticsLabel,
    this.expand = false,
    this.styleOverride,
  }) : assert(labelText != null || label != null,
            'VoltiumButton: pass either labelText or label');

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final style = _resolveStyle(context, colors);

    // Build the inner row. When loading, swap the label for a
    // spinner; otherwise render leading icon (if any) + label.
    final Widget content = isLoading
        ? SizedBox(
            width: 22,
            height: 22,
            child: CircularProgressIndicator(
              strokeWidth: 2.5,
              // The spinner sits on the same coloured surface as the
              // label, so reuse the resolved foreground colour. If the
              // style doesn't expose one, fall back to white (the
              // brand-primary / destructive / loading state are all
              // dark enough that white reads).
              valueColor: AlwaysStoppedAnimation<Color>(
                style.foregroundColor?.resolve({}) ?? Colors.white,
              ),
            ),
          )
        : Row(
            mainAxisSize: MainAxisSize.min,
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              if (leadingIcon != null) ...[
                Icon(leadingIcon, size: 18),
                const SizedBox(width: 8),
              ],
              if (label != null)
                label!
              else
                Text(
                  labelText!,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    height: 1.2,
                  ),
                ),
            ],
          );

    final button = TextButton(
      onPressed: isLoading ? null : onPressed,
      style: style.copyWith(
        padding: WidgetStateProperty.all(
          const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
        ),
        shape: WidgetStateProperty.all(
          RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.radiusModal),
          ),
        ),
        elevation: WidgetStateProperty.all(0),
      ),
      child: content,
    );

    // Semantics wrap so screen readers announce this as a button
    // (the underlying TextButton already does this, but the explicit
    // wrapper makes the contract obvious and lets us control the
    // label independently of the visible text).
    final effectiveSemanticsLabel = semanticsLabel ??
        labelText ??
        (label is Text ? (label as Text).data : null);

    final semanticallyWrapped = Semantics(
      button: true,
      enabled: !isLoading && onPressed != null,
      label: effectiveSemanticsLabel,
      child: ExcludeSemantics(
        excluding: effectiveSemanticsLabel == null,
        child: button,
      ),
    );

    if (expand) {
      return SizedBox(width: double.infinity, child: semanticallyWrapped);
    }
    return semanticallyWrapped;
  }

  /// Resolve the [ButtonStyle] for the given variant. Returns the
  /// variant-specific style; callers compose [styleOverride] on top
  /// when they need an escape hatch.
  ButtonStyle _resolveStyle(BuildContext context, ThemeColors colors) {
    switch (variant) {
      case VoltiumButtonVariant.primary:
        return TextButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: colors.outlineVariant,
          // T-2 / O2 (design audit, 2026-09-07): white70 on the
          // light outline fill was ~1.6:1 contrast. The disabled
          // foreground is now theme-aware.
          disabledForegroundColor: colors.onSurfaceMuted,
        );
      case VoltiumButtonVariant.secondary:
        return TextButton.styleFrom(
          backgroundColor: colors.iconBackground,
          foregroundColor: AppColors.primary,
          disabledBackgroundColor: colors.outlineVariant,
          disabledForegroundColor: colors.onSurfaceMuted,
        );
      case VoltiumButtonVariant.destructive:
        return TextButton.styleFrom(
          backgroundColor: AppColors.error,
          foregroundColor: Colors.white,
          disabledBackgroundColor: colors.outlineVariant,
          disabledForegroundColor: colors.onSurfaceMuted,
        );
      case VoltiumButtonVariant.text:
        return TextButton.styleFrom(
          backgroundColor: Colors.transparent,
          foregroundColor: AppColors.primary,
          disabledForegroundColor: colors.onSurfaceMuted,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
          minimumSize: const Size(0, 0),
          tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        );
    }
  }
}
