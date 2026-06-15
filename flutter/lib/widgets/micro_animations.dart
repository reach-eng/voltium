import 'package:flutter/material.dart';

enum AnimationType {
  scale,
  fade,
  slide,
  bounce,
  shake,
  pulse,
  rotate,
}

class MicroAnimation extends StatefulWidget {
  final Widget child;
  final AnimationType type;
  final Duration duration;
  final Duration delay;
  final VoidCallback? onComplete;
  final bool enabled;

  const MicroAnimation({
    super.key,
    required this.child,
    this.type = AnimationType.scale,
    this.duration = const Duration(milliseconds: 300),
    this.delay = Duration.zero,
    this.onComplete,
    this.enabled = true,
  });

  @override
  State<MicroAnimation> createState() => _MicroAnimationState();
}

class _MicroAnimationState extends State<MicroAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _setupAnimation();

    if (widget.enabled) {
      _startAnimation();
    }
  }

  void _setupAnimation() {
    switch (widget.type) {
      case AnimationType.scale:
        _animation = Tween<double>(begin: 0.8, end: 1.0).animate(
          CurvedAnimation(parent: _controller, curve: Curves.elasticOut),
        );
        break;
      case AnimationType.fade:
        _animation = Tween<double>(begin: 0.0, end: 1.0).animate(
          CurvedAnimation(parent: _controller, curve: Curves.easeIn),
        );
        break;
      case AnimationType.slide:
        _animation = Tween<double>(begin: 50.0, end: 0.0).animate(
          CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
        );
        break;
      case AnimationType.bounce:
        _animation = Tween<double>(begin: 0.0, end: 1.0).animate(
          CurvedAnimation(parent: _controller, curve: Curves.bounceOut),
        );
        break;
      case AnimationType.shake:
        _animation = Tween<double>(begin: -10.0, end: 0.0).animate(
          CurvedAnimation(parent: _controller, curve: Curves.elasticIn),
        );
        break;
      case AnimationType.pulse:
        _animation = Tween<double>(begin: 1.0, end: 1.1).animate(
          CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
        );
        break;
      case AnimationType.rotate:
        _animation = Tween<double>(begin: -0.1, end: 0.0).animate(
          CurvedAnimation(parent: _controller, curve: Curves.easeOutBack),
        );
        break;
    }
  }

  Future<void> _startAnimation() async {
    await Future.delayed(widget.delay);
    if (mounted) {
      _controller.forward().then((_) {
        widget.onComplete?.call();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.enabled) return widget.child;

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        switch (widget.type) {
          case AnimationType.scale:
            return Transform.scale(scale: _animation.value, child: child);
          case AnimationType.fade:
            return Opacity(opacity: _animation.value, child: child);
          case AnimationType.slide:
            return Transform.translate(
                offset: Offset(0, _animation.value), child: child);
          case AnimationType.bounce:
            return Transform.scale(scale: _animation.value, child: child);
          case AnimationType.shake:
            return Transform.translate(
                offset: Offset(_animation.value, 0), child: child);
          case AnimationType.pulse:
            return Transform.scale(scale: _animation.value, child: child);
          case AnimationType.rotate:
            return Transform.rotate(angle: _animation.value, child: child);
        }
      },
      child: widget.child,
    );
  }
}

class TapScale extends StatefulWidget {
  final Widget child;
  final VoidCallback? onTap;
  final double scaleFactor;

  const TapScale({
    super.key,
    required this.child,
    this.onTap,
    this.scaleFactor = 0.95,
  });

  @override
  State<TapScale> createState() => _TapScaleState();
}

class _TapScaleState extends State<TapScale>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scale;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 100),
    );
    _scale = Tween<double>(begin: 1.0, end: widget.scaleFactor).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) {
        _controller.reverse();
        widget.onTap?.call();
      },
      onTapCancel: () => _controller.reverse(),
      child: AnimatedBuilder(
        animation: _scale,
        builder: (context, child) => Transform.scale(
          scale: _scale.value,
          child: child,
        ),
        child: widget.child,
      ),
    );
  }
}

