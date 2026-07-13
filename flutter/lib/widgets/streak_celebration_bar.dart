import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

/// A celebration streak bar where segments light up sequentially (like a slot
/// machine) with a 150ms delay. When all segments are filled, the whole bar
/// pulses green with haptic feedback.
///
/// This is the app's key retention mechanic — the 5-day payment streak.
///
/// Usage:
/// ```dart
/// StreakCelebrationBar(
///   streak: rider.paymentStreak,  // 0..5
///   earnedColor: Colors.white,
///   unearnedColor: Colors.white.withValues(alpha: 0.25),
/// )
/// ```
class StreakCelebrationBar extends StatefulWidget {
  /// Current streak value (0 to [totalSegments]).
  final int streak;

  /// Total number of segments in the bar.
  final int totalSegments;

  /// Color for lit (earned) segments.
  final Color earnedColor;

  /// Color for unlit (unearned) segments.
  final Color unearnedColor;

  /// Height of each segment bar.
  final double height;

  /// Border radius of each segment.
  final double borderRadius;

  const StreakCelebrationBar({
    super.key,
    required this.streak,
    this.totalSegments = 5,
    this.earnedColor = AppColors.success,
    this.unearnedColor = AppColors.iconBackground,
    this.height = 10,
    this.borderRadius = 5,
  });

  @override
  State<StreakCelebrationBar> createState() => _StreakCelebrationBarState();
}

class _StreakCelebrationBarState extends State<StreakCelebrationBar>
    with SingleTickerProviderStateMixin {
  /// How many segments have been visually animated so far.
  int _animatedTo = 0;

  /// Whether the full-streak celebration pulse is active.
  bool _celebrationActive = false;

  late final AnimationController _celebrationCtrl;
  late final Animation<double> _celebrationAnim;

  @override
  void initState() {
    super.initState();

    _celebrationCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );

    _celebrationAnim = Tween<double>(begin: 1.0, end: 1.12).animate(
      CurvedAnimation(parent: _celebrationCtrl, curve: Curves.easeInOut),
    );

    _celebrationCtrl.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        _celebrationCtrl.reverse();
      } else if (status == AnimationStatus.dismissed && _celebrationActive) {
        _celebrationCtrl.forward();
      }
    });

    // Show all earned segments instantly on mount.
    // The sequential slot-machine animation only plays when the streak
    // INCREASES (via didUpdateWidget), so returning users don't re-experience
    // the entire animation every screen visit.
    _animatedTo = widget.streak;
  }

  @override
  void didUpdateWidget(StreakCelebrationBar old) {
    super.didUpdateWidget(old);
    if (old.streak < widget.streak) {
      // Only animate newly earned segments
      _animateSegments(from: old.streak, to: widget.streak);
    }
  }

  /// Sequentially animates segments from [from] to [to] with 150ms stagger.
  Future<void> _animateSegments({required int from, required int to}) async {
    for (int i = from; i < to; i++) {
      await Future.delayed(const Duration(milliseconds: 150));
      if (!mounted) return;

      setState(() => _animatedTo = i + 1);

      // Light haptic on each new segment
      HapticFeedback.lightImpact();
    }

    // If all segments are now earned, start the full celebration
    if (widget.streak >= widget.totalSegments && !_celebrationActive) {
      _celebrationActive = true;
      HapticFeedback.heavyImpact();
      _celebrationCtrl.forward();
    }
  }

  @override
  void dispose() {
    _celebrationCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final segments = Row(
      mainAxisSize: MainAxisSize.min,
      children: List.generate(widget.totalSegments, (i) {
        return Expanded(
          child: _SegmentPill(
            index: i,
            isLit: i < _animatedTo && i < widget.streak,
            earnedColor: widget.earnedColor,
            unearnedColor: widget.unearnedColor,
            height: widget.height,
            borderRadius: widget.borderRadius,
            totalSegments: widget.totalSegments,
          ),
        );
      }),
    );

    // Wrap with celebration glow when all 5 are earned
    if (_celebrationActive) {
      return AnimatedBuilder(
        animation: _celebrationAnim,
        builder: (context, child) {
          final pulse = _celebrationAnim.value - 1.0;
          return Container(
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(widget.borderRadius + 2),
              boxShadow: [
                BoxShadow(
                  color: AppColors.success.withValues(
                    alpha: 0.15 + pulse * 0.35,
                  ),
                  blurRadius: 6.0 + pulse * 20.0,
                  spreadRadius: pulse * 4.0,
                ),
                BoxShadow(
                  color: AppColors.successBright.withValues(
                    alpha: pulse * 0.4,
                  ),
                  blurRadius: 16.0 + pulse * 10.0,
                  spreadRadius: pulse * 2.0,
                ),
              ],
            ),
            child: child,
          );
        },
        child: segments,
      );
    }

    return segments;
  }
}

/// A single pill-shaped segment in the streak bar.
///
/// Uses [TweenAnimationBuilder] to smoothly transition its color when
/// the lit state changes, giving a satisfying "fills up" feel.
class _SegmentPill extends StatelessWidget {
  final int index;
  final bool isLit;
  final Color earnedColor;
  final Color unearnedColor;
  final double height;
  final double borderRadius;
  final int totalSegments;

  const _SegmentPill({
    required this.index,
    required this.isLit,
    required this.earnedColor,
    required this.unearnedColor,
    required this.height,
    required this.borderRadius,
    required this.totalSegments,
  });

  @override
  Widget build(BuildContext context) {
    final margin = EdgeInsets.only(
      right: index < totalSegments - 1 ? height * 0.6 : 0,
    );

    return TweenAnimationBuilder<Color?>(
      tween: ColorTween(
        begin: unearnedColor,
        end: isLit ? earnedColor : unearnedColor,
      ),
      duration: const Duration(milliseconds: 350),
      curve: Curves.easeOutCubic,
      builder: (context, color, _) {
        return Container(
          height: height,
          margin: margin,
          decoration: BoxDecoration(
            color: color ?? unearnedColor,
            borderRadius: BorderRadius.circular(borderRadius),
            boxShadow: isLit
                ? [
                    BoxShadow(
                      color: earnedColor.withValues(alpha: 0.4),
                      blurRadius: 4,
                      spreadRadius: 0.5,
                    ),
                  ]
                : null,
          ),
        );
      },
    );
  }
}
