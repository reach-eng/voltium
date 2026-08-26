# Design Spells for Voltium

Micro-interactions and delight moments that transform the app from "functional" into "magical." Each spell is adapted to Voltium's EV mobility brand identity.

---

## 1. Electric Bolt Pull-to-Refresh

**The Problem:** Standard `RefreshIndicator` is generic. Three pull-to-refresh variants exist (`BrandedPullToRefresh`, `BoltPullToRefresh`, `CustomPullToRefresh`) but none use the brand's electric identity.

**The Spell:** A bolt icon that rotates and charges with electric glow as the user pulls. On release, the bolt "strikes" with a brief white flash before the spinner appears.

```dart
class ElectricPullToRefresh extends StatefulWidget {
  final Widget child;
  final Future<void> Function() onRefresh;

  const ElectricPullToRefresh({
    super.key,
    required this.child,
    required this.onRefresh,
  });

  @override
  State<ElectricPullToRefresh> createState() => _ElectricPullToRefreshState();
}

class _ElectricPullToRefreshState extends State<ElectricPullToRefresh>
    with TickerProviderStateMixin {
  final GlobalKey<RefreshIndicatorState> _indicatorKey = GlobalKey();

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      key: _indicatorKey,
      onRefresh: widget.onRefresh,
      color: AppColors.primary,
      backgroundColor: Colors.white,
      displacement: 60,
      strokeWidth: 3,
      child: widget.child,
    );
  }
}

/// Custom refresh indicator with bolt icon that rotates proportional to pull.
/// Use with CustomRefreshIndicator from flutter/widgets.
class BoltRefreshHeader extends StatelessWidget {
  final double pullProgress; // 0.0 to 1.0

  const BoltRefreshHeader({super.key, required this.pullProgress});

  @override
  Widget build(BuildContext context) {
    final clampedProgress = pullProgress.clamp(0.0, 1.0);
    final glowOpacity = (clampedProgress * 0.4).clamp(0.0, 0.4);
    final boltColor = Color.lerp(
      AppColors.outline,
      AppColors.primary,
      clampedProgress,
    )!;

    return SizedBox(
      height: 60,
      child: Center(
        child: AnimatedSwitcher(
          duration: const Duration(milliseconds: 200),
          child: clampedProgress >= 1.0
              ? SizedBox(
                  key: const ValueKey('spinner'),
                  width: 28,
                  height: 28,
                  child: CircularProgressIndicator(
                    strokeWidth: 2.5,
                    color: AppColors.primary,
                  ),
                )
              : Transform.rotate(
                  key: const ValueKey('bolt'),
                  angle: clampedProgress * 3.14159 * 2,
                  child: Container(
                    width: 36,
                    height: 36,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary
                              .withValues(alpha: glowOpacity),
                          blurRadius: 16,
                          spreadRadius: 4,
                        ),
                      ],
                    ),
                    child: Icon(
                      Icons.electric_bolt,
                      color: boltColor,
                      size: 24,
                    ),
                  ),
                ),
        ),
      ),
    );
  }
}
```

**Where to apply:** Replace the `RefreshIndicator` in `ActiveDashboardScreen` and `WalletScreen`.

---

## 2. Animated Balance Counter

**The Problem:** Wallet balance appears as a static number. When it changes (top-up, deduction), there's no visual feedback of the value changing.

**The Spell:** A counting animation that rolls digits like a mechanical odometer when the balance changes. Increases animate up, decreases animate down. On a top-up, the final number briefly glows green.

```dart
class AnimatedBalanceText extends StatefulWidget {
  final double value;
  final String prefix;
  final TextStyle? style;
  final Duration duration;

  const AnimatedBalanceText({
    super.key,
    required this.value,
    this.prefix = '₹',
    this.style,
    this.duration = const Duration(milliseconds: 800),
  });

  @override
  State<AnimatedBalanceText> createState() => _AnimatedBalanceTextState();
}

class _AnimatedBalanceTextState extends State<AnimatedBalanceText>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;
  double _oldValue = 0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _animation = Tween<double>(begin: widget.value, end: widget.value).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
    );
    _oldValue = widget.value;
  }

  @override
  void didUpdateWidget(AnimatedBalanceText oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _animation = Tween<double>(
        begin: _oldValue,
        end: widget.value,
      ).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeOutCubic),
      );
      _controller.forward(from: 0);
      _oldValue = widget.value;
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
        final displayValue = _animation.value;
        final isAnimating = _controller.isAnimating;
        final isIncrease = widget.value > _oldValue;

        return AnimatedDefaultTextStyle(
          duration: const Duration(milliseconds: 300),
          style: (widget.style ?? const TextStyle()).copyWith(
            color: isAnimating
                ? (isIncrease
                    ? AppColors.success
                    : AppColors.error)
                : widget.style?.color,
          ),
          child: Text(
            '${widget.prefix}${displayValue.floor().toString()}',
          ),
        );
      },
    );
  }
}
```

