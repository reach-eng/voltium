import 'package:flutter/material.dart';

class AnimatedCounter extends StatefulWidget {
  final int endValue;
  final String? prefix;
  final String? suffix;
  final TextStyle? style;
  final Duration duration;
  final Curve curve;

  const AnimatedCounter({
    super.key,
    required this.endValue,
    this.prefix,
    this.suffix,
    this.style,
    this.duration = const Duration(milliseconds: 1500),
    this.curve = Curves.easeOutCubic,
  });

  @override
  State<AnimatedCounter> createState() => _AnimatedCounterState();
}

class _AnimatedCounterState extends State<AnimatedCounter>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<int> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _animation = IntTween(begin: 0, end: widget.endValue).animate(
      CurvedAnimation(parent: _controller, curve: widget.curve),
    );
    _controller.forward();
  }

  @override
  void didUpdateWidget(AnimatedCounter oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.endValue != widget.endValue) {
      _animation =
          IntTween(begin: _animation.value, end: widget.endValue).animate(
        CurvedAnimation(parent: _controller, curve: widget.curve),
      );
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
        return Text(
          '${widget.prefix ?? ''}${_animation.value.toString()}${widget.suffix ?? ''}',
          style: widget.style,
        );
      },
    );
  }
}

class AnimatedCurrency extends StatelessWidget {
  final int amountInPaise;
  final TextStyle? style;
  final bool showSign;

  const AnimatedCurrency({
    super.key,
    required this.amountInPaise,
    this.style,
    this.showSign = false,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final defaultStyle = style ??
        TextStyle(
          fontSize: 24,
          fontWeight: FontWeight.bold,
          color: isDark ? Colors.white : Colors.black,
        );

    return AnimatedCounter(
      endValue: amountInPaise ~/ 100,
      prefix: '₹',
      style: defaultStyle,
    );
  }
}

class AnimatedPercentage extends StatelessWidget {
  final double value;
  final TextStyle? style;
  final bool showSign;

  const AnimatedPercentage({
    super.key,
    required this.value,
    this.style,
    this.showSign = true,
  });

  @override
  Widget build(BuildContext context) {
    final displayValue = value.toStringAsFixed(1);
    final prefix = showSign && value > 0 ? '+' : '';

    return AnimatedBuilder(
      animation: AlwaysStoppedAnimation(value),
      builder: (context, child) {
        return Text(
          '$prefix$displayValue%',
          style: style,
        );
      },
    );
  }
}
