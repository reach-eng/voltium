import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class AnimatedSuccessGlow extends StatefulWidget {
  final double size;
  final Color primaryColor;
  final Color secondaryColor;
  final IconData icon;

  const AnimatedSuccessGlow({
    super.key,
    this.size = 96,
    this.primaryColor = AppColors.successGreen,
    this.secondaryColor = AppColors.successGreen,
    this.icon = Icons.check_circle_outline,
  });

  @override
  State<AnimatedSuccessGlow> createState() => _AnimatedSuccessGlowState();
}

class _AnimatedSuccessGlowState extends State<AnimatedSuccessGlow>
    with TickerProviderStateMixin {
  late final AnimationController _mainCtrl;
  late final AnimationController _glowCtrl;
  late final Animation<double> _scaleAnim;
  late final Animation<double> _rotateAnim;

  @override
  void initState() {
    super.initState();
    _mainCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _glowCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();

    _scaleAnim = CurvedAnimation(
      parent: _mainCtrl,
      curve: const Interval(0.0, 0.6, curve: Curves.elasticOut),
    );
    _rotateAnim = Tween<double>(begin: -math.pi, end: 0).animate(
      CurvedAnimation(
        parent: _mainCtrl,
        curve: const Interval(0.2, 0.8, curve: Curves.easeOutBack),
      ),
    );

    _mainCtrl.forward();
  }

  @override
  void dispose() {
    _mainCtrl.dispose();
    _glowCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: ScaleTransition(
        scale: _scaleAnim,
        child: Stack(
          alignment: Alignment.center,
          children: [
            // Outer glow rings
            AnimatedBuilder(
              animation: _glowCtrl,
              builder: (context, child) {
                return Stack(
                  alignment: Alignment.center,
                  children: [
                    Container(
                      width: (widget.size * 1.35) + (10 * _glowCtrl.value),
                      height: (widget.size * 1.35) + (10 * _glowCtrl.value),
                      decoration: BoxDecoration(
                        color: widget.primaryColor.withValues(alpha: 0.05),
                        shape: BoxShape.circle,
                      ),
                    ),
                    Container(
                      width: (widget.size * 1.15) + (15 * _glowCtrl.value),
                      height: (widget.size * 1.15) + (15 * _glowCtrl.value),
                      decoration: BoxDecoration(
                        color: widget.primaryColor.withValues(alpha: 0.1),
                        shape: BoxShape.circle,
                      ),
                    ),
                  ],
                );
              },
            ),
            // Main circle
            Container(
              width: widget.size,
              height: widget.size,
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [widget.primaryColor, widget.secondaryColor],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                    color: widget.primaryColor.withValues(alpha: 0.3),
                    blurRadius: 24,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: AnimatedBuilder(
                animation: _rotateAnim,
                builder: (context, child) {
                  return Transform.rotate(
                    angle: _rotateAnim.value,
                    child: Icon(
                      widget.icon,
                      color: Colors.white,
                      size: widget.size * 0.583, // ~56 out of 96
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}
