import 'dart:async';

import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// A premium UI widget that provides a staggered slide and fade-in animation.
class FadeSlideEntrance extends StatefulWidget {
  final Widget child;
  final int index;
  final Duration delayMultiplier;
  final Duration animationDuration;
  final Offset startOffset;

  const FadeSlideEntrance({
    super.key,
    required this.child,
    this.index = 0,
    this.delayMultiplier = const Duration(milliseconds: 75),
    this.animationDuration = const Duration(milliseconds: 500),
    this.startOffset = const Offset(0, 0.15),
  });

  @override
  State<FadeSlideEntrance> createState() => _FadeSlideEntranceState();
}

class _FadeSlideEntranceState extends State<FadeSlideEntrance>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  Timer? _delayTimer;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.animationDuration,
    );

    final fadeAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    final slideAnim =
        Tween<Offset>(begin: widget.startOffset, end: Offset.zero).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );

    // AUDIT FIX: cancellable Timer instead of raw Future.delayed.
    final delayMs = widget.delayMultiplier.inMilliseconds * (widget.index + 1);
    _delayTimer = Timer(Duration(milliseconds: delayMs), () {
      if (mounted) _controller.forward();
    });

    // Store animations for build.
    _fade = fadeAnim;
    _slide = slideAnim;
  }

  late final Animation<double> _fade;
  late final Animation<Offset> _slide;

  @override
  void dispose() {
    _delayTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return FadeTransition(
      opacity: _fade,
      child: SlideTransition(
        position: _slide,
        child: widget.child,
      ),
    );
  }
}

/// A premium UI widget that pulses its scale and glow to attract attention.
class PulsingFab extends StatefulWidget {
  final Widget child;

  const PulsingFab({super.key, required this.child});

  @override
  State<PulsingFab> createState() => _PulsingFabState();
}

class _PulsingFabState extends State<PulsingFab>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
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
      child: widget.child,
      builder: (context, child) {
        final scale = 1.0 + (_controller.value * 0.03);
        final glowOpacity = 0.2 + (_controller.value * 0.3);

        return Transform.scale(
          scale: scale,
          child: Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.radiusBottomSheet),
              boxShadow: [
                BoxShadow(
                  color: AppColors.primary.withValues(alpha: glowOpacity),
                  blurRadius: 16,
                  spreadRadius: 2,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: child,
          ),
        );
      },
    );
  }
}
