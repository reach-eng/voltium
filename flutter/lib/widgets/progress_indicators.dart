import 'dart:math' as math;
import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class CircularProgressIndicator2 extends StatelessWidget {
  final double progress;
  final double size;
  final double strokeWidth;
  final Color? backgroundColor;
  final Color? progressColor;
  final Widget? child;
  final bool showPercentage;

  const CircularProgressIndicator2({
    super.key,
    required this.progress,
    this.size = 100,
    this.strokeWidth = 8,
    this.backgroundColor,
    this.progressColor,
    this.child,
    this.showPercentage = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return SizedBox(
      width: size,
      height: size,
      child: Stack(
        alignment: Alignment.center,
        children: [
          CustomPaint(
            size: Size(size, size),
            painter: _CircularProgressPainter(
              progress: progress.clamp(0.0, 1.0),
              strokeWidth: strokeWidth,
              backgroundColor: backgroundColor ?? colors.outlineVariant,
              progressColor: progressColor ?? AppColors.primary,
            ),
          ),
          if (child != null)
            child!
          else if (showPercentage)
            Text(
              '${(progress * 100).toInt()}%',
              style: GoogleFonts.plusJakartaSans(
                fontSize: size * 0.2,
                fontWeight: FontWeight.bold,
                color: progressColor ?? AppColors.primary,
              ),
            ),
        ],
      ),
    );
  }
}

class _CircularProgressPainter extends CustomPainter {
  final double progress;
  final double strokeWidth;
  final Color backgroundColor;
  final Color progressColor;

  _CircularProgressPainter({
    required this.progress,
    required this.strokeWidth,
    required this.backgroundColor,
    required this.progressColor,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final center = Offset(size.width / 2, size.height / 2);
    final radius = (size.width - strokeWidth) / 2;

    final bgPaint = Paint()
      ..color = backgroundColor
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    canvas.drawCircle(center, radius, bgPaint);

    final progressPaint = Paint()
      ..color = progressColor
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke
      ..strokeCap = StrokeCap.round;

    final sweepAngle = 2 * math.pi * progress;
    canvas.drawArc(
      Rect.fromCircle(center: center, radius: radius),
      -math.pi / 2,
      sweepAngle,
      false,
      progressPaint,
    );
  }

  @override
  bool shouldRepaint(_CircularProgressPainter old) =>
      old.progress != progress ||
      old.progressColor != progressColor ||
      old.backgroundColor != backgroundColor;
}

class KYCProgressIndicator extends StatelessWidget {
  final int completedSteps;
  final int totalSteps;
  final List<String> stepLabels;
  final double size;

  const KYCProgressIndicator({
    super.key,
    required this.completedSteps,
    required this.totalSteps,
    required this.stepLabels,
    this.size = 120,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final progress = totalSteps > 0 ? completedSteps / totalSteps : 0.0;
    final isComplete = completedSteps >= totalSteps;

    return Column(
      children: [
        Stack(
          alignment: Alignment.center,
          children: [
            CircularProgressIndicator2(
              progress: progress,
              size: size,
              strokeWidth: 10,
              progressColor: isComplete ? AppColors.success : AppColors.primary,
            ),
            if (isComplete)
              const Icon(
                Icons.check,
                color: AppColors.success,
                size: 40,
              )
            else
              Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    '${(progress * 100).toInt()}%',
                    style: AppTypography.headingMedium,
                  ),
                  Text(
                    '$completedSteps/$totalSteps',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 12,
                      color: colors.onSurfaceVariant,
                    ),
                  ),
                ],
              ),
          ],
        ),
        SizedBox(height: 24),
        ...List.generate(totalSteps, (index) {
          final isCompleted = index < completedSteps;
          return Padding(
            padding: const EdgeInsets.symmetric(vertical: 8),
            child: Row(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: isCompleted ? AppColors.success : colors.divider,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isCompleted ? Icons.check : Icons.circle_outlined,
                    color: isCompleted ? Colors.white : colors.onSurfaceVariant,
                    size: 14,
                  ),
                ),
                SizedBox(width: 12),
                Text(
                  stepLabels[index],
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 14,
                    fontWeight:
                        isCompleted ? FontWeight.w600 : FontWeight.normal,
                    color: isCompleted
                        ? colors.onSurface
                        : colors.onSurfaceVariant,
                    decoration:
                        isCompleted ? TextDecoration.none : TextDecoration.none,
                  ),
                ),
              ],
            ),
          );
        }),
      ],
    );
  }
}

class StepProgressIndicator extends StatelessWidget {
  final int currentStep;
  final int totalSteps;
  final List<String> labels;
  final bool showLabels;

  const StepProgressIndicator({
    super.key,
    required this.currentStep,
    required this.totalSteps,
    required this.labels,
    this.showLabels = true,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (showLabels)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text(
              'Step ${currentStep + 1} of $totalSteps',
              style: AppTypography.bodySmall
                  .copyWith(color: colors.onSurfaceVariant),
            ),
          ),
        Row(
          children: List.generate(totalSteps, (index) {
            final isCompleted = index < currentStep;
            final isCurrent = index == currentStep;

            return Expanded(
              child: Container(
                margin: EdgeInsets.only(right: index < totalSteps - 1 ? 4 : 0),
                height: 4,
                decoration: BoxDecoration(
                  color: isCompleted || isCurrent
                      ? (isCurrent ? AppColors.primary : AppColors.success)
                      : colors.divider,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
            );
          }),
        ),
        if (showLabels && labels.isNotEmpty) ...[
          SizedBox(height: 12),
          Text(
            labels[currentStep.clamp(0, labels.length - 1)],
            style:
                AppTypography.bodyMedium.copyWith(fontWeight: FontWeight.w600),
          ),
        ],
      ],
    );
  }
}

class AnimatedProgressBar extends StatefulWidget {
  final double progress;
  final double height;
  final Color? backgroundColor;
  final Color? progressColor;
  final Duration duration;
  final BorderRadius? borderRadius;

  const AnimatedProgressBar({
    super.key,
    required this.progress,
    this.height = 8,
    this.backgroundColor,
    this.progressColor,
    this.duration = const Duration(milliseconds: 500),
    this.borderRadius,
  });

  @override
  State<AnimatedProgressBar> createState() => _AnimatedProgressBarState();
}

class _AnimatedProgressBarState extends State<AnimatedProgressBar>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _animation;
  double _oldProgress = 0;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(vsync: this, duration: widget.duration);
    _animation = Tween<double>(begin: 0, end: widget.progress).animate(
      CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
    );
    _controller.forward();
  }

  @override
  void didUpdateWidget(AnimatedProgressBar oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.progress != widget.progress) {
      _oldProgress = oldWidget.progress;
      _animation =
          Tween<double>(begin: _oldProgress, end: widget.progress).animate(
        CurvedAnimation(parent: _controller, curve: Curves.easeInOut),
      );
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
    final colors = AppColors.of(context);
    final radius =
        widget.borderRadius ?? BorderRadius.circular(widget.height / 2);

    return AnimatedBuilder(
      animation: _animation,
      builder: (context, child) {
        return Container(
          height: widget.height,
          decoration: BoxDecoration(
            color: widget.backgroundColor ?? colors.outlineVariant,
            borderRadius: radius,
          ),
          child: FractionallySizedBox(
            alignment: Alignment.centerLeft,
            widthFactor: _animation.value.clamp(0.0, 1.0),
            child: Container(
              decoration: BoxDecoration(
                color: widget.progressColor ?? AppColors.primary,
                borderRadius: radius,
              ),
            ),
          ),
        );
      },
    );
  }
}
