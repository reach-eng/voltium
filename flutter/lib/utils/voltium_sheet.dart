/// Unified bottom sheet — consistent drag handle, radius, animation.
///
/// Usage:
/// ```dart
/// showVoltiumSheet(context, child: MySheetContent());
/// ```
library;

import 'package:flutter/material.dart';

/// Shows a modal bottom sheet with Voltium styling:
/// - 20px top radius, no side radius
/// - 40×4 drag handle centered at top
/// - 24px horizontal padding
/// - 300ms ease-out animation
Future<T?> showVoltiumSheet<T>(BuildContext context, {required Widget child, double heightFraction = 0.6}) {
  return showModalBottomSheet<T>(
    context: context,
    isScrollControlled: true,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.only(
        topLeft: Radius.circular(20),
        topRight: Radius.circular(20),
      ),
    ),
    builder: (_) => _VoltiumSheet(child: child),
  );
}

class _VoltiumSheet extends StatelessWidget {
  final Widget child;

  const _VoltiumSheet({required this.child});

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // Drag handle
          Padding(
            padding: const EdgeInsets.only(top: 12, bottom: 8),
            child: Container(
              width: 40,
              height: 4,
              decoration: BoxDecoration(
                color: Colors.grey.shade300,
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
    );
  }
}
