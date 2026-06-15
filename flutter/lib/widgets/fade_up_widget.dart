import 'package:flutter/material.dart';

/// A widget that implements a staggered 'fade up' entrance animation.
/// This is a 1:1 equivalent of the web app's framer-motion 'fadeUp' variant.
class FadeUpWidget extends StatefulWidget {
  final Widget child;
  final int index;
  final double delay; // delay in seconds
  final Duration duration;

  const FadeUpWidget({
    super.key,
    required this.child,
    this.index = 0,
    this.delay = 0.06, // Matches web's 0.06s delay per index
    this.duration =
        const Duration(milliseconds: 400), // Matches web's 0.4s duration
  });

  @override
  State<FadeUpWidget> createState() => _FadeUpWidgetState();
}

class _FadeUpWidgetState extends State<FadeUpWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _opacity;
  late Animation<Offset> _slide;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );

    _opacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 1.0, curve: Curves.easeOut),
      ),
    );

    _slide =
        Tween<Offset>(begin: const Offset(0, 0.1), end: Offset.zero).animate(
      CurvedAnimation(
        parent: _controller,
        curve: const Interval(0.0, 1.0, curve: Curves.easeOut),
      ),
    );

    _startAnimation();
  }

  Future<void> _startAnimation() async {
    final startDelay =
        Duration(milliseconds: (widget.index * widget.delay * 1000).toInt());
    await Future.delayed(startDelay);
    if (mounted) {
      _controller.forward();
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
      animation: _controller,
      builder: (context, child) {
        return Opacity(
          opacity: _opacity.value,
          child: FractionalTranslation(
            translation: _slide.value,
            child: child,
          ),
        );
      },
      child: widget.child,
    );
  }
}
