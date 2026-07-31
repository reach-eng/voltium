import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// A battery charging animation with a liquid-wave fill effect that transitions
/// red → amber → green as the charge level increases, with a pulse glow when
/// actively charging.
class BatteryChargeIndicator extends StatefulWidget {
  /// Charge level from 0.0 to 1.0
  final double chargeLevel;

  /// Whether the battery is actively charging (shows pulse glow)
  final bool isCharging;

  /// Size of the widget
  final double width;
  final double height;

  const BatteryChargeIndicator({
    super.key,
    this.chargeLevel = 0.0,
    this.isCharging = false,
    this.width = 48,
    this.height = 80,
  });

  @override
  State<BatteryChargeIndicator> createState() => _BatteryChargeIndicatorState();
}

class _BatteryChargeIndicatorState extends State<BatteryChargeIndicator>
    with SingleTickerProviderStateMixin {
  late AnimationController _waveCtrl;

  @override
  void initState() {
    super.initState();
    _waveCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    if (widget.isCharging) {
      _waveCtrl.repeat();
    }
  }

  @override
  void didUpdateWidget(BatteryChargeIndicator oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (widget.isCharging && !oldWidget.isCharging) {
      _waveCtrl.repeat();
    } else if (!widget.isCharging && oldWidget.isCharging) {
      _waveCtrl.stop();
      _waveCtrl.reset();
    }
  }

  @override
  void dispose() {
    _waveCtrl.dispose();
    super.dispose();
  }

  Color _chargeColor(double level) {
    if (level < 0.25) return AppColors.error;
    if (level < 0.5) return AppColors.warningDark;
    if (level < 0.75) return AppColors.warning;
    return AppColors.success;
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return AnimatedBuilder(
      animation: _waveCtrl,
      builder: (context, child) {
        return CustomPaint(
          size: Size(widget.width, widget.height),
          painter: _BatteryPainter(
            chargeLevel: widget.chargeLevel.clamp(0.0, 1.0),
            isCharging: widget.isCharging,
            chargeColor: _chargeColor(widget.chargeLevel),
            outlineColor: colors.outlineVariant,
            wavePhase: _waveCtrl.value * math.pi * 2,
            pulseGlow: widget.isCharging
                ? 0.5 + 0.5 * math.sin(_waveCtrl.value * math.pi * 2 * 2.5)
                : 0.0,
          ),
        );
      },
    );
  }
}

class _BatteryPainter extends CustomPainter {
  final double chargeLevel;
  final bool isCharging;
  final Color chargeColor;
  final Color outlineColor;
  final double wavePhase;
  final double pulseGlow;

  _BatteryPainter({
    required this.chargeLevel,
    required this.isCharging,
    required this.chargeColor,
    required this.outlineColor,
    required this.wavePhase,
    required this.pulseGlow,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final batteryBody = Rect.fromLTWH(0, 4, size.width, size.height - 4);
    final terminal = Rect.fromLTWH(
      size.width * 0.3,
      0,
      size.width * 0.4,
      4,
    );

    // Battery body rounded rect
    final bodyRRect = RRect.fromRectAndRadius(
      batteryBody,
      const Radius.circular(6),
    );

    // Draw battery outline
    final outlinePaint = Paint()
      ..color = outlineColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.5
      ..strokeCap = StrokeCap.round;
    canvas.drawRRect(bodyRRect, outlinePaint);

    // Draw terminal
    canvas.drawRRect(
      RRect.fromRectAndRadius(terminal, const Radius.circular(2)),
      Paint()..color = outlineColor,
    );

    if (chargeLevel <= 0) return;

    // Inner fill area (inset by stroke width)
    final fillRect = Rect.fromLTWH(
      2,
      6,
      size.width - 4,
      (size.height - 8) * chargeLevel,
    );

    // Liquid wave fill
    if (chargeLevel > 0.05) {
      final wavePaint = Paint()
        ..shader = LinearGradient(
          begin: Alignment.bottomCenter,
          end: Alignment.topCenter,
          colors: [
            chargeColor.withValues(alpha: 0.9),
            chargeColor.withValues(alpha: 0.7),
          ],
        ).createShader(fillRect);

      // Clip to battery body
      canvas.clipRRect(RRect.fromRectAndRadius(
        Rect.fromLTWH(0, 0, size.width, size.height),
        const Radius.circular(6),
      ));

      // Draw wave
      final wavePath = Path();
      final waveHeight = 4.0;
      final fillTop = size.height - fillRect.height - 2;

      wavePath.moveTo(0, size.height);
      for (double x = 0; x <= size.width; x += 1) {
        final wave =
            math.sin((x / size.width) * math.pi * 2 + wavePhase) * waveHeight;
        wavePath.lineTo(x, fillTop + wave);
      }
      wavePath.lineTo(size.width, size.height);
      wavePath.close();

      canvas.drawPath(wavePath, wavePaint);

      // Pulse glow when charging
      if (isCharging && pulseGlow > 0) {
        final glowPaint = Paint()
          ..color = chargeColor.withValues(alpha: pulseGlow * 0.25)
          ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 12);
        canvas.drawCircle(
          Offset(size.width / 2, fillTop + fillRect.height / 2),
          size.width * 0.4,
          glowPaint,
        );
      }

      // Lightning bolt icon for charging
      if (isCharging) {
        final boltPath = Path();
        final cx = size.width / 2;
        final cy = fillRect.center.dy;
        final boltPaint = Paint()
          ..color = Colors.white.withValues(alpha: 0.8)
          ..style = PaintingStyle.fill;
        boltPath.moveTo(cx - 4, cy - 8);
        boltPath.lineTo(cx - 1, cy - 2);
        boltPath.lineTo(cx - 6, cy + 2);
        boltPath.lineTo(cx, cy + 8);
        boltPath.lineTo(cx + 2, cy + 4);
        boltPath.lineTo(cx + 6, cy + 1);
        boltPath.lineTo(cx + 1, cy - 4);
        boltPath.close();
        canvas.drawPath(boltPath, boltPaint);
      }
    }
  }

  @override
  bool shouldRepaint(_BatteryPainter old) =>
      old.chargeLevel != chargeLevel ||
      old.isCharging != isCharging ||
      old.wavePhase != wavePhase;
}