**Where to apply:** `WalletBalanceCard`, `DashboardWalletCard`, any screen showing `walletBalance`.

---

## 3. OTP Digit Spark

**The Problem:** OTP input boxes change border color when focused — standard behavior with no brand personality.

**The Spell:** When each digit is entered, a brief electric spark flashes across the box. The box briefly glows with the primary color, then settles. When all 6 digits are entered, a chain-lightning effect connects all boxes before verification begins.

```dart
/// Wraps each OTP digit box with a spark animation on entry.
class SparkOtpBox extends StatefulWidget {
  final bool hasValue;
  final bool isFocused;
  final Widget child;

  const SparkOtpBox({
    super.key,
    required this.hasValue,
    required this.isFocused,
    required this.child,
  });

  @override
  State<SparkOtpBox> createState() => _SparkOtpBoxState();
}

class _SparkOtpBoxState extends State<SparkOtpBox>
    with SingleTickerProviderStateMixin {
  late AnimationController _sparkCtrl;
  late Animation<double> _glowOpacity;
  bool _prevHasValue = false;

  @override
  void initState() {
    super.initState();
    _sparkCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 400),
    );
    _glowOpacity = Tween<double>(begin: 0.6, end: 0.0).animate(
      CurvedAnimation(parent: _sparkCtrl, curve: Curves.easeOut),
    );
    _prevHasValue = widget.hasValue;
  }

  @override
  void didUpdateWidget(SparkOtpBox oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.hasValue && !_prevHasValue) {
      _sparkCtrl.forward(from: 0);
      HapticFeedback.lightImpact();
    }
    _prevHasValue = widget.hasValue;
  }

  @override
  void dispose() {
    _sparkCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _sparkCtrl,
      builder: (context, child) {
        return Container(
          decoration: BoxDecoration(
            boxShadow: [
              if (_sparkCtrl.isAnimating)
                BoxShadow(
                  color: AppColors.primary
                      .withValues(alpha: _glowOpacity.value),
                  blurRadius: 12,
                  spreadRadius: 2,
                ),
            ],
          ),
          child: child,
        );
      },
      child: widget.child,
    );
  }
}
```

**Where to apply:** Wrap each digit box in `OtpInput` widget.

---

## 4. Card Parallax Tilt (3D Depth)

**The Problem:** Dashboard cards are flat. The `PremiumDoubleBezelCard` has nice depth via shadows, but there's no response to device tilt or scroll position.

**The Spell:** Cards respond to scroll velocity with a subtle parallax tilt. As the user scrolls, cards tilt slightly in the scroll direction (2–3 degrees max), creating a layered depth effect. Uses `Gyroscope` or scroll delta.

```dart
/// Wraps a card with scroll-based parallax tilt.
/// Place inside a Scrollable ancestor. Uses scroll velocity to tilt.
class ParallaxTiltCard extends StatefulWidget {
  final Widget child;
  final double maxTiltDegrees;

  const ParallaxTiltCard({
    super.key,
    required this.child,
    this.maxTiltDegrees = 2.0,
  });

  @override
  State<ParallaxTiltCard> createState() => _ParallaxTiltCardState();
}

class _ParallaxTiltCardState extends State<ParallaxTiltCard> {
  double _tiltX = 0;
  double _tiltY = 0;

  void _onPointerMove(PointerEvent details) {
    final RenderBox? box = context.findRenderObject() as RenderBox?;
    if (box == null) return;
    final size = box.size;
    final position = box.globalToLocal(details.position);

    final centerX = size.width / 2;
    final centerY = size.height / 2;
    final maxRad = widget.maxTiltDegrees * 3.14159 / 180;

    setState(() {
      _tiltX = ((position.dy - centerY) / centerY) * maxRad;
      _tiltY = -((position.dx - centerX) / centerX) * maxRad;
    });
  }

  void _onPointerExit(PointerEvent details) {
    setState(() {
      _tiltX = 0;
      _tiltY = 0;
    });
  }

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      onHover: (event) => _onPointerMove(event),
      onExit: _onPointerExit,
      child: Listener(
        onPointerMove: _onPointerMove,
        onPointerUp: (_) => _onPointerExit,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOut,
          transform: Matrix4.identity()
            ..setEntry(3, 2, 0.001)
            ..rotateX(_tiltX)
            ..rotateY(_tiltY),
          child: widget.child,
        ),
      ),
    );
  }
}
```

