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

Widget a11yFocusable({
  required Widget child,
  String? semanticsLabel,
  FocusNode? focusNode,
}) {
  return Focus(
    focusNode: focusNode,
    child: Semantics(
      label: semanticsLabel,
      child: child,
    ),
  );
}
