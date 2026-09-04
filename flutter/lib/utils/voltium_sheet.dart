/// Unified Material 3 bottom sheet — consistent drag handle, radius, animation.
///
/// Usage:
/// ```dart
/// showVoltiumSheet(context, child: MySheetContent());
/// ```
library;

import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';

/// Shows a modal bottom sheet with Voltium Material 3 styling:
/// - 24px top radius
/// - Theme-aware drag handle centered at top
/// - 24px horizontal padding
/// - Integrated PopScope for predictive back gestures
Future<T?> showVoltiumSheet<T>(
  BuildContext context, {
  required Widget child,
  double heightFraction = 0.6,
  bool enableDrag = true,
  bool isDismissible = true,
  bool canPop = true,
  void Function(bool, dynamic)? onPopInvoked,
}) {
  final colors = AppColors.of(context);
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    enableDrag: enableDrag,
    isDismissible: isDismissible,
    backgroundColor: colors.card,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.only(
        topLeft: Radius.circular(24),
        topRight: Radius.circular(24),
      ),
    ),
    builder: (_) => PopScope(
      canPop: canPop,
      onPopInvokedWithResult: (didPop, result) {
        if (onPopInvoked != null) {
          onPopInvoked(didPop, result);
        }
      },
      child: _VoltiumSheet(child: child),
    ),
  );
}

class _VoltiumSheet extends StatelessWidget {
  final Widget child;

  const _VoltiumSheet({required this.child});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SafeArea(
      top: false,
      child: Padding(
        padding: EdgeInsets.only(
          bottom: MediaQuery.of(context).viewInsets.bottom,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            // M3 Drag handle
            Padding(
              padding: const EdgeInsets.only(top: 12, bottom: 8),
              child: Container(
                width: 36,
                height: 4,
                decoration: BoxDecoration(
                  color: colors.outlineVariant,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            ),
            // Content
            Flexible(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(24, 8, 24, 24),
                child: child,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
