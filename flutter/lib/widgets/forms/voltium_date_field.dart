import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';
import '_voltium_field_borders.dart';
import '_voltium_field_label.dart';

/// Standardized date of birth/date selection field for Voltium forms.
///
/// The [controller] is expected to hold an ISO-8601 date string
/// (typically `yyyy-MM-dd`) — the same format the server consumes
/// and the form's validators read. Display localization is the
/// consumer's responsibility: when wiring `onTap` to `showDatePicker`,
/// pass `locale: Localizations.localeOf(context)` so the picker's
/// calendar renders in the active locale (PR-B, 2026-08-28).
class VoltiumDateField extends StatelessWidget {
  final String label;
  final String hint;
  final TextEditingController controller;
  final VoidCallback onTap;
  final String? Function(String?)? validator;
  final bool enabled;
  final Key? fieldKey;

  const VoltiumDateField({
    super.key,
    required this.label,
    required this.hint,
    required this.controller,
    required this.onTap,
    this.validator,
    this.enabled = true,
    this.fieldKey,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        buildVoltiumFieldLabel(context, label.toUpperCase()),
        const SizedBox(height: 6),
        InkWell(
          onTap: enabled ? onTap : null,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          child: AbsorbPointer(
            child: TextFormField(
              key: fieldKey,
              controller: controller,
              readOnly: true,
              validator: validator,
              style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
              decoration: InputDecoration(
                hintText: hint,
                hintStyle: GoogleFonts.plusJakartaSans(
                  color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                  fontSize: 14,
                ),
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
                suffixIcon: Icon(
                  Icons.calendar_today,
                  size: 18,
                  color: enabled ? AppColors.primary : colors.onSurfaceMuted,
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
