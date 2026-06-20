import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class AnimatedLogoSplash extends StatefulWidget {
  final VoidCallback onComplete;
  final Duration duration;
  final String logoPath;

  const AnimatedLogoSplash({
    super.key,
    required this.onComplete,
    this.duration = const Duration(seconds: 3),
    this.logoPath = '',
  });

  @override
  State<AnimatedLogoSplash> createState() => _AnimatedLogoSplashState();
}

class _AnimatedLogoSplashState extends State<AnimatedLogoSplash>
    with TickerProviderStateMixin {
  late AnimationController _logoController;
  late AnimationController _pulseController;
  late AnimationController _slideController;
  late Animation<double> _logoScale;
  late Animation<double> _pulseScale;
  late Animation<Offset> _slideAnimation;

  @override
  void initState() {
    super.initState();

    _logoController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _slideController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _logoScale = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _logoController, curve: Curves.elasticOut),
    );
    _pulseScale = Tween<double>(begin: 1.0, end: 1.3).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );
    _slideAnimation = Tween<Offset>(
      begin: const Offset(0, 0.3),
      end: Offset.zero,
    ).animate(CurvedAnimation(parent: _slideController, curve: Curves.easeOut));

    _startAnimation();
  }

  void _startAnimation() async {
    await _logoController.forward();
    if (!mounted) return;
    _pulseController.repeat(reverse: true);
    await _slideController.forward();
    if (!mounted) return;
    await Future.delayed(const Duration(milliseconds: 500));
    if (mounted) widget.onComplete();
  }

  @override
  void dispose() {
    _logoController.dispose();
    _pulseController.dispose();
    _slideController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary,
      body: Stack(
        children: [
          // Pulsing background circle
          Center(
            child: AnimatedBuilder(
              animation: _pulseController,
              builder: (context, child) {
                return Transform.scale(
                  scale: _pulseScale.value,
                  child: Container(
                    width: 120,
                    height: 120,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: Colors.white
                          .withValues(alpha: 0.2 * (1.3 - _pulseScale.value)),
                    ),
                  ),
                );
              },
            ),
          ),
          // Logo
          Center(
            child: AnimatedBuilder(
              animation: _logoController,
              builder: (context, child) {
                return Transform.scale(
                  scale: _logoScale.value,
                  child: Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(24),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.2),
                          blurRadius: 20,
                          offset: const Offset(0, 10),
                        ),
                      ],
                    ),
                    child: const Icon(
                      Icons.electric_bolt,
                      size: 60,
                      color: AppColors.primary,
                    ),
                  ),
                );
              },
            ),
          ),
          // App name
          Positioned(
            bottom: 100,
            left: 0,
            right: 0,
            child: SlideTransition(
              position: _slideAnimation,
              child: Column(
                children: [
                  const Text('Voltium',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 32,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 1,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text('Electric Mobility',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.8),
                      fontSize: 16,
                    ),
                  ),
                ],
              ),
            ),
          ),
          // Loading indicator
          Positioned(
            bottom: 40,
            left: 0,
            right: 0,
            child: FadeTransition(
              opacity: _slideController,
              child: const Center(
                child: SizedBox(
                  width: 30,
                  height: 30,
                  child: CircularProgressIndicator(
                    color: Colors.white,
                    strokeWidth: 2,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class PulsingBoltLogo extends StatefulWidget {
  final double size;
  final Color color;
  final bool animate;

  const PulsingBoltLogo({
    super.key,
    this.size = 80,
    this.color = Colors.amber,
    this.animate = true,
  });

  @override
  State<PulsingBoltLogo> createState() => _PulsingBoltLogoState();
}

class _PulsingBoltLogoState extends State<PulsingBoltLogo>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _glowAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 1.1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    _glowAnimation = Tween<double>(begin: 0.3, end: 0.8).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    if (widget.animate) {
      _controller.repeat(reverse: true);
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
        return Transform.scale(
          scale: _scaleAnimation.value,
          child: Container(
            width: widget.size,
            height: widget.size,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: widget.color.withValues(alpha: _glowAnimation.value),
                  blurRadius: 20,
                  spreadRadius: 5,
                ),
              ],
            ),
            child: Icon(
              Icons.electric_bolt,
              size: widget.size * 0.6,
              color: widget.color,
            ),
          ),
        );
      },
    );
  }
}
