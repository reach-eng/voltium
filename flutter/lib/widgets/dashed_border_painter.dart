import 'dart:math' as math;
import 'dart:ui';
import 'package:flutter/material.dart';

class DashedBorderPainter extends CustomPainter {
  final Color color;
  final double strokeWidth;
  final double dashPattern;
  final double gapPattern;
  final double borderRadius;

  DashedBorderPainter({
    this.color = const Color(0xFFC2C6D6),
    this.strokeWidth = 2.0,
    this.dashPattern = 6.0,
    this.gapPattern = 4.0,
    this.borderRadius = 16.0,
  });

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..strokeWidth = strokeWidth
      ..style = PaintingStyle.stroke;

    final path = Path()
      ..addRRect(RRect.fromRectAndRadius(
        Rect.fromLTWH(
          strokeWidth / 2,
          strokeWidth / 2,
          size.width - strokeWidth,
          size.height - strokeWidth,
        ),
        Radius.circular(borderRadius),
      ),);

    final dashedPath = _buildDashedPath(path, dashPattern, gapPattern);
    canvas.drawPath(dashedPath, paint);
  }

  Path _buildDashedPath(Path source, double dashWidth, double gapWidth) {
    final Path dest = Path();
    for (final PathMetric metric in source.computeMetrics()) {
      double distance = 0.0;
      bool draw = true;
      while (distance < metric.length) {
        final double length = draw ? dashWidth : gapWidth;
        if (draw) {
          dest.addPath(
            metric.extractPath(
              distance,
              math.min(distance + length, metric.length),
            ),
            Offset.zero,
          );
        }
        distance += length;
        draw = !draw;
      }
    }
    return dest;
  }

  @override
  bool shouldRepaint(DashedBorderPainter oldDelegate) {
    return oldDelegate.color != color ||
        oldDelegate.strokeWidth != strokeWidth ||
        oldDelegate.dashPattern != dashPattern ||
        oldDelegate.gapPattern != gapPattern ||
        oldDelegate.borderRadius != borderRadius;
  }
}
