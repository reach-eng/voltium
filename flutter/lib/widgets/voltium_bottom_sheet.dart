import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
export 'package:voltium_rider/utils/voltium_sheet.dart';

/// Shows an expandable / draggable Material 3 bottom sheet with:
/// - Nested DraggableScrollableSheet
/// - Smooth swipe physics and drag handle
/// - Predictive back PopScope support
Future<T?> showVoltiumDraggableSheet<T>({
  required BuildContext context,
  required Widget Function(BuildContext, ScrollController) builder,
  double initialChildSize = 0.5,
  double minChildSize = 0.25,
  double maxChildSize = 0.9,
  bool canPop = true,
  void Function(bool, dynamic)? onPopInvoked,
}) {
  final colors = AppColors.of(context);
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    backgroundColor: Colors.transparent,
    builder: (_) => PopScope(
      canPop: canPop,
      onPopInvokedWithResult: (didPop, result) {
        if (onPopInvoked != null) {
          onPopInvoked(didPop, result);
        }
      },
      child: DraggableScrollableSheet(
        initialChildSize: initialChildSize,
        minChildSize: minChildSize,
        maxChildSize: maxChildSize,
        expand: false,
        builder: (context, scrollController) {
          return Container(
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius:
                  const BorderRadius.vertical(top: Radius.circular(24)),
              border: Border.all(
                color: colors.outlineVariant.withValues(alpha: 0.5),
                width: 1,
              ),
            ),
            child: Column(
              children: [
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
                Expanded(
                  child: builder(context, scrollController),
                ),
              ],
            ),
          );
        },
      ),
    ),
  );
}
