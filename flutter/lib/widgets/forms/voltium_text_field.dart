import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../features/pickup/widgets/pickup_hub_widgets.dart'
    show buildInputLabel;
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '_voltium_field_borders.dart';

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
  final TextInputAction? textInputAction;
  final ValueChanged<String>? onChanged;
  final List<TextInputFormatter>? inputFormatters;
  final Key? fieldKey;
  final Iterable<String>? autofillHints;

  const VoltiumTextField({
    super.key,
    required this.label,
    required this.hint,
    required this.controller,
    this.validator,
    this.keyboardType = TextInputType.text,
    this.textCapitalization = TextCapitalization.sentences,
    this.maxLength,
    this.helperText,
    this.maxLines = 1,
    this.minLines,
    this.enabled = true,
    this.textInputAction,
    this.onChanged,
    this.inputFormatters,
    this.fieldKey,
    this.autofillHints,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildInputLabel(context, label.toUpperCase()),
        const SizedBox(height: 6),
        TextFormField(
          key: fieldKey,
          controller: controller,
          validator: validator,
          readOnly: !enabled,
          keyboardType: keyboardType,
          textCapitalization: textCapitalization,
          maxLength: maxLength,
          maxLines: maxLines,
          minLines: minLines,
          textInputAction: textInputAction,
          onChanged: onChanged,
          inputFormatters: inputFormatters,
          autofillHints: autofillHints,
          style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
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
                      color: isLimit ? AppColors.error : colors.onSurfaceMuted,
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
            helperText: helperText,
            helperStyle: AppTypography.bodySmall.copyWith(
              color: colors.onSurfaceMuted,
              fontSize: 12,
            ),
            helperMaxLines: 2,
            filled: true,
            fillColor: enabled ? colors.iconBackground : colors.outlineVariant,
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
    );
  }
}
