import 'dart:math';
import 'dart:ui';
import 'package:flutter/material.dart';

class Particle {
  double x;
  double y;
  double vx;
  double vy;
  double radius;
  double opacity;
  Color color;

  Particle({
    required this.x,
    required this.y,
    required this.vx,
    required this.vy,
    required this.radius,
    required this.opacity,
    required this.color,
  });
}

class ParticleEffect extends StatefulWidget {
  final Widget child;
  final int particleCount;
  final Color color;
  final double speed;
  final bool enabled;

  const ParticleEffect({
    super.key,
    required this.child,
    this.particleCount = 50,
    this.color = Colors.amber,
    this.speed = 1.0,
    this.enabled = true,
  });

  @override
  State<ParticleEffect> createState() => _ParticleEffectState();
}

class _ParticleEffectState extends State<ParticleEffect>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  final List<Particle> _particles = [];
  final Random _random = Random();
  Size _size = Size.zero;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )..repeat();
    _controller.addListener(_updateParticles);
  }

  void _initParticles(Size size) {
    _particles.clear();
    for (int i = 0; i < widget.particleCount; i++) {
      _particles.add(Particle(
        x: _random.nextDouble() * size.width,
        y: _random.nextDouble() * size.height,
        vx: (_random.nextDouble() - 0.5) * 2 * widget.speed,
        vy: (_random.nextDouble() - 0.5) * 2 * widget.speed,
        radius: _random.nextDouble() * 3 + 1,
        opacity: _random.nextDouble() * 0.5 + 0.2,
        color: widget.color,
      ));
    }
  }

  void _updateParticles() {
    if (_size == Size.zero) return;
    for (var p in _particles) {
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > _size.width) p.vx *= -1;
      if (p.y < 0 || p.y > _size.height) p.vy *= -1;
    }
    setState(() {});
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        _size = Size(constraints.maxWidth, constraints.maxHeight);
        if (_particles.isEmpty && widget.enabled) {
          _initParticles(_size);
        }
        return Stack(
          children: [
            widget.child,
            if (widget.enabled)
              CustomPaint(
                size: _size,
                painter: _ParticlePainter(_particles),
              ),
          ],
        );
      },
    );
  }
}

class _ParticlePainter extends CustomPainter {
  final List<Particle> particles;

  _ParticlePainter(this.particles);

  @override
  void paint(Canvas canvas, Size size) {
    for (var p in particles) {
      canvas.drawCircle(
        Offset(p.x, p.y),
        p.radius,
        Paint()..color = p.color.withOpacity(p.opacity),
      );
    }
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => true;
}

class GlowEffect extends StatelessWidget {
  final Widget child;
  final Color color;
  final double blurRadius;
  final double spreadRadius;
  final BorderRadius? borderRadius;

  const GlowEffect({
    super.key,
    required this.child,
    this.color = Colors.amber,
    this.blurRadius = 20,
    this.spreadRadius = 5,
    this.borderRadius,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: borderRadius ?? BorderRadius.circular(8),
        boxShadow: [
          BoxShadow(
            color: color.withOpacity(0.6),
            blurRadius: blurRadius,
            spreadRadius: spreadRadius,
          ),
        ],
      ),
      child: child,
    );
  }
}

class AnimatedGlow extends StatefulWidget {
  final Widget child;
  final Color color;
  final Duration duration;

  const AnimatedGlow({
    super.key,
    required this.child,
    this.color = Colors.amber,
    this.duration = const Duration(milliseconds: 1500),
  });

  @override
  State<AnimatedGlow> createState() => _AnimatedGlowState();
}

class _AnimatedGlowState extends State<AnimatedGlow>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    )..repeat(reverse: true);
    _animation = Tween<double>(begin: 0.3, end: 1.0).animate(_controller);
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
        return Container(
          decoration: BoxDecoration(
            boxShadow: [
              BoxShadow(
                color: widget.color.withOpacity(_animation.value * 0.6),
                blurRadius: 20 * _animation.value,
                spreadRadius: 5 * _animation.value,
              ),
            ],
          ),
          child: widget.child,
        );
      },
    );
  }
}

class BlurEffect extends StatelessWidget {
  final Widget child;
  final double sigma;
  final Color? overlayColor;

  const BlurEffect({
    super.key,
    required this.child,
    this.sigma = 10,
    this.overlayColor,
  });

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        ImageFiltered(
          imageFilter: ColorFilter.mode(
            overlayColor ?? Colors.transparent,
            BlendMode.srcOver,
          ),
          child: child,
        ),
        Positioned.fill(
          child: ClipRect(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: sigma, sigmaY: sigma),
              child: Container(color: overlayColor),
            ),
          ),
        ),
      ],
    );
  }
}

class FrostedGlass extends StatelessWidget {
  final Widget child;
  final double blur;
  final Color color;
  final BorderRadius? borderRadius;
  final EdgeInsets? padding;

  const FrostedGlass({
    super.key,
    required this.child,
    this.blur = 10,
    this.color = Colors.white,
    this.borderRadius,
    this.padding,
  });

  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: borderRadius ?? BorderRadius.circular(16),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: blur, sigmaY: blur),
        child: Container(
          padding: padding ?? const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: color.withOpacity(0.2),
            borderRadius: borderRadius ?? BorderRadius.circular(16),
            border: Border.all(
              color: Colors.white.withOpacity(0.2),
            ),
          ),
          child: child,
        ),
      ),
    );
  }
}

class VoltMeshGradient extends StatelessWidget {
  const VoltMeshGradient({super.key});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Container(color: const Color(0xFF0F172A)), // Base color
        Positioned(
          top: -100,
          right: -100,
          child: Container(
            width: 300,
            height: 300,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF0053C1).withOpacity(0.3),
            ),
          ),
        ),
        Positioned(
          bottom: -50,
          left: -50,
          child: Container(
            width: 250,
            height: 250,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: const Color(0xFF142B5B).withOpacity(0.4),
            ),
          ),
        ),
        BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 80, sigmaY: 80),
          child: Container(color: Colors.transparent),
        ),
      ],
    );
  }
}
