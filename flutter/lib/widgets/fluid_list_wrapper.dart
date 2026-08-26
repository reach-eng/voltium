import 'package:flutter/material.dart';
import 'package:flutter_animate/flutter_animate.dart';

/// A wrapper for list items that applies a high-end, staggered entry animation.
/// It uses a custom cubic-bezier curve to slide up and fade in, giving a heavy,
/// physical feel to the motion choreography.
class FluidStaggeredItem extends StatelessWidget {
  final Widget child;
  final int index;
  final double delayMultiplierMs;
  final double yOffset;

  const FluidStaggeredItem({
    super.key,
    required this.child,
    required this.index,
    this.delayMultiplierMs = 75.0,
    this.yOffset = 30.0,
  });

  @override
  Widget build(BuildContext context) {
    // Calculate the delay based on the index to create a staggered effect
    final delay = (index * delayMultiplierMs).ms;

    return child
        .animate(delay: delay)
        .fade(
          duration: 800.ms,
          curve: Curves.easeOutCubic,
        )
        .slideY(
          begin: yOffset / 100.0, // Slide up from yOffset
          end: 0,
          duration: 800.ms,
          curve: Curves.easeOutCubic,
        );
  }
}
