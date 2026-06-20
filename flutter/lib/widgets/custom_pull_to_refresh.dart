import 'package:flutter/material.dart';
import 'package:flutter/physics.dart';

class CustomPullToRefresh extends StatefulWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  final Color? color;
  final double height;

  const CustomPullToRefresh({
    super.key,
    required this.child,
    required this.onRefresh,
    this.color,
    this.height = 80,
  });

  @override
  State<CustomPullToRefresh> createState() => _CustomPullToRefreshState();
}

class _CustomPullToRefreshState extends State<CustomPullToRefresh>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;
  double _dragOffset = 0;
  bool _isRefreshing = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this);
    _animation = Tween<double>(begin: 0, end: 1).animate(_controller);
    _animation.addListener(_onAnimationTick);
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onAnimationTick() {
    if (mounted) {
      setState(() => _dragOffset = _animation.value * _dragOffset);
    }
  }

  void _onDragUpdate(DragUpdateDetails details) {
    if (_isRefreshing) return;
    setState(() {
      _dragOffset =
          (_dragOffset + details.delta.dy).clamp(0, widget.height * 2);
    });
  }

  Future<void> _onDragEnd(DragEndDetails details) async {
    if (_dragOffset > widget.height) {
      _isRefreshing = true;
      _controller.animateTo(
        1.0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeOut,
      );
      await widget.onRefresh();
      _isRefreshing = false;
      _controller.animateTo(
        0.0,
        duration: const Duration(milliseconds: 300),
        curve: Curves.easeIn,
      );
      setState(() => _dragOffset = 0);
    } else {
      _animateBack();
    }
  }

  void _animateBack() {
    final simulation = SpringSimulation(
      const SpringDescription(mass: 1, stiffness: 500, damping: 25),
      _dragOffset,
      0,
      0,
    );
    _controller.animateWith(simulation);
  }

  @override
  Widget build(BuildContext context) {
    final progress = (_dragOffset / widget.height).clamp(0.0, 1.0);
    final color = widget.color ?? Theme.of(context).primaryColor;

    return GestureDetector(
      onVerticalDragUpdate: _onDragUpdate,
      onVerticalDragEnd: _onDragEnd,
      child: Stack(
        children: [
          Transform.translate(
            offset: Offset(0, _dragOffset),
            child: widget.child,
          ),
          if (_dragOffset > 0 || _isRefreshing)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              height: widget.height,
              child: Center(
                child: _isRefreshing
                    ? _RefreshingIndicator(color: color)
                    : _PullIndicator(progress: progress, color: color),
              ),
            ),
        ],
      ),
    );
  }
}

class _PullIndicator extends StatelessWidget {
  final double progress;
  final Color color;

  const _PullIndicator({required this.progress, required this.color});

  @override
  Widget build(BuildContext context) {
    return Column(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        Transform.rotate(angle: progress * 3.14159),
        Icon(
          Icons.arrow_downward,
          color: color.withValues(alpha: 0.3 + progress * 0.7),
          size: 24,
        ),
        const SizedBox(height: 4),
        SizedBox(
          width: 20,
          height: 20,
          child: CircularProgressIndicator(
            value: progress,
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation(color),
            backgroundColor: color.withValues(alpha: 0.2),
          ),
        ),
      ],
    );
  }
}

class _RefreshingIndicator extends StatefulWidget {
  final Color color;

  const _RefreshingIndicator({required this.color});

  @override
  State<_RefreshingIndicator> createState() => _RefreshingIndicatorState();
}

class _RefreshingIndicatorState extends State<_RefreshingIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    )..repeat();
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
        return Transform.rotate(
          angle: _controller.value * 6.28319,
          child: child,
        );
      },
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: widget.color.withValues(alpha: 0.3),
            width: 3,
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(3),
          child: CircularProgressIndicator(
            strokeWidth: 2,
            valueColor: AlwaysStoppedAnimation(widget.color),
          ),
        ),
      ),
    );
  }
}
