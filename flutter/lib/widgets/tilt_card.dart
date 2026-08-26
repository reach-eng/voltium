import 'dart:math' as math;
import 'package:flutter/material.dart';

/// A card that tilts up to 2° in response to pointer position, creating a
/// layered depth effect with zero GPU cost beyond [Transform].
///
/// Wraps any child widget with the tilt effect. Best used on dashboard cards.
class TiltCard extends StatefulWidget {
  final Widget child;
  final double maxTilt; // in degrees
  final double perspective; // 0.001-0.01, lower = more dramatic
  final bool enabled;

  const TiltCard({
    super.key,
    required this.child,
    this.maxTilt = 2.0,
    this.perspective = 0.004,
    this.enabled = true,
  });

  @override
  State<TiltCard> createState() => _TiltCardState();
}

class _TiltCardState extends State<TiltCard> {
  double _tiltX = 0;
  double _tiltY = 0;

  void _onPointerMove(PointerEvent event) {
    if (!mounted || !widget.enabled) return;
    final box = context.findRenderObject() as RenderBox;
    final localPos = box.globalToLocal(event.position);
    final center = Offset(box.size.width / 2, box.size.height / 2);

    final dx = ((localPos.dx - center.dx) / center.dx).clamp(-1.0, 1.0);
    final dy = ((localPos.dy - center.dy) / center.dy).clamp(-1.0, 1.0);

    setState(() {
      _tiltX = -dy * widget.maxTilt;
      _tiltY = dx * widget.maxTilt;
    });
  }

  void _onPointerExit(_) {
    if (!mounted) return;
    setState(() {
      _tiltX = 0;
      _tiltY = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;

    return MouseRegion(
      onHover: _onPointerMove,
      onExit: _onPointerExit,
      child: Transform(
        alignment: Alignment.center,
        transform: Matrix4.identity()
          ..setEntry(3, 2, widget.perspective)
          ..rotateX(_tiltX * math.pi / 180)
          ..rotateY(_tiltY * math.pi / 180),
        child: widget.child,
      ),
    );
  }
}