**Where to apply:** `DashboardProfileCard`, `PlanCard`, `WalletCard` on the dashboard.

---

## 5. Battery Charging Animation (Vehicle Battery Level)

**The Problem:** Battery level is displayed as a static number. For an EV app, this is a missed opportunity.

**The Spell:** An animated battery icon that fills with a liquid-wave effect. The fill color transitions from red (low) → amber (medium) → green (high). When charging, a pulse effect emanates from the battery.

```dart
class AnimatedBatteryIndicator extends StatefulWidget {
  final int level; // 0-100
  final bool isCharging;
  final double size;

  const AnimatedBatteryIndicator({
    super.key,
    required this.level,
    this.isCharging = false,
    this.size = 48,
  });

  @override
  State<AnimatedBatteryIndicator> createState() =>
      _AnimatedBatteryIndicatorState();
}

class _AnimatedBatteryIndicatorState extends State<AnimatedBatteryIndicator>
    with TickerProviderStateMixin {
  late AnimationController _fillCtrl;
  late AnimationController _waveCtrl;
  late AnimationController _pulseCtrl;
  late Animation<double> _fillAnim;
  int _oldLevel = 0;

  @override
  void initState() {
    super.initState();
    _fillCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _waveCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _fillAnim = Tween<double>(
      begin: widget.level / 100.0,
      end: widget.level / 100.0,
    ).animate(CurvedAnimation(parent: _fillCtrl, curve: Curves.easeOutCubic));
    _oldLevel = widget.level;

    if (widget.isCharging) {
      _pulseCtrl.repeat(reverse: true);
    }
  }

  @override
  void didUpdateWidget(AnimatedBatteryIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.level != widget.level) {
      _fillAnim = Tween<double>(
        begin: _oldLevel / 100.0,
        end: widget.level / 100.0,
      ).animate(
        CurvedAnimation(parent: _fillCtrl, curve: Curves.easeOutCubic),
      );
      _fillCtrl.forward(from: 0);
      _oldLevel = widget.level;
    }
    if (widget.isCharging && !_pulseCtrl.isAnimating) {
      _pulseCtrl.repeat(reverse: true);
    } else if (!widget.isCharging && _pulseCtrl.isAnimating) {
      _pulseCtrl.stop();
      _pulseCtrl.reset();
    }
  }

  @override
  void dispose() {
    _fillCtrl.dispose();
    _waveCtrl.dispose();
    _pulseCtrl.dispose();
    super.dispose();
  }

  Color _levelColor(double level) {
    if (level < 0.2) return AppColors.error;
    if (level < 0.5) return AppColors.warning;
    return AppColors.success;
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([_fillCtrl, _waveCtrl, _pulseCtrl]),
      builder: (context, child) {
        final fillLevel = _fillAnim.value;
        final color = _levelColor(fillLevel);
        final pulseScale = widget.isCharging
            ? 1.0 + (_pulseCtrl.value * 0.05)
            : 1.0;

        return Transform.scale(
          scale: pulseScale,
          child: SizedBox(
            width: widget.size,
            height: widget.size * 0.55,
            child: CustomPaint(
              painter: _BatteryPainter(
                fillLevel: fillLevel,
                color: color,
                waveOffset: _waveCtrl.value,
                isCharging: widget.isCharging,
              ),
            ),
          ),
        );
      },
    );
  }
}

class _BatteryPainter extends CustomPainter {
  final double fillLevel;
  final Color color;
  final double waveOffset;
  final bool isCharging;

  _BatteryPainter({
    required this.fillLevel,
    required this.color,
    required this.waveOffset,
    required this.isCharging,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final bodyWidth = size.width * 0.88;
    final bodyHeight = size.height;
    final tipWidth = size.width * 0.08;
    final tipHeight = bodyHeight * 0.4;
    final radius = Radius.circular(bodyWidth * 0.12);

    // Battery body outline
    final outlinePaint = Paint()
      ..color = color.withValues(alpha: 0.3)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5;

    final bodyRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(0, 0, bodyWidth, bodyHeight),
      radius,
    );
    canvas.drawRRect(bodyRect, outlinePaint);

    // Battery tip
    final tipRect = RRect.fromRectAndRadius(
      Rect.fromLTWH(
        bodyWidth,
        (bodyHeight - tipHeight) / 2,
        tipWidth,
        tipHeight,
      ),
      Radius.circular(tipWidth * 0.3),
    );
    canvas.drawRRect(tipRect, Paint()..color = color.withValues(alpha: 0.3));

    // Fill with wave
    final fillWidth = (bodyWidth - 4) * fillLevel;
    if (fillWidth > 0) {
      final fillRect = RRect.fromRectAndRadius(
        Rect.fromLTWH(2, 2, fillWidth, bodyHeight - 4),
        Radius.circular(radius.x - 1),
      );

      canvas.clipRRect(fillRect);

      final wavePaint = Paint()..color = color;
      final path = Path();
      final waveHeight = 3.0;
      final waveWidth = bodyWidth * 0.5;

      path.moveTo(0, bodyHeight);
      for (double x = 0; x <= fillWidth + 10; x += 1) {
        final y = (bodyHeight / 2) +
            waveHeight *
                math.sin((x / waveWidth * 2 * math.pi) +
                    (waveOffset * 2 * math.pi));
        path.lineTo(x, y);
      }
      path.lineTo(fillWidth + 10, bodyHeight);
      path.close();

      canvas.drawPath(path, wavePaint);
    }
  }

  @override
  bool shouldRepaint(_BatteryPainter old) =>
      old.fillLevel != fillLevel ||
      old.waveOffset != waveOffset ||
      old.isCharging != isCharging;
}
```

