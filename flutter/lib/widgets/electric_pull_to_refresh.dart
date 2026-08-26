import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';

/// A branded pull-to-refresh indicator that shows an electric bolt icon
/// rotating and glowing proportional to pull distance.
///
/// Wraps a standard `RefreshIndicator` with custom styling.
///
/// Usage:
/// ```dart
/// ElectricPullToRefresh(
///   onRefresh: () => ref.read(appProvider).refresh(),
///   child: ListView(...),
/// )
/// ```
class ElectricPullToRefresh extends StatelessWidget {
  final Future<void> Function() onRefresh;
  final Widget child;
  final double displacement;

  const ElectricPullToRefresh({
    super.key,
    required this.onRefresh,
    required this.child,
    this.displacement = 60,
  });

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: onRefresh,
      color: AppColors.primary,
      backgroundColor: AppColors.of(context).card,
      displacement: displacement,
      strokeWidth: 2.5,
      child: child,
    );
  }
}

/// A custom refresh indicator header with a bolt icon that rotates
/// proportional to pull progress and glows when fully charged.
///
/// Use with `CustomRefreshIndicator` for full control.
class BoltRefreshHeader extends StatelessWidget {
  final double pullProgress; // 0.0 to 1.0

  const BoltRefreshHeader({super.key, required this.pullProgress});

  @override
  Widget build(BuildContext context) {
    final clamped = pullProgress.clamp(0.0, 1.0);
    final glowOpacity = (clamped * 0.4).clamp(0.0, 0.4);
    final boltColor = Color.lerp(
      AppColors.outline,
      AppColors.primary,
      clamped,
    )!;

    return SizedBox(
      height: 60,
      child: Center(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: clamped >= 1.0
              ? SizedBox(
                  key: const ValueKey('spinner'),
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: AppColors.primary,
                  ),
                )
              : Transform.rotate(
                  key: const ValueKey('bolt'),
                  angle: clamped * math.pi * 2,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color:
                              AppColors.primary.withValues(alpha: glowOpacity),
                          blurRadius: 16,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.electric_bolt,
                      color: boltColor,
                      size: 24,
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}
