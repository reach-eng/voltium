import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

/// A notification bell that does a realistic 5-step shake rotation when a new
/// notification arrives. The badge scales in with an elastic bounce.
/// The animation plays exactly once per trigger.
class NotificationBell extends StatefulWidget {
  final bool hasUnread;
  final VoidCallback? onTap;
  final int unreadCount;

  const NotificationBell({
    super.key,
    this.hasUnread = false,
    this.onTap,
    this.unreadCount = 0,
  });

  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell>
    with TickerProviderStateMixin {
  late AnimationController _shakeCtrl;
  late AnimationController _badgeCtrl;
  late Animation<double> _badgeAnim;

  // 5-step rotation sequence (radians): damping shake
  static const List<double> _shakeKeyframes = [
    0.0, // start
    0.15, // snap right
    -0.12, // snap left
    0.08, // small right
    -0.04, // tiny left
    0.0, // return to center
  ];

  @override
  void initState() {
    super.initState();

    _shakeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    );

    _badgeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _badgeAnim = CurvedAnimation(
      parent: _badgeCtrl,
      curve: Curves.elasticOut,
    );

    if (widget.hasUnread) {
      _triggerNudge();
    }
  }

  @override
  void didUpdateWidget(NotificationBell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if ((!oldWidget.hasUnread && widget.hasUnread) ||
        oldWidget.unreadCount < widget.unreadCount) {
      _triggerNudge();
    }
  }

  void _triggerNudge() {
    _shakeCtrl.forward(from: 0);
    _badgeCtrl.forward(from: 0);
    HapticFeedback.lightImpact();
  }

  @override
  void dispose() {
    _shakeCtrl.dispose();
    _badgeCtrl.dispose();
    super.dispose();
  }

  /// Interpolates the shake rotation value from keyframes based on [progress].
  double _getShakeRotation(double progress) {
    if (progress <= 0) return 0;
    if (progress >= 1) return 0;
    final pos = progress * (_shakeKeyframes.length - 1);
    final idx = pos.floor();
    final frac = pos - idx;
    if (idx >= _shakeKeyframes.length - 1) return 0;
    return _shakeKeyframes[idx] +
        (_shakeKeyframes[idx + 1] - _shakeKeyframes[idx]) * frac;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      key: const Key('notificationBell'),
      borderRadius: BorderRadius.circular(22),
      onTap: widget.onTap,
      child: Container(
        width: 44,
        height: 44,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.05),
          shape: BoxShape.circle,
          border: Border.all(color: Colors.black.withValues(alpha: 0.1)),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            // Bell icon with shake rotation
            AnimatedBuilder(
              animation: _shakeCtrl,
              builder: (context, child) {
                return Transform.rotate(
                  angle: _getShakeRotation(_shakeCtrl.value),
                  child: child,
                );
              },
              child: Icon(
                Icons.notifications_none_rounded,
                size: 20,
                color: colors.onSurface,
              ),
            ),
            // Badge with elastic scale
            if (widget.hasUnread || widget.unreadCount > 0)
              Positioned(
                right: -2,
                top: -2,
                child: AnimatedBuilder(
                  animation: _badgeCtrl,
                  builder: (context, child) {
                    return Transform.scale(
                      scale: _badgeAnim.value,
                      child: widget.unreadCount > 1
                          ? Container(
                              constraints: const BoxConstraints(minWidth: 16),
                              height: 16,
                              padding:
                                  const EdgeInsets.symmetric(horizontal: 4),
                              decoration: const BoxDecoration(
                                color: AppColors.error,
                                shape: BoxShape.circle,
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                '${widget.unreadCount}',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 10,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                            )
                          : Container(
                              width: 8,
                              height: 8,
                              decoration: BoxDecoration(
                                color: AppColors.error,
                                shape: BoxShape.circle,
                                border: Border.all(
                                  color: Colors.white,
                                  width: 1.5,
                                ),
                              ),
                            ),
                    );
                  },
                ),
              ),
          ],
        ),
      ),
    );
  }
}
