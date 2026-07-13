import 'dart:math' as math;
import 'package:flutter/material.dart';

/// An electric burst success animation: 20 electric-blue particles that radiate
/// outward and dissolve. Uses [CustomPainter] for zero-widget overhead.
///
/// For top-up success, KYC approval, and vehicle assignment.
class ElectricBurst extends StatefulWidget {
  final bool play;
  final VoidCallback? onComplete;
  final double size;

  const ElectricBurst({
    super.key,
    this.play = false,
    this.onComplete,
    this.size = 200,
  });

  @override
  State<ElectricBurst> createState() => _ElectricBurstState();
}

class _ElectricBurstState extends State<ElectricBurst>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _animation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    );
    _controller.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        widget.onComplete?.call();
      }
    });
    if (widget.play) _controller.forward();
  }

  @override
  void didUpdateWidget(ElectricBurst oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.play && !oldWidget.play) {
      _controller.forward(from: 0);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return CustomPaint(
          size: Size(widget.size, widget.size),
          painter: _BurstPainter(
            progress: _animation.value,
          ),
        );
      },
    );
  }
}

class _BurstPainter extends CustomPainter {
  final double progress;

  _BurstPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final maxRadius = size.width * 0.45;
    final random = math.Random(42); // Seeded for deterministic placement

    // 20 electric-blue particles
    const particleCount = 20;
    const colors = [
      Color(0xFFDBEAFE), // blue-100
      Color(0xFF93C5FD), // blue-300
      Color(0xFF60A5FA), // blue-400
      Color(0xFF3B82F6), // blue-500
      Color(0xFF2563EB), // blue-600
      Color(0xFF1D4ED8), // blue-700
      Color(0xFFFFFFFF), // white spark
    ];

    for (int i = 0; i < particleCount; i++) {
      final angle = random.nextDouble() * math.pi * 2;
      final distance = random.nextDouble() * 0.6 + 0.4; // 0.4-1.0
      final delay = random.nextDouble() * 0.3; // Stagger

      // Each particle has its own progress with delay
      final p = ((progress - delay) / (1 - delay)).clamp(0.0, 1.0);
      if (p <= 0) continue;

      // Radius expands outward
      final radius = maxRadius * distance * p;

      // Size shrinks from 4px to 0px
      final particleSize = (4.0 * (1 - p)).clamp(0.5, 4.0);

      // Opacity fades
      final opacity = (1 - p).clamp(0.0, 1.0);

      // Color shift from white → blue → transparent
      final colorIndex = (random.nextDouble() * (colors.length - 1)).round();
      final baseColor = colors[colorIndex];
      final color = baseColor.withValues(alpha: opacity);

      final x = center.dx + math.cos(angle) * radius;
      final y = center.dy + math.sin(angle) * radius;

      // Draw particle as a small circle
      canvas.drawCircle(
        Offset(x, y),
        particleSize,
        Paint()
          ..color = color
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2),
      );

      // Draw trail (smaller, more transparent circle behind)
      if (p > 0.1) {
        final trailRadius = maxRadius * distance * (p - 0.1);
        final tx = center.dx + math.cos(angle) * trailRadius;
        final ty = center.dy + math.sin(angle) * trailRadius;
        canvas.drawCircle(
          Offset(tx, ty),
          particleSize * 0.5,
          Paint()
            ..color = color.withValues(alpha: opacity * 0.3)
            ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 1),
        );
      }
    }

    // Central flash ring
    if (progress < 0.4) {
      final ringProgress = (progress / 0.4).clamp(0.0, 1.0);
      final ringRadius = maxRadius * ringProgress * 0.3;
      canvas.drawCircle(
        center,
        ringRadius,
        Paint()
          ..color = Colors.white.withValues(alpha: (1 - ringProgress) * 0.6)
          ..style = PaintingStyle.stroke
          ..strokeWidth = 2.0 * (1 - ringProgress)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4),
      );
    }
  }

  @override
  bool shouldRepaint(_BurstPainter old) => old.progress != progress;
}
