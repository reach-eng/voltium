import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// A high-end Double-Bezel card that mimics physical hardware (an outer shell
/// with a distinct border/padding, and an inner core with a soft ambient shadow).
class PremiumDoubleBezelCard extends StatefulWidget {
  final Widget child;
  final EdgeInsetsGeometry? padding;
  final EdgeInsetsGeometry? margin;
  final bool interactive;
  final VoidCallback? onTap;
  final double outerRadius;
  final double bezelWidth;

  const PremiumDoubleBezelCard({
    super.key,
    required this.child,
    this.padding,
    this.margin,
    this.interactive = false,
    this.onTap,
    this.outerRadius = 32.0,
    this.bezelWidth = 4.0,
  });

  /// Factory for a card that physically depresses when tapped.
  factory PremiumDoubleBezelCard.interactive({
    Key? key,
    required Widget child,
    EdgeInsetsGeometry? padding,
    EdgeInsetsGeometry? margin,
    VoidCallback? onTap,
    double outerRadius = 32.0,
    double bezelWidth = 4.0,
  }) {
    return PremiumDoubleBezelCard(
      key: key,
      padding: padding,
      margin: margin,
      interactive: true,
      onTap: onTap,
      outerRadius: outerRadius,
      bezelWidth: bezelWidth,
      child: child,
    );
  }

  @override
  State<PremiumDoubleBezelCard> createState() => _PremiumDoubleBezelCardState();
}

class _PremiumDoubleBezelCardState extends State<PremiumDoubleBezelCard>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    // Cubic bezier for a snappy but soft physical press
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.97).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTapDown(TapDownDetails details) {
    if (widget.interactive && widget.onTap != null) {
      _controller.forward();
    }
  }

  void _handleTapUp(TapUpDetails details) {
    if (widget.interactive && widget.onTap != null) {
      _controller.reverse();
      widget.onTap!();
    }
  }

  void _handleTapCancel() {
    if (widget.interactive && widget.onTap != null) {
      _controller.reverse();
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final innerRadius = widget.outerRadius - widget.bezelWidth;

    Widget content = Container(
      margin: widget.margin,
      padding: EdgeInsets.all(widget.bezelWidth),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(widget.outerRadius),
        color: colors.surface,
        border: Border.all(
          color: Colors.black.withValues(alpha: 0.03),
          width: 1,
        ),
      ),
      child: Container(
        padding: widget.padding ?? const EdgeInsets.all(Spacing.lg),
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(innerRadius),
          color: colors.card,
          boxShadow: AppShadows.card,
        ),
        child: widget.child,
      ),
    );

    if (widget.interactive && widget.onTap != null) {
      content = GestureDetector(
        onTapDown: _handleTapDown,
        onTapUp: _handleTapUp,
        onTapCancel: _handleTapCancel,
        behavior: HitTestBehavior.opaque,
        child: AnimatedBuilder(
          animation: _controller,
          builder: (context, child) {
            return Transform.scale(
              scale: _scaleAnimation.value,
              child: child,
            );
          },
          child: content,
        ),
      );
    }

    return content;
  }
}
