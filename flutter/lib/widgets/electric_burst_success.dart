import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// 20 electric-blue particles radiate outward and dissolve from a center point.
/// Use for top-up success, KYC approval, vehicle assignment, etc.
///
/// Wrap any widget with [ElectricBurstSuccess] and call [trigger] to play
/// the burst animation once.
class ElectricBurstSuccess extends StatefulWidget {
  final Widget child;
  final VoidCallback? onComplete;

  const ElectricBurstSuccess({
    super.key,
    required this.child,
    this.onComplete,
  });

  @override
  State<ElectricBurstSuccess> createState() => ElectricBurstSuccessState();
}

class ElectricBurstSuccessState extends State<ElectricBurstSuccess>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;
  late Animation<double> _anim;
  bool _isAnimating = false;

  // Stable random seed so particles look consistent per trigger
  final math.Random _rng = math.Random();

  static const int _particleCount = 20;

  // Pre-computed per-particle properties
  late List<double> _angles;
  late List<double> _speeds;
  late List<double> _sizes;
  late List<double> _drags;
  late List<int> _shapes; // 0 = circle, 1 = bolt shard, 2 = spark line

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _anim = CurvedAnimation(parent: _ctrl, curve: Curves.easeOutCubic);
    _ctrl.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        setState(() => _isAnimating = false);
        widget.onComplete?.call();
      }
    });
    _generateParticles();
  }

  void _generateParticles() {
    _angles =
        List.generate(_particleCount, (_) => _rng.nextDouble() * math.pi * 2);
    _speeds =
        List.generate(_particleCount, (_) => 0.4 + _rng.nextDouble() * 0.6);
    _sizes =
        List.generate(_particleCount, (_) => 2.0 + _rng.nextDouble() * 4.0);
    _drags =
        List.generate(_particleCount, (_) => 0.6 + _rng.nextDouble() * 0.35);
    _shapes = List.generate(_particleCount, (_) => _rng.nextInt(3));
  }

  /// Trigger the burst. Safe to call multiple times.
  void trigger() {
    _generateParticles();
    setState(() => _isAnimating = true);
    _ctrl.forward(from: 0);
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        widget.child,
        if (_isAnimating)
          Positioned.fill(
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _anim,
                builder: (context, _) => CustomPaint(
                  painter: _BurstPainter(
                    progress: _anim.value,
                    angles: _angles,
                    speeds: _speeds,
                    sizes: _sizes,
                    drags: _drags,
                    shapes: _shapes,
                  ),
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _BurstPainter extends CustomPainter {
  final double progress;
  final List<double> angles;
  final List<double> speeds;
  final List<double> sizes;
  final List<double> drags;
  final List<int> shapes;

  _BurstPainter({
    required this.progress,
    required this.angles,
    required this.speeds,
    required this.sizes,
    required this.drags,
    required this.shapes,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final cx = size.width / 2;
    final cy = size.height / 2;
    final maxRadius = math.min(size.width, size.height) * 0.45;

    for (int i = 0; i < angles.length; i++) {
      final angle = angles[i];
      final speed = speeds[i];
      final drag = drags[i];
      final sz = sizes[i];

      // Distance: ease-out with drag so particles decelerate
      final t = progress;
      final dist = maxRadius * speed * (1 - math.pow(1 - t, drag * 3));
      final opacity = (1 - t).clamp(0.0, 1.0);

      final px = cx + math.cos(angle) * dist;
      final py = cy + math.sin(angle) * dist;

      final color = AppColors.primaryLight.withValues(alpha: opacity * 0.8);
      final glowColor = AppColors.primary.withValues(alpha: opacity * 0.2);

      // Glow
      canvas.drawCircle(
        Offset(px, py),
        sz * 2,
        Paint()
          ..color = glowColor
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 6),
      );

      // Particle shape
      switch (shapes[i]) {
        case 0: // circle
          canvas.drawCircle(
            Offset(px, py),
            sz * (1 - t * 0.5),
            Paint()..color = color,
          );
          break;
        case 1: // bolt shard — small rotated diamond
          final half = sz * 0.7;
          final path = Path()
            ..moveTo(px, py - half)
            ..lineTo(px + half * 0.5, py)
            ..lineTo(px, py + half)
            ..lineTo(px - half * 0.5, py)
            ..close();
          canvas.drawPath(
            path,
            Paint()
              ..color = color
              ..style = PaintingStyle.fill,
          );
          break;
        case 2: // spark line
          final len = sz * 2;
          final sparkPaint = Paint()
            ..color = color
            ..strokeWidth = 1.5
            ..strokeCap = StrokeCap.round;
          canvas.drawLine(
            Offset(px - len * math.cos(angle) * 0.5,
                py - len * math.sin(angle) * 0.5),
            Offset(px + len * math.cos(angle) * 0.5,
                py + len * math.sin(angle) * 0.5),
            sparkPaint,
          );
          break;
      }
    }

    // Central flash ring at start
    if (progress < 0.3) {
      final flashOpacity = (1 - progress / 0.3).clamp(0.0, 1.0);
      final flashRadius = 10 + progress * maxRadius * 0.3;
      canvas.drawCircle(
        Offset(cx, cy),
        flashRadius,
        Paint()
          ..color = AppColors.primary.withValues(alpha: flashOpacity * 0.3)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8),
      );
    }
  }

  @override
  bool shouldRepaint(_BurstPainter old) => old.progress != progress;
}
