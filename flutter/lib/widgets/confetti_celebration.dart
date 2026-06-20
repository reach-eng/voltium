import 'package:flutter/material.dart';
import 'package:confetti/confetti.dart';
import '../theme/app_theme.dart';

class ConfettiCelebration extends StatefulWidget {
  final bool isPlaying;
  final int particleCount;
  final List<Color> colors;
  final Widget? child;

  const ConfettiCelebration({
    super.key,
    this.isPlaying = false,
    this.particleCount = 50,
    this.colors = const [
      Colors.red,
      Colors.green,
      Colors.blue,
      Colors.yellow,
      Colors.purple,
      Colors.orange,
    ],
    this.child,
  });

  @override
  State<ConfettiCelebration> createState() => _ConfettiCelebrationState();
}

class _ConfettiCelebrationState extends State<ConfettiCelebration> {
  late ConfettiController _confettiController;

  @override
  void initState() {
    super.initState();
    _confettiController =
        ConfettiController(duration: const Duration(seconds: 2));
  }

  @override
  void didUpdateWidget(ConfettiCelebration oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isPlaying && !oldWidget.isPlaying) {
      _confettiController.play();
    }
  }

  @override
  void dispose() {
    _confettiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        widget.child ?? const SizedBox.shrink(),
        Align(
          alignment: Alignment.topCenter,
          child: ConfettiWidget(
            confettiController: _confettiController,
            particleDrag: 0.05,
            emissionFrequency: 0.05,
            numberOfParticles: widget.particleCount,
            gravity: 0.2,
            shouldLoop: false,
            colors: widget.colors,
            strokeWidth: 2,
            strokeColor: Colors.white,
          ),
        ),
      ],
    );
  }
}

class ConfettiButton extends StatelessWidget {
  final VoidCallback onPressed;
  final Widget child;
  final bool showConfetti;

  const ConfettiButton({
    super.key,
    required this.onPressed,
    required this.child,
    this.showConfetti = true,
  });

  @override
  Widget build(BuildContext context) {
    if (!showConfetti) {
      return TextButton(onPressed: onPressed, child: child);
    }

    return ConfettiCelebration(
      isPlaying: false,
      child: TextButton(onPressed: onPressed, child: child),
    );
  }
}

class CelebrationOverlay extends StatefulWidget {
  final bool show;
  final String? message;
  final VoidCallback? onComplete;

  const CelebrationOverlay({
    super.key,
    required this.show,
    this.message,
    this.onComplete,
  });

  @override
  State<CelebrationOverlay> createState() => _CelebrationOverlayState();
}

class _CelebrationOverlayState extends State<CelebrationOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scale;
  late Animation<double> _opacity;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 500),);
    _scale = Tween<double>(begin: 0.5, end: 1.0).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.elasticOut,
    ),);
    _opacity = Tween<double>(begin: 0.0, end: 1.0).animate(CurvedAnimation(
      parent: _controller,
      curve: Curves.easeIn,
    ),);

    if (widget.show) {
      _controller.forward().then((_) {
        Future.delayed(const Duration(milliseconds: 500), () {
          if (mounted) {
            widget.onComplete?.call();
          }
        });
      });
    }
  }

  @override
  void didUpdateWidget(CelebrationOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.show && !oldWidget.show) {
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
    if (!widget.show && _controller.value == 0) {
      return const SizedBox.shrink();
    }

    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        return Opacity(
          opacity: _opacity.value,
          child: Transform.scale(
            scale: _scale.value,
            child: child,
          ),
        );
      },
      child: Container(
        padding: const EdgeInsets.all(32),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(20),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.2),
              blurRadius: 20,
            ),
          ],
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.celebration, size: 64, color: AppColors.primary),
            if (widget.message != null) ...[
              const SizedBox(height: 16),
              Text(
                widget.message!,
                style:
                    const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                textAlign: TextAlign.center,
              ),
            ],
          ],
        ),
      ),
    );
  }
}
