import 'package:flutter/material.dart';

String a11yLabel(String label) {
  return label;
}

String a11yButton(String action, [String? target]) {
  if (target != null) {
    return '$action $target button';
  }
  return '$action button';
}

String a11yHeading(String text, [String level = '2']) {
  return '$text, heading level $level';
}

String a11yNavigation(String label) {
  return '$label navigation';
}

String a11yStatus(String status) {
  return 'Status: $status';
}

String a11yImage(String description) {
  return description;
}

Widget a11yWrap({
  required Widget child,
  String? label,
  bool? button,
  bool? heading,
  bool? selected,
  String? value,
  bool excludeSemantics = false,
}) {
  if (excludeSemantics) {
    return ExcludeSemantics(child: child);
  }
  return Semantics(
    label: label,
    button: button ?? false,
    header: heading ?? false,
    selected: selected,
    value: value,
    child: child,
  );
}

Widget a11yButtonWidget({
  required Widget child,
  required String label,
  VoidCallback? onTap,
  Key? key,
}) {
  return Semantics(
    button: true,
    label: label,
    child: GestureDetector(
      key: key,
      behavior: HitTestBehavior.opaque,
      onTap: onTap,
      child: child,
    ),
  );
}


/// PR Batch 3 (RA-F-7) — Touch target accessibility standard
/// Minimum touch target size (44×44 dp) per Apple HIG and Android Accessibility guidelines.
const double kMinTouchTarget = 44.0;

/// Wraps [child] in a BoxConstraints/Center wrapper that guarantees at least a
/// [minSize]×[minSize] (default 44.0) touch target area without distorting the child.
Widget a11yTouchTarget({
  required Widget child,
  double minSize = kMinTouchTarget,
  Key? key,
}) {
  return ConstrainedBox(
    key: key,
    constraints: BoxConstraints(
      minWidth: minSize,
      minHeight: minSize,
    ),
    child: Center(
      widthFactor: 1.0,
      heightFactor: 1.0,
      child: child,
    ),
  );
}

