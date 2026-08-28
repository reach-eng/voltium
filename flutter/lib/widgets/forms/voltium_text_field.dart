import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '_voltium_field_borders.dart';
import '_voltium_field_label.dart';

/// Standardized text field used across Voltium onboarding and management forms.
class VoltiumTextField extends StatelessWidget {
  final String label;
  final String hint;
  final TextEditingController controller;
  final String? Function(String?)? validator;
  final TextInputType keyboardType;
  final TextCapitalization textCapitalization;
  final int? maxLength;
  final String? helperText;
  final int maxLines;
  final int? minLines;
  final bool enabled;
  final bool readOnly;
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final List<TextInputFormatter>? inputFormatters;
  final Key? fieldKey;
  final Iterable<String>? autofillHints;
  final Widget? prefixIcon;
  final Widget? suffixIcon;

  const VoltiumTextField({
    super.key,
    required this.label,
    required this.hint,
    required this.controller,
    this.validator,
    this.keyboardType = TextInputType.text,
    // PR-I: default changed from TextCapitalization.sentences to
    // TextCapitalization.none. The sentences default silently
    // auto-capitalised "pan" → "Pan", which broke PAN regex
    // validation in callers that pass a numeric/identifier
    // value (Aadhaar, IFSC, vehicle number, etc.). The new
    // default is the safe choice — fields that need
    // sentence/word capitalization (free-text fields like
    // address or proper-noun name fields) must pass an
    // explicit textCapitalization. All current production
    // call sites already do.
    this.textCapitalization = TextCapitalization.none,
    this.maxLength,
    this.helperText,
    this.maxLines = 1,
    this.minLines,
    this.enabled = true,
    this.readOnly = false,
    this.textInputAction,
    this.onChanged,
    this.inputFormatters,
    this.fieldKey,
    this.autofillHints,
    this.prefixIcon,
    this.suffixIcon,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    // Wrap in [Semantics] so screen readers (TalkBack, VoiceOver)
    // announce the field as a single labeled text field rather
    // than reading each sub-widget individually. textField: true
    // tells the screen reader this is an editable text input.
    return Semantics(
      textField: true,
      label: label,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          buildVoltiumFieldLabel(context, label.toUpperCase()),
          const SizedBox(height: 6),
          TextFormField(
            key: fieldKey,
            controller: controller,
            validator: validator,
            // readOnly is independent of enabled: a field can be enabled
            // but not editable (e.g. primary phone shows a lock icon).
            // If readOnly is true, the user can still focus the field to
            // see the helper text but cannot change the value.
            readOnly: readOnly,
            keyboardType: keyboardType,
            textCapitalization: textCapitalization,
            maxLength: maxLength,
            maxLines: maxLines,
            minLines: minLines,
            textInputAction: textInputAction,
            onChanged: onChanged,
            inputFormatters: inputFormatters,
            autofillHints: autofillHints,
            style: AppTypography.bodyMedium.copyWith(
              color: enabled
                  ? (readOnly ? colors.onSurfaceMuted : colors.onSurface)
                  : colors.onSurfaceMuted,
            ),
            buildCounter: maxLength != null
                ? (
                    context, {
                    required currentLength,
                    required isFocused,
                    maxLength,
                  }) {
                    final isLimit = currentLength >= (maxLength ?? 0);
                    return Text(
                      '$currentLength/$maxLength',
                      style: AppTypography.labelSmall.copyWith(
                        color:
                            isLimit ? AppColors.error : colors.onSurfaceMuted,
                        fontSize: 11,
                      ),
                    );
                  }
                : null,
            decoration: InputDecoration(
              hintText: hint,
              hintStyle: GoogleFonts.plusJakartaSans(
                color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                fontSize: 14,
              ),
              prefixIcon: prefixIcon,
              suffixIcon: suffixIcon,
              helperText: helperText,
              helperStyle: AppTypography.bodySmall.copyWith(
                color: colors.onSurfaceMuted,
                fontSize: 12,
              ),
              helperMaxLines: 2,
              filled: true,
              fillColor:
                  enabled ? colors.iconBackground : colors.outlineVariant,
              contentPadding:
                  const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              border: VoltiumFieldBorders.normal(colors),
              enabledBorder: VoltiumFieldBorders.enabled(colors),
              focusedBorder: VoltiumFieldBorders.focused(colors),
              errorBorder: VoltiumFieldBorders.error(colors),
              focusedErrorBorder: VoltiumFieldBorders.focusedError(colors),
            ),
          ),
        ],
      ),
    );
  }
}
