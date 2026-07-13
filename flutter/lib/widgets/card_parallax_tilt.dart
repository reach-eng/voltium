import 'dart:math' as math;
import 'package:flutter/material.dart';

/// Wraps a child card with a subtle 2° parallax tilt that responds to the
/// pointer/scroll position. Zero GPU cost beyond Transform — no layout
/// thrashing, no repaints.
///
/// Works best on dashboard bento tiles, wallet cards, and any card that
/// should feel "layered" on scroll.
class CardParallaxTilt extends StatefulWidget {
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
  State<CardParallaxTilt> createState() => _CardParallaxTiltState();
}

class _CardParallaxTiltState extends State<CardParallaxTilt> {
  // Normalised pointer position relative to widget center: -1..1
  double _normX = 0;
  double _normY = 0;

  double get _maxTilt => widget.maxTiltDegrees * math.pi / 180;

  void _onPointerExit(PointerEvent _) {
    setState(() {
      _normX = 0;
      _normY = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onHover: (event) {
        final box = context.findRenderObject() as RenderBox?;
        if (box == null) return;
        final size = box.size;
        final local = box.globalToLocal(event.position);
        setState(() {
          _normX = ((local.dx / size.width) * 2 - 1).clamp(-1.0, 1.0);
          _normY = ((local.dy / size.height) * 2 - 1).clamp(-1.0, 1.0);
        });
      },
      onExit: _onPointerExit,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        curve: Curves.easeOut,
        padding: widget.padding,
        transform: Matrix4.identity()
          ..setEntry(3, 2, 0.001) // perspective
          ..rotateY(_normX * _maxTilt)
          ..rotateX(-_normY * _maxTilt),
        transformAlignment: Alignment.center,
        child: widget.child,
      ),
    );
  }
}
