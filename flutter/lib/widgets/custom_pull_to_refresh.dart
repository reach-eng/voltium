import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';

/// Reliable pull-to-refresh wrapper backed by Flutter standard [RefreshIndicator].
class CustomPullToRefresh extends StatelessWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  final Color? color;
  final double height;

  const CustomPullToRefresh({
    super.key,
    required this.child,
    required this.onRefresh,
    this.color,
    this.height = 80,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: color ?? AppColors.primary,
      child: child,
    );
  }
}