**Where to apply:** Vehicle battery display on dashboard, vehicle detail screens.

---

## 6. Payment Streak Celebration

**The Problem:** The payment streak bar (1/5 → 5/5) fills segments with green but has no celebration when it reaches 5/5.

**The Spell:** When the streak reaches 5/5, each segment lights up sequentially with a brief delay (like a slot machine), then the entire bar pulses with success glow and confetti fires. A subtle haptic "success" pattern plays.

```dart
class AnimatedStreakBar extends StatefulWidget {
  final int currentStreak;
  final int totalSteps;

  const AnimatedStreakBar({
    super.key,
    required this.currentStreak,
    this.totalSteps = 5,
  });

  @override
  State<AnimatedStreakBar> createState() => _AnimatedStreakBarState();
}

class _AnimatedStreakBarState extends State<AnimatedStreakBar>
    with TickerProviderStateMixin {
  late List<AnimationController> _segmentCtrls;
  late AnimationController _glowCtrl;
  int _prevStreak = 0;

  @override
  void initState() {
    super.initState();
    _segmentCtrls = List.generate(
      widget.totalSteps,
      (i) => AnimationController(
        vsync: this,
        duration: const Duration(milliseconds: 400),
      ),
    );
    _glowCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _prevStreak = widget.currentStreak;

    // Animate initial state
    for (int i = 0; i < widget.currentStreak && i < widget.totalSteps; i++) {
      _segmentCtrls[i].value = 1.0;
    }
  }

  @override
  void didUpdateWidget(AnimatedStreakBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.currentStreak > _prevStreak) {
      _animateNewSegments(_prevStreak, widget.currentStreak);
    }
    _prevStreak = widget.currentStreak;
  }

  void _animateNewSegments(int from, int to) async {
    for (int i = from; i < to && i < widget.totalSteps; i++) {
      await Future.delayed(const Duration(milliseconds: 150));
      if (!mounted) return;
      _segmentCtrls[i].forward();
      HapticFeedback.lightImpact();
    }

    if (to >= widget.totalSteps && mounted) {
      _glowCtrl.forward(from: 0);
      HapticFeedback.heavyImpact();
    }
  }

  @override
  void dispose() {
    for (final ctrl in _segmentCtrls) {
      ctrl.dispose();
    }
    _glowCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: Listenable.merge([..._segmentCtrls, _glowCtrl]),
      builder: (context, child) {
        final isComplete = widget.currentStreak >= widget.totalSteps;
        final glowOpacity = isComplete ? _glowCtrl.value * 0.15 : 0.0;

        return Container(
          padding: const EdgeInsets.all(4),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(8),
            boxShadow: [
              if (isComplete)
                BoxShadow(
                  color: AppColors.success.withValues(alpha: glowOpacity),
                  blurRadius: 16,
                  spreadRadius: 4,
                ),
            ],
          ),
          child: Row(
            children: List.generate(widget.totalSteps, (i) {
              final progress = _segmentCtrls[i].value;
              return Expanded(
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 300),
                  margin: EdgeInsets.only(
                    right: i < widget.totalSteps - 1 ? 6 : 0,
                  ),
                  height: 8,
                  decoration: BoxDecoration(
                    color: Color.lerp(
                      AppColors.iconBackground,
                      isComplete ? const Color(0xFF16A34A) : AppColors.success,
                      progress,
                    ),
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              );
            }),
          ),
        );
      },
    );
  }
}
```

