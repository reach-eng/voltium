import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

enum VibrationType { light, medium, heavy, selection, success }

class HapticHelper {
  static void buttonPress(VibrationType type) {
    switch (type) {
      case VibrationType.light:
        HapticFeedback.lightImpact();
        break;
      case VibrationType.medium:
        HapticFeedback.mediumImpact();
        break;
      case VibrationType.heavy:
        HapticFeedback.heavyImpact();
        break;
      case VibrationType.selection:
        HapticFeedback.selectionClick();
        break;
      case VibrationType.success:
        HapticFeedback.lightImpact();
        Future.delayed(const Duration(milliseconds: 50), () {
          HapticFeedback.lightImpact();
        });
        break;
    }
  }
}

class AnimatedPressButton extends StatefulWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final VoidCallback? onLongPress;
  final VibrationType hapticFeedback;
  final double scaleValue;
  final Duration duration;

  const AnimatedPressButton({
    super.key,
    required this.child,
    this.onPressed,
    this.onLongPress,
    this.hapticFeedback = VibrationType.light,
    this.scaleValue = 0.95,
    this.duration = const Duration(milliseconds: 100),
  });

  @override
  State<AnimatedPressButton> createState() => _AnimatedPressButtonState();
}

class _AnimatedPressButtonState extends State<AnimatedPressButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: widget.scaleValue).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _onTapDown(TapDownDetails details) {
    _controller.forward();
    HapticHelper.buttonPress(widget.hapticFeedback);
  }

  void _onTapUp(TapUpDetails details) {
    _controller.reverse();
    widget.onPressed?.call();
  }

  void _onTapCancel() {
    _controller.reverse();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: _onTapDown,
      onTapUp: _onTapUp,
      onTapCancel: _onTapCancel,
      onLongPress: widget.onLongPress,
      child: AnimatedBuilder(
        animation: _scaleAnimation,
        builder: (context, child) {
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: widget.child,
          );
        },
      ),
    );
  }
}

class BounceButton extends StatefulWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final bool bounce;

  const BounceButton({
    super.key,
    required this.child,
    this.onPressed,
    this.bounce = true,
  });

  @override
  State<BounceButton> createState() => _BounceButtonState();
}

class _BounceButtonState extends State<BounceButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 150),
    );
    _animation = Tween<double>(begin: 1.0, end: 0.9).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTapDown: (_) => _controller.forward(),
      onTapUp: (_) {
        _controller.reverse();
        widget.onPressed?.call();
      },
      onTapCancel: () => _controller.reverse(),
      child: AnimatedBuilder(
        animation: _animation,
        builder: (context, child) {
          return Transform.scale(
            scale: _animation.value,
            child: widget.child,
          );
        },
      ),
    );
  }
}

class RippleEffectButton extends StatefulWidget {
  final Widget child;
  final VoidCallback? onPressed;
  final Color rippleColor;

  const RippleEffectButton({
    super.key,
    required this.child,
    this.onPressed,
    this.rippleColor = AppColors.primary,
  });

  @override
  State<RippleEffectButton> createState() => _RippleEffectButtonState();
}

class _RippleEffectButtonState extends State<RippleEffectButton>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _scaleAnimation;
  late Animation<double> _opacityAnimation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _scaleAnimation = Tween<double>(begin: 0.0, end: 1.5).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
    _opacityAnimation = Tween<double>(begin: 0.5, end: 0.0).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOut),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _handleTap() {
    _controller.forward(from: 0).then((_) {
      widget.onPressed?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _handleTap,
      child: Stack(
        alignment: Alignment.center,
        children: [
          widget.child,
          AnimatedBuilder(
            animation: _controller,
            builder: (context, child) {
              return IgnorePointer(
                child: Transform.scale(
                  scale: _scaleAnimation.value,
                  child: Container(
                    width: 100,
                    height: 100,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      color: widget.rippleColor
                          .withValues(alpha: _opacityAnimation.value),
                    ),
                  ),
                ),
              );
            },
          ),
        ],
      ),
    );
  }
}

class CardFlip extends StatefulWidget {
  final Widget front;
  final Widget back;
  final bool showBack;
  final Duration duration;
  final VoidCallback? onFlip;

  const CardFlip({
    super.key,
    required this.front,
    required this.back,
    this.showBack = false,
    this.duration = const Duration(milliseconds: 500),
    this.onFlip,
  });

  @override
  State<CardFlip> createState() => _CardFlipState();
}

class _CardFlipState extends State<CardFlip>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;
  bool _showingBack = false;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _animation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    _animation.addListener(() {
      if (_animation.value >= 0.5 && !_showingBack) {
        setState(() => _showingBack = true);
      } else if (_animation.value < 0.5 && _showingBack) {
        setState(() => _showingBack = false);
      }
    });
  }

  @override
  void didUpdateWidget(CardFlip oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.showBack != oldWidget.showBack) {
      if (widget.showBack) {
        _controller.forward();
      } else {
        _controller.reverse();
      }
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void _toggleCard() {
    if (_controller.isCompleted) {
      _controller.reverse();
    } else {
      _controller.forward();
    }
    widget.onFlip?.call();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: _toggleCard,
      child: AnimatedBuilder(
        animation: _animation,
        builder: (context, child) {
          final angle = _animation.value * 3.14159;
          return Transform(
            alignment: Alignment.center,
            transform: Matrix4.identity()
              ..setEntry(3, 2, 0.001)
              ..rotateY(angle),
            child: _showingBack
                ? Transform(
                    alignment: Alignment.center,
                    transform: Matrix4.identity()..rotateY(3.14159),
                    child: widget.back,
                  )
                : widget.front,
          );
        },
      ),
    );
  }
}

class ShakeWidget extends StatefulWidget {
  final Widget child;
  final VoidCallback? onShakeComplete;
  final Duration duration;

  const ShakeWidget({
    super.key,
    required this.child,
    this.onShakeComplete,
    this.duration = const Duration(milliseconds: 500),
  });

  @override
  State<ShakeWidget> createState() => _ShakeWidgetState();
}

class _ShakeWidgetState extends State<ShakeWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _animation = Tween<double>(begin: 0, end: 1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.elasticIn),
    );
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  void shake() {
    _controller.forward(from: 0).then((_) {
      widget.onShakeComplete?.call();
    });
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        final offset = (1 - _animation.value) *
            10 *
            (widget.duration.inMilliseconds / 500);
        return Transform.translate(
          offset: Offset(
            offset * ((_animation.value * 10).toInt() % 2 == 0 ? 1 : -1),
            0,
          ),
          child: widget.child,
        );
      },
    );
  }
}

class PulseWidget extends StatefulWidget {
  final Widget child;
  final bool animate;
  final Duration duration;

  const PulseWidget({
    super.key,
    required this.child,
    this.animate = true,
    this.duration = const Duration(milliseconds: 1000),
  });

  @override
  State<PulseWidget> createState() => _PulseWidgetState();
}

class _PulseWidgetState extends State<PulseWidget>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _animation = Tween<double>(begin: 1.0, end: 1.1).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    if (widget.animate) {
      _controller.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(PulseWidget oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.animate != oldWidget.animate) {
      if (widget.animate) {
        _controller.repeat(reverse: true);
      } else {
        _controller.stop();
      }
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
        return Transform.scale(
          scale: _animation.value,
          child: widget.child,
        );
      },
    );
  }
}
