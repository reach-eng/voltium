import 'package:flutter/material.dart';
import 'tilt_card.dart';

/// Wraps a child card with a subtle 2° parallax tilt that responds to the
/// pointer position. Consolidates card tilt functionality across dashboard bento tiles.
class CardParallaxTilt extends StatelessWidget {
  final Widget child;
  final double maxTiltDegrees;
  final EdgeInsets? padding;

  const CardParallaxTilt({
    super.key,
    required this.child,
    this.maxTiltDegrees = 2.0,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    final body = TiltCard(
      maxTilt: maxTiltDegrees,
      child: child,
    );
    if (padding != null) {
      return Padding(padding: padding!, child: body);
    }
    return body;
  }
}