**Where to apply:** Replace the streak bar in `WalletCard._buildLowBalanceCard` and `_buildNormalCard`.

---

## 7. Notification Bell Nudge

**The Problem:** The notification bell has a static red dot. No animation draws attention to new notifications.

**The Spell:** When a new notification arrives, the bell icon does a brief "nudge" shake (like a physical bell being tapped). The red badge counts up with a scale bounce. After 3 seconds, the nudge stops.

```dart
class NotificationBell extends StatefulWidget {
  final int unreadCount;
  final VoidCallback? onTap;

  const NotificationBell({
    super.key,
    required this.unreadCount,
    this.onTap,
  });

  @override
  State<NotificationBell> createState() => _NotificationBellState();
}

class _NotificationBellState extends State<NotificationBell>
    with SingleTickerProviderStateMixin {
  late AnimationController _nudgeCtrl;
  late Animation<double> _nudgeRotation;
  int _prevCount = 0;

  @override
  void initState() {
    super.initState();
    _nudgeCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _nudgeRotation = TweenSequence<double>([
      TweenSequenceItem(tween: Tween(begin: 0, end: -0.15), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -0.15, end: 0.12), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 0.12, end: -0.08), weight: 1),
      TweenSequenceItem(tween: Tween(begin: -0.08, end: 0.05), weight: 1),
      TweenSequenceItem(tween: Tween(begin: 0.05, end: 0), weight: 1),
    ]).animate(CurvedAnimation(parent: _nudgeCtrl, curve: Curves.easeOut));
    _prevCount = widget.unreadCount;
  }

  @override
  void didUpdateWidget(NotificationBell oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.unreadCount > _prevCount) {
      _nudgeCtrl.forward(from: 0);
      HapticFeedback.lightImpact();
    }
    _prevCount = widget.unreadCount;
  }

  @override
  void dispose() {
    _nudgeCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: widget.onTap,
      child: AnimatedBuilder(
        animation: _nudgeCtrl,
        builder: (context, child) {
          return Transform.rotate(
            angle: _nudgeRotation.value,
            child: child,
          );
        },
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
              const Icon(
                Icons.notifications_none_rounded,
                size: 20,
                color: AppColors.onSurface,
              ),
              if (widget.unreadCount > 0)
                Positioned(
                  right: -2,
                  top: -2,
                  child: _AnimatedBadge(count: widget.unreadCount),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AnimatedBadge extends StatefulWidget {
  final int count;
  const _AnimatedBadge({required this.count});

  @override
  State<_AnimatedBadge> createState() => _AnimatedBadgeState();
}

class _AnimatedBadgeState extends State<_AnimatedBadge>
    with SingleTickerProviderStateMixin {
  late AnimationController _bounceCtrl;
  late Animation<double> _scaleAnim;

  @override
  void initState() {
    super.initState();
    _bounceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    );
    _scaleAnim = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _bounceCtrl, curve: Curves.elasticOut),
    );
    _bounceCtrl.forward();
  }

  @override
  void dispose() {
    _bounceCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return ScaleTransition(
      scale: _scaleAnim,
      child: Container(
        width: 8,
        height: 8,
        decoration: const BoxDecoration(
          color: AppColors.error,
          shape: BoxShape.circle,
        ),
      ),
    );
  }
}
```

**Where to apply:** Replace `_buildNotificationBell` in `ActiveDashboardScreen`.

