import 'package:flutter/material.dart';

/// A staggered entrance animation that manages a single AnimationController
/// for multiple children, replacing per-widget controllers.
///
/// Each child fades in and slides up with a configurable delay between them.
/// This is more performant than wrapping each child in its own
/// `FadeSlideEntrance` (which creates N controllers).
///
/// Usage:
/// ```dart
/// StaggeredEntrance(
///   children: [
///     ProfileCard(...),
///     PlanCard(...),
///     WalletCard(...),
///   ],
/// )
/// ```
class StaggeredEntrance extends StatefulWidget {
  final List<Widget> children;
  final Duration staggerDelay;
  final Duration duration;
  final Offset startOffset;
  final Curve curve;

  const StaggeredEntrance({
    super.key,
    required this.children,
    this.staggerDelay = const Duration(milliseconds: 75),
    this.duration = const Duration(milliseconds: 500),
    this.startOffset = const Offset(0, 0.15),
    this.curve = Curves.easeOutCubic,
  });

  @override
  State<StaggeredEntrance> createState() => _StaggeredEntranceState();
}

class _StaggeredEntranceState extends State<StaggeredEntrance>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late List<Animation<double>> _fadeAnimations;
  late List<Animation<Offset>> _slideAnimations;

  @override
  void initState() {
    super.initState();
    final totalDuration =
        widget.duration + widget.staggerDelay * (widget.children.length - 1);
    _controller = AnimationController(vsync: this, duration: totalDuration);

    _fadeAnimations = List.generate(widget.children.length, (i) {
      final start = (i *
              widget.staggerDelay.inMilliseconds /
              totalDuration.inMilliseconds)
          .clamp(0.0, 1.0);
      final end = (start +
              widget.duration.inMilliseconds / totalDuration.inMilliseconds)
          .clamp(0.0, 1.0);
      return Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(
          parent: _controller,
          curve: Interval(start, end, curve: widget.curve),
        ),
      );
    });

    _slideAnimations = List.generate(widget.children.length, (i) {
      final start = (i *
              widget.staggerDelay.inMilliseconds /
              totalDuration.inMilliseconds)
          .clamp(0.0, 1.0);
      final end = (start +
              widget.duration.inMilliseconds / totalDuration.inMilliseconds)
          .clamp(0.0, 1.0);
      return Tween<Offset>(begin: widget.startOffset, end: Offset.zero).animate(
        CurvedAnimation(
          parent: _controller,
          curve: Interval(start, end, curve: widget.curve),
        ),
      );
    });

    _controller.forward();
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
      builder: (context, _) {
        return Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: List.generate(widget.children.length, (i) {
            return FadeTransition(
              opacity: _fadeAnimations[i],
              child: SlideTransition(
                position: _slideAnimations[i],
                child: widget.children[i],
              ),
            );
          }),
        );
      },
    );
  }
}
