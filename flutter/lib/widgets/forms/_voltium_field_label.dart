import 'package:flutter/material.dart';

import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';

/// Shared input-label renderer for Voltium form fields.
///
/// The pickup_hub_widgets.dart file used to host this as a private
/// helper. Promoting it to the form-widgets library means new form
/// widgets do not have to take a feature-local dependency just to
/// render a label, and the form-widgets library can be reused
/// outside the pickup feature without dragging pickup along.
///
/// Callers in the form-widgets library always pass BuildContext via
/// a local `colors` variable captured in the build scope.
Widget buildVoltiumFieldLabel(
  BuildContext context,
  String text, {
  Color? color,
}) {
  final colors = AppColors.of(context);
  return Text(
    text,
    style: AppTypography.labelSmall.copyWith(
      color: color ?? colors.onSurfaceMuted,
      letterSpacing: 1.0,
      fontWeight: FontWeight.w800,
    ),
  );
}
