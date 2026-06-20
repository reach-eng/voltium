import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class EarningsChart extends StatelessWidget {
  final List<Map<String, dynamic>> dailyEarnings;
  final List<String> dayLabels;

  const EarningsChart({
    super.key,
    required this.dailyEarnings,
    required this.dayLabels,
  });

  @override
  Widget build(BuildContext context) {
    final amounts = dailyEarnings.map((d) => d['amount'] as double).toList();
    final maxAmount =
        amounts.isEmpty ? 0.0 : amounts.reduce((a, b) => a > b ? a : b);
    final bestDayIndex = amounts.isEmpty ? -1 : amounts.indexOf(maxAmount);

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('DAILY BREAKDOWN',
            style: TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w900,
              color: AppColors.slate500,
              letterSpacing: 1.5,
            ),
          ),
          const SizedBox(height: 16),
          SizedBox(
            height: 180,
            child: CustomPaint(
              size: const Size(double.infinity, 180),
              painter: _BarChartPainter(
                amounts: amounts,
                dayLabels: dayLabels,
                maxAmount: maxAmount,
                bestDayIndex: bestDayIndex,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _BarChartPainter extends CustomPainter {
  final List<double> amounts;
  final List<String> dayLabels;
  final double maxAmount;
  final int bestDayIndex;

  _BarChartPainter({
    required this.amounts,
    required this.dayLabels,
    required this.maxAmount,
    required this.bestDayIndex,
  });

  @override
  void paint(Canvas canvas, Size size) {
    if (amounts.isEmpty || maxAmount == 0) return;

    const barWidth = 28.0;
    const barGap = 12.0;
    const labelHeight = 24.0;
    const topPadding = 24.0;
    const bottomPadding = 32.0;

    final chartHeight = size.height - topPadding - bottomPadding - labelHeight;
    final totalBarsWidth =
        amounts.length * barWidth + (amounts.length - 1) * barGap;
    final startX = (size.width - totalBarsWidth) / 2;

    final normalPaint = Paint()
      ..color = AppColors.primary
      ..style = PaintingStyle.fill;

    final bestPaint = Paint()
      ..color = AppColors.success
      ..style = PaintingStyle.fill;

    final labelPaint = TextPainter(
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
    );

    final valuePaint = TextPainter(
      textAlign: TextAlign.center,
      textDirection: TextDirection.ltr,
    );

    for (int i = 0; i < amounts.length; i++) {
      final barHeight =
          maxAmount > 0 ? (amounts[i] / maxAmount) * chartHeight : 0.0;
      final x = startX + i * (barWidth + barGap);
      final y = topPadding + chartHeight - barHeight;

      final rect = RRect.fromRectAndRadius(
        Rect.fromLTWH(x, y, barWidth, barHeight),
        const Radius.circular(6),
      );

      canvas.drawRRect(rect, i == bestDayIndex ? bestPaint : normalPaint);

      if (amounts[i] > 0) {
        valuePaint.text = TextSpan(
          text: '\u20B9${amounts[i].toStringAsFixed(0)}',
          style: const TextStyle(
            fontSize: 8,
            fontWeight: FontWeight.bold,
            color: Color(0xFF1E293B),
          ),
        );
        valuePaint.layout();
        valuePaint.paint(
          canvas,
          Offset(x + (barWidth - valuePaint.width) / 2, y - 14),
        );
      }

      labelPaint.text = TextSpan(
        text: dayLabels.length > i ? dayLabels[i] : '',
        style: const TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: AppColors.slate500,
        ),
      );
      labelPaint.layout();
      labelPaint.paint(
        canvas,
        Offset(x + (barWidth - labelPaint.width) / 2,
            topPadding + chartHeight + 8,),
      );
    }
  }

  @override
  bool shouldRepaint(covariant _BarChartPainter oldDelegate) {
    return oldDelegate.amounts != amounts ||
        oldDelegate.maxAmount != maxAmount ||
        oldDelegate.bestDayIndex != bestDayIndex;
  }
}
