import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

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
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _animation,
        builder: (context, child) {
          return Text(
            '${widget.prefix ?? ''}${_animation.value.toString()}${widget.suffix ?? ''}',
            style: widget.style,
          );
        },
      ),
    );
  }
}

class AnimatedCurrency extends StatelessWidget {
  /// PR-RUPEES-2026-08-08: the value is now in **rupees** (decimal).
  /// Renamed from `amountInPaise` (int) → `amountInRupees` (double).
  /// The animation still ticks on integer rupees (no paise); the
  /// decimal portion is rendered statically next to the animated
  /// integer part for visual continuity.
  final double amountInRupees;
  final TextStyle? style;
  final bool showSign;

  const AnimatedCurrency({
    super.key,
    required this.amountInRupees,
    this.style,
    this.showSign = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final defaultStyle =
        style ?? AppTypography.headingMedium.copyWith(color: colors.onSurface);

    final rupeesInt = amountInRupees.truncate();
    final paiseDecimal =
        ((amountInRupees - rupeesInt) * 100).round().toString().padLeft(2, '0');

    return Row(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.baseline,
      textBaseline: TextBaseline.alphabetic,
      children: [
        AnimatedCounter(
          endValue: rupeesInt,
          prefix: showSign && amountInRupees > 0 ? '+₹' : '₹',
          style: defaultStyle,
        ),
        if (paiseDecimal != '00') ...[
          Text(
            '.$paiseDecimal',
            style: defaultStyle.copyWith(
              fontSize: (defaultStyle.fontSize ?? 16) * 0.6,
            ),
          ),
        ],
      ],
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
