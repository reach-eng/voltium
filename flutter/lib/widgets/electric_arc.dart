import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// An electric arc spark trail that travels from one tab to another across the
/// bottom nav bar. 300ms CustomPainter overlay.
///
/// Usage: wrap the bottom nav bar with this widget and call [animateTo] when
/// the tab changes.
class ElectricArc extends StatefulWidget {
  final Widget child;
  final Color arcColor;

  const ElectricArc({
    super.key,
    required this.child,
    this.arcColor = AppColors.primary,
  });

  @override
  State<ElectricArc> createState() => ElectricArcState();
}

class ElectricArcState extends State<ElectricArc>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;
  double _startX = 0;
  double _endX = 0;
  bool _isAnimating = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _animation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOutCubic,
    );
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        setState(() => _isAnimating = false);
      }
    });
  }

  /// Trigger arc animation from [oldIndex] to [newIndex].
  /// Call this when the tab changes.
  void animateTo(int oldIndex, int newIndex) {
    if (!mounted) return;
    final renderBox = context.findRenderObject() as RenderBox?;
    if (renderBox == null) return;

    final width = renderBox.size.width;
    if (width <= 0) return;

    final tabWidth = width / 4; // 4 tabs
    _startX = tabWidth * oldIndex + tabWidth / 2;
    _endX = tabWidth * newIndex + tabWidth / 2;
    _isAnimating = true;
    _controller.forward(from: 0);
    setState(() {});
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child,
        if (_isAnimating)
          Positioned.fill(
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _animation,
                builder: (context, child) {
                  return LayoutBuilder(
                    builder: (context, constraints) {
                      return CustomPaint(
                        painter: _ArcPainter(
                          progress: _animation.value,
                          startX: _startX,
                          endX: _endX,
                          height: constraints.maxHeight,
                          arcColor: widget.arcColor,
                        ),
                      );
                    },
                  );
                },
              ),
            ),
          ),
      ],
    );
  }
}

class _ArcPainter extends CustomPainter {
  final double progress;
  final double startX;
  final double endX;
  final double height;
  final Color arcColor;

  _ArcPainter({
    required this.progress,
    required this.startX,
    required this.endX,
    required this.height,
    required this.arcColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final currentX = startX + (endX - startX) * progress;

    // Arc path: curves upward from the starting tab position to the current
    // position, with a "spark trail" trailing behind.
    final arcHeight = height * 0.5;
    final arcPath = Path();

    // Main arc
    final midX = (startX + currentX) / 2;
    arcPath.moveTo(startX, height);
    arcPath.quadraticBezierTo(midX, height - arcHeight, currentX, height);

    final arcPaint = Paint()
      ..color = arcColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2.0
      ..strokeCap = StrokeCap.round;

    canvas.drawPath(arcPath, arcPaint);

    // Spark at the head of the arc
    canvas.drawCircle(
      Offset(currentX, height),
      3.0,
      Paint()
        ..color = Colors.white
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 3),
    );

    // Glow around the arc
    canvas.drawPath(
      arcPath,
      Paint()
        ..color = arcColor.withValues(alpha: 0.2)
        ..style = PaintingStyle.stroke
        ..strokeWidth = 6.0
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
    ); // Spark trail particles behind the head
    final segments = 6;
    for (int i = 0; i < segments; i++) {
      final trailProgress = (progress - (i + 1) * 0.02).clamp(0.0, 1.0);
      if (trailProgress < progress) {
        final trailX = startX + (endX - startX) * trailProgress;
        final trailY = height -
            arcHeight * math.sin(trailProgress * math.pi).clamp(0.0, 1.0);
        final alpha = ((1 - (i / segments)) * 0.6).clamp(0.0, 1.0);
        final size = 2.0 * (1 - i / segments);
        canvas.drawCircle(
          Offset(trailX, trailY),
          size.clamp(0.5, 3.0),
          Paint()
            ..color = arcColor.withValues(alpha: alpha)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2),
        );
      }
    }
  }

  @override
  bool shouldRepaint(_ArcPainter old) => old.progress != progress;
}
