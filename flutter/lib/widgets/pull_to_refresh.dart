import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class BrandedPullToRefresh extends StatefulWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  final Color color;
  final double height;

  const BrandedPullToRefresh({
    super.key,
    required this.child,
    required this.onRefresh,
    this.color = AppColors.primary,
    this.height = 70,
  });

  @override
  State<BrandedPullToRefresh> createState() => _BrandedPullToRefreshState();
}

class _BrandedPullToRefreshState extends State<BrandedPullToRefresh>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      color: widget.color,
      backgroundColor: Colors.white,
      displacement: 50,
      child: widget.child,
    );
  }
}

class CustomRefreshIndicator extends StatefulWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  final Color activeColor;
  final Color inactiveColor;

  const CustomRefreshIndicator({
    super.key,
    required this.child,
    required this.onRefresh,
    this.activeColor = AppColors.primary,
    this.inactiveColor = AppColors.outline,
  });

  @override
  State<CustomRefreshIndicator> createState() => _CustomRefreshIndicatorState();
}

class _CustomRefreshIndicatorState extends State<CustomRefreshIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _rotationController;

  @override
  void initState() {
    super.initState();
    _rotationController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
  }

  @override
  void dispose() {
    _rotationController.dispose();
    super.dispose();
  }

  Future<void> _handleRefresh() async {
    _rotationController.repeat();
    await widget.onRefresh();
    _rotationController.stop();
    _rotationController.reset();
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: _handleRefresh,
      color: widget.activeColor,
      backgroundColor: Colors.white,
      displacement: 60,
      child: widget.child,
    );
  }
}

class BoltPullToRefresh extends StatefulWidget {
  final Widget child;
  final Future<void> Function() onRefresh;
  final Color boltColor;

  const BoltPullToRefresh({
    super.key,
    required this.child,
    required this.onRefresh,
    this.boltColor = AppColors.primary,
  });

  @override
  State<BoltPullToRefresh> createState() => _BoltPullToRefreshState();
}

class _BoltPullToRefreshState extends State<BoltPullToRefresh>
    with SingleTickerProviderStateMixin {
  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: widget.onRefresh,
      color: widget.boltColor,
      backgroundColor: Colors.white,
      displacement: 70,
      child: widget.child,
    );
  }
}

class AnimatedRefreshHeader extends StatefulWidget {
  final double pullProgress;

  const AnimatedRefreshHeader({
    super.key,
    required this.pullProgress,
  });

  @override
  State<AnimatedRefreshHeader> createState() => _AnimatedRefreshHeaderState();
}

class _AnimatedRefreshHeaderState extends State<AnimatedRefreshHeader>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1000),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 60,
      alignment: Alignment.center,
      child: widget.pullProgress >= 1.0
          ? const CircularProgressIndicator(
              color: AppColors.primary,
              strokeWidth: 2,
            )
          : Transform.rotate(
              angle: widget.pullProgress * 6.28,
              child: Icon(
                Icons.electric_bolt,
                color: Color.lerp(
                  AppColors.outline,
                  AppColors.primary,
                  widget.pullProgress,
                ),
                size: 30,
              ),
            ),
    );
  }
}