class SuccessAnimation extends StatefulWidget {
  final bool show;
  final double size;
  final VoidCallback? onComplete;

  const SuccessAnimation({
    super.key,
    required this.show,
    this.size = 80,
    this.onComplete,
  });

  @override
  State<SuccessAnimation> createState() => _SuccessAnimationState();
}

class _SuccessAnimationState extends State<SuccessAnimation>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scale;
  late Animation<double> _check;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _scale = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.elasticOut),
    );

    _check = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.3, 1.0, curve: Curves.easeOut),
      ),
    );

    if (widget.show) {
      _controller.forward().then((_) => widget.onComplete?.call());
    }
  }

  @override
  void didUpdateWidget(SuccessAnimation oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.show && !oldWidget.show) {
      _controller.forward(from: 0).then((_) => widget.onComplete?.call());
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.show && _controller.value == 0) {
      return SizedBox(width: widget.size, height: widget.size);
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Transform.scale(
          scale: _scale.value,
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              color: const Color(0xFF16A34A),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF16A34A).withValues(alpha: 0.3),
                  blurRadius: 20,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: CustomPaint(
              painter: _CheckPainter(progress: _check.value),
            ),
          ),
        );
      },
    );
  }
}

class _CheckPainter extends CustomPainter {
  final double progress;
  _CheckPainter({required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = Colors.white
      ..strokeWidth = 4
      ..strokeCap = StrokeCap.round
      ..style = PaintingStyle.stroke;

    final path = Path();
    path.moveTo(size.width * 0.25, size.height * 0.5);
    path.lineTo(size.width * 0.45, size.height * 0.7);
    path.lineTo(size.width * 0.75, size.height * 0.35);

    final pathMetrics = path.computeMetrics().first;
    final extractedPath =
        pathMetrics.extractPath(0, pathMetrics.length * progress);
    canvas.drawPath(extractedPath, paint);
  }

  @override
  bool shouldRepaint(_CheckPainter old) => old.progress != progress;
}

class PulseWidget extends StatefulWidget {
  final Widget child;
  final bool pulse;
  final Duration duration;

  const PulseWidget({
    super.key,
    required this.child,
    this.pulse = true,
    this.duration = const Duration(milliseconds: 1000),
  });

  @override
  State<PulseWidget> createState() => _PulseWidgetState();
}

class _PulseWidgetState extends State<PulseWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _animation = Tween<double>(begin: 1.0, end: 1.15).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    if (widget.pulse) _controller.repeat(reverse: true);
  }

  @override
  void didUpdateWidget(PulseWidget old) {
    super.didUpdateWidget(old);
    if (widget.pulse && !_controller.isAnimating) {
      _controller.repeat(reverse: true);
    } else if (!widget.pulse && _controller.isAnimating) {
      _controller.stop();
      _controller.value = 0;
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
      builder: (context, child) => Transform.scale(
        scale: widget.pulse ? _animation.value : 1.0,
        child: child,
      ),
      child: widget.child,
    );
  }
}

class BounceWidget extends StatefulWidget {
  final Widget child;
  final double bounceHeight;
  final Duration duration;

  const BounceWidget({
    super.key,
    required this.child,
    this.bounceHeight = 10,
    this.duration = const Duration(milliseconds: 500),
  });

  @override
  State<BounceWidget> createState() => _BounceWidgetState();
}

class _BounceWidgetState extends State<BounceWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _animation = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.bounceOut),
    );
  }

  void bounce() {
    _controller.forward(from: 0);
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
      builder: (context, child) => Transform.translate(
        offset: Offset(0, -widget.bounceHeight * _animation.value),
        child: child,
      ),
      child: widget.child,
    );
  }
}
