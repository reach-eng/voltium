import 'package:flutter/material.dart';

class StyledScrollbar extends StatelessWidget {
  final Widget child;
  final ScrollController? controller;
  final bool thumbVisibility;
  final double thickness;
  final Color? thumbColor;
  final Radius? radius;

  const StyledScrollbar({
    super.key,
    required this.child,
    this.controller,
    this.thumbVisibility = true,
    this.thickness = 8,
    this.thumbColor,
    this.radius,
  });

  @override
  Widget build(BuildContext context) {
    return Scrollbar(
      controller: controller,
      thumbVisibility: thumbVisibility,
      thickness: thickness,
      radius: radius ?? const Radius.circular(4),
      child: ScrollConfiguration(
        behavior: ScrollConfiguration.of(context).copyWith(
          scrollbars: false,
        ),
        child: child,
      ),
    );
  }
}

class CustomScrollView extends StatelessWidget {
  final List<Widget> children;
  final ScrollController? controller;
  final EdgeInsets? padding;
  final bool shrinkWrap;

  const CustomScrollView({
    super.key,
    required this.children,
    this.controller,
    this.padding,
    this.shrinkWrap = false,
  });

  @override
  Widget build(BuildContext context) {
    return StyledScrollbar(
      controller: controller,
      child: ListView(
        controller: controller,
        padding: padding,
        shrinkWrap: shrinkWrap,
        children: children,
      ),
    );
  }
}

class ScrollIndicator extends StatelessWidget {
  final ScrollController controller;
  final double height;
  final Color? color;

  const ScrollIndicator({
    super.key,
    required this.controller,
    this.height = 3,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final indicatorColor =
        color ?? (isDark ? Colors.grey[600]! : Colors.grey[400]!);

    return AnimatedBuilder(
      animation: controller,
      builder: (context, child) {
        final maxScroll = controller.position.maxScrollExtent;
        final currentScroll = controller.offset;
        final progress = maxScroll > 0 ? currentScroll / maxScroll : 0.0;

        return Container(
          height: height,
          decoration: BoxDecoration(
            color: indicatorColor.withValues(alpha: 0.2),
            borderRadius: BorderRadius.circular(height / 2),
          ),
          child: FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: progress.clamp(0.1, 1.0),
            child: Container(
              decoration: BoxDecoration(
                color: indicatorColor,
                borderRadius: BorderRadius.circular(height / 2),
              ),
            ),
          ),
        );
      },
    );
  }
}

class ScrollToTopButton extends StatefulWidget {
  final ScrollController controller;
  final double showAt;
  final IconData icon;
  final Color? backgroundColor;
  final Color? iconColor;

  const ScrollToTopButton({
    super.key,
    required this.controller,
    this.showAt = 300,
    this.icon = Icons.arrow_upward,
    this.backgroundColor,
    this.iconColor,
  });

  @override
  State<ScrollToTopButton> createState() => _ScrollToTopButtonState();
}

class _ScrollToTopButtonState extends State<ScrollToTopButton> {
  bool _isVisible = false;

  @override
  void initState() {
    super.initState();
    widget.controller.addListener(_onScroll);
  }

  @override
  void dispose() {
    widget.controller.removeListener(_onScroll);
    super.dispose();
  }

  void _onScroll() {
    final isVisible = widget.controller.offset > widget.showAt;
    if (isVisible != _isVisible) {
      setState(() => _isVisible = isVisible);
    }
  }

  @override
  Widget build(BuildContext context) {
    if (!_isVisible) return const SizedBox.shrink();

    final bgColor = widget.backgroundColor ?? Theme.of(context).primaryColor;
    final fgColor = widget.iconColor ?? Colors.white;

    return AnimatedOpacity(
      opacity: _isVisible ? 1.0 : 0.0,
      duration: const Duration(milliseconds: 200),
      child: FloatingActionButton.small(
        heroTag: 'scrollToTop',
        backgroundColor: bgColor,
        foregroundColor: fgColor,
        onPressed: () {
          widget.controller.animateTo(
            0,
            duration: const Duration(milliseconds: 500),
            curve: Curves.easeOutCubic,
          );
        },
        child: Icon(widget.icon),
      ),
    );
  }
}

class PullToRefreshIndicator extends StatefulWidget {
  final bool isRefreshing;
  final double progress;

  const PullToRefreshIndicator({
    super.key,
    this.isRefreshing = false,
    this.progress = 0,
  });

  @override
  State<PullToRefreshIndicator> createState() => _PullToRefreshIndicatorState();
}

class _PullToRefreshIndicatorState extends State<PullToRefreshIndicator> {
  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      alignment: Alignment.center,
      child: widget.isRefreshing
          ? const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : Transform.rotate(
              angle: widget.progress * 3.14159,
              child: const Icon(Icons.arrow_downward, size: 24),
            ),
    );
  }
}
