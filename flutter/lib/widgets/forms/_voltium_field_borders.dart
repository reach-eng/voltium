import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

/// Internal helper for creating standard form field borders across all Voltium form fields.
class VoltiumFieldBorders {
  VoltiumFieldBorders._();

  static OutlineInputBorder normal(ThemeColors colors) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: BorderSide(color: colors.outlineVariant, width: 1),
      );

  static OutlineInputBorder enabled(ThemeColors colors) => normal(colors);

  static OutlineInputBorder focused(ThemeColors colors) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      );

  static OutlineInputBorder error(ThemeColors colors) => OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: const BorderSide(color: AppColors.error, width: 1),
      );

  static OutlineInputBorder focusedError(ThemeColors colors) =>
      OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: const BorderSide(color: AppColors.error, width: 2),
      );
}