---

## 8. Electric Arc Tab Transition

**The Problem:** Bottom nav tab switches are instant (PageView) or use `animateToPage`. No brand personality in the transition.

**The Spell:** A brief electric spark/arc flashes across the bottom nav bar when switching tabs. The spark travels from the old tab position to the new one. Implemented as a `CustomPainter` overlay on the nav bar.

```dart
class TabSparkOverlay extends StatefulWidget {
  final int fromIndex;
  final int toIndex;
  final int tabCount;
  final VoidCallback onComplete;

  const TabSparkOverlay({
    super.key,
    required this.fromIndex,
    required this.toIndex,
    required this.tabCount,
    required this.onComplete,
  });

  @override
  State<TabSparkOverlay> createState() => _TabSparkOverlayState();
}

class _TabSparkOverlayState extends State<TabSparkOverlay>
    with SingleTickerProviderStateMixin {
  late AnimationController _ctrl;

  @override
  void initState() {
    super.initState();
    _ctrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 300),
    )..forward().then((_) => widget.onComplete());
  }

  @override
  void dispose() {
    _ctrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _ctrl,
      builder: (context, _) {
        return CustomPaint(
          size: const Size(double.infinity, 80),
          painter: _SparkPainter(
            progress: _ctrl.value,
            fromIndex: widget.fromIndex,
            toIndex: widget.toIndex,
            tabCount: widget.tabCount,
          ),
        );
      },
    );
  }
}

class _SparkPainter extends CustomPainter {
  final double progress;
  final int fromIndex;
  final int toIndex;
  final int tabCount;

  _SparkPainter({
    required this.progress,
    required this.fromIndex,
    required this.toIndex,
    required this.tabCount,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (fromIndex == toIndex) return;

    final tabWidth = size.width / tabCount;
    final startX = (fromIndex + 0.5) * tabWidth;
    final endX = (toIndex + 0.5) * tabWidth;
    final y = size.height / 2;

    final currentX = startX + (endX - startX) * progress;
    final opacity = (1.0 - progress).clamp(0.0, 1.0);

    // Draw spark trail
    final paint = Paint()
      ..color = AppColors.primary.withValues(alpha: opacity * 0.6)
      ..strokeWidth = 2
      ..strokeCap = StrokeCap.round;

    final trailLength = tabWidth * 0.3;
    final trailStart =
        currentX - (endX > startX ? trailLength : -trailLength) * progress;
    canvas.drawLine(
      Offset(trailStart, y),
      Offset(currentX, y),
      paint,
    );

    // Draw spark point
    final sparkPaint = Paint()
      ..color = Colors.white.withValues(alpha: opacity)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 4);
    canvas.drawCircle(Offset(currentX, y), 3, sparkPaint);
  }

  @override
  bool shouldRepaint(_SparkPainter old) => old.progress != progress;
}
```

**Where to apply:** Overlay on `AppBottomNav` during tab transitions.

---

## 9. Success State: Electric Burst

**The Problem:** Success states use generic confetti or a green checkmark. No connection to the EV brand.

**The Spell:** Replace confetti with an electric burst — radiating electric-blue particles that expand outward from the success icon, then dissolve. Combined with the existing `AnimatedSuccessGlow` but with electric-themed particles instead of generic circles.

```dart
class ElectricBurstOverlay extends StatefulWidget {
  final bool trigger;
  final VoidCallback? onComplete;

  const ElectricBurstOverlay({
    super.key,
    required this.trigger,
    this.onComplete,
  });

  @override
  State<ElectricBurstOverlay> createState() => _ElectricBurstOverlayState();
}

class _ElectricBurstOverlayState extends State<ElectricBurstOverlay>
    with TickerProviderStateMixin {
  late AnimationController _burstCtrl;
  late List<_Particle> _particles;
  final _random = math.Random();

  @override
  void initState() {
    super.initState();
    _burstCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _particles = _generateParticles();

    _burstCtrl.addStatusListener((status) {
      if (status == AnimationStatus.completed) {
        widget.onComplete?.call();
      }
    });

    if (widget.trigger) _burstCtrl.forward(from: 0);
  }

  @override
  void didUpdateWidget(ElectricBurstOverlay oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.trigger && !oldWidget.trigger) {
      _particles = _generateParticles();
      _burstCtrl.forward(from: 0);
    }
  }

  List<_Particle> _generateParticles() {
    return List.generate(20, (_) {
      final angle = _random.nextDouble() * math.pi * 2;
      final speed = 80.0 + _random.nextDouble() * 120.0;
      final colors = [
        AppColors.primary,
        AppColors.primaryLight,
        const Color(0xFF60A5FA),
        const Color(0xFF93C5FD),
        Colors.white,
      ];
      return _Particle(
        angle: angle,
        speed: speed,
        size: 2.0 + _random.nextDouble() * 4.0,
        color: colors[_random.nextInt(colors.length)],
        delay: _random.nextDouble() * 0.1,
      );
    });
  }

  @override
  void dispose() {
    _burstCtrl.dispose();
  }

  @override
  Widget build(BuildContext context) {
    if (!widget.trigger && _burstCtrl.value == 0) {
      return const SizedBox.shrink();
    }

    return AnimatedBuilder(
      animation: _burstCtrl,
      builder: (context, _) {
        return IgnorePointer(
          child: CustomPaint(
            size: Size.infinite,
            painter: _ElectricBurstPainter(
              particles: _particles,
              progress: _burstCtrl.value,
            ),
          ),
        );
      },
    );
  }
}

class _Particle {
  final double angle;
  final double speed;
  final double size;
  final Color color;
  final double delay;

  _Particle({
    required this.angle,
    required this.speed,
    required this.size,
    required this.color,
    required this.delay,
  });
}

class _ElectricBurstPainter extends CustomPainter {
  final List<_Particle> particles;
  final double progress;

  _ElectricBurstPainter({required this.particles, required this.progress});

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);

    for (final p in particles) {
      final t = ((progress - p.delay) / (1.0 - p.delay)).clamp(0.0, 1.0);
      if (t <= 0) continue;

      final distance = p.speed * t;
      final x = center.dx + math.cos(p.angle) * distance;
      final y = center.dy + math.sin(p.angle) * distance;
      final opacity = (1.0 - t).clamp(0.0, 1.0);
      final currentSize = p.size * (1.0 - t * 0.5);

      final paint = Paint()
        ..color = p.color.withValues(alpha: opacity)
        ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 2);

      canvas.drawCircle(Offset(x, y), currentSize, paint);
    }
  }

  @override
  bool shouldRepaint(_ElectricBurstPainter old) => old.progress != progress;
}
```

**Where to apply:** Top-up success, KYC approval, vehicle assignment, plan purchase.

---

## 10. Skeleton Shimmer with Brand Gradient

**The Problem:** Shimmer loading uses grey-to-white gradient. Generic.

**The Spell:** Replace the standard grey shimmer with a subtle blue-tinted gradient that uses the brand primary color at very low opacity. This makes loading states feel branded.

```dart
/// Brand-aware shimmer that uses primary blue instead of grey.
class VoltiumShimmer extends StatelessWidget {
  final double width;
  final double height;
  final double borderRadius;

  const VoltiumShimmer({
    super.key,
    required this.width,
    required this.height,
    this.borderRadius = 8,
  });

  @override
  Widget build(BuildContext context) {
    return Shimmer.fromColors(
      baseColor: const Color(0xFFE8EDF5), // light blue-grey
      highlightColor: const Color(0xFFF5F8FF), // very light blue
      period: const Duration(milliseconds: 1500),
      child: Container(
        width: width,
        height: height,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(borderRadius),
        ),
      ),
    );
  }
}
```

**Where to apply:** Replace all `ShimmerLoading` usages across the app.

---

## Summary: Priority Order

| Priority | Spell | Effort | Impact |
|----------|-------|--------|--------|
| 1 | Animated Balance Counter | Low | High — every wallet interaction |
| 2 | OTP Digit Spark | Low | High — every login |
| 3 | Payment Streak Celebration | Low | High — key retention mechanic |
| 4 | Notification Bell Nudge | Low | Medium — engagement driver |
| 5 | Electric Pull-to-Refresh | Low | Medium — frequent interaction |
| 6 | Brand Shimmer | Very Low | Medium — every loading state |
| 7 | Battery Charging Animation | Medium | Medium — EV identity |
| 8 | Electric Burst Success | Medium | High — key moments |
| 9 | Card Parallax Tilt | Medium | Medium — dashboard polish |
| 10 | Electric Arc Tab Transition | Medium | Low — subtle but memorable |
