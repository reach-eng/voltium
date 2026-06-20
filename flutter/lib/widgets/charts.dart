import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart' as fl;
import '../theme/app_theme.dart';

class PieChartWidget extends StatelessWidget {
  final List<PieChartItem> data;
  final double size;
  final bool showLegend;
  final bool showPercentage;

  const PieChartWidget({
    super.key,
    required this.data,
    this.size = 200,
    this.showLegend = true,
    this.showPercentage = true,
  });

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      children: [
        SizedBox(
          width: size,
          height: size,
          child: fl.PieChart(
            fl.PieChartData(
              sections: data.map((item) {
                final total = data.fold<double>(0, (sum, d) => sum + d.value);
                final percentage =
                    (item.value / total * 100).toStringAsFixed(1);
                return fl.PieChartSectionData(
                  value: item.value,
                  title: showPercentage ? '$percentage%' : '',
                  color: item.color,
                  radius: size * 0.35,
                  titleStyle: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                );
              }).toList(),
              sectionsSpace: 2,
              centerSpaceRadius: size * 0.15,
            ),
          ),
        ),
        if (showLegend) ...[
          const SizedBox(height: 16),
          Wrap(
            spacing: 16,
            runSpacing: 8,
            children: data.map((item) {
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 12,
                    height: 12,
                    decoration: BoxDecoration(
                      color: item.color,
                      shape: BoxShape.circle,
                    ),
                  ),
                  const SizedBox(width: 6),
                  Text(
                    item.label,
                    style: TextStyle(
                      fontSize: 12,
                      color: isDark ? Colors.grey[400] : Colors.grey[600],
                    ),
                  ),
                ],
              );
            }).toList(),
          ),
        ],
      ],
    );
  }
}

class PieChartItem {
  final String label;
  final double value;
  final Color color;

  const PieChartItem({
    required this.label,
    required this.value,
    required this.color,
  });
}

class BarChartWidget extends StatelessWidget {
  final List<BarChartItem> data;
  final double height;
  final bool showGrid;
  final bool showLabels;

  const BarChartWidget({
    super.key,
    required this.data,
    this.height = 200,
    this.showGrid = true,
    this.showLabels = true,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      height: height,
      child: fl.BarChart(
        fl.BarChartData(
          gridData: fl.FlGridData(show: showGrid),
          titlesData: fl.FlTitlesData(
            leftTitles: const fl.AxisTitles(
              sideTitles: fl.SideTitles(showTitles: true, reservedSize: 40),
            ),
            bottomTitles: fl.AxisTitles(
              sideTitles: fl.SideTitles(
                showTitles: showLabels,
                getTitlesWidget: (value, meta) {
                  final index = value.toInt();
                  if (index >= 0 && index < data.length) {
                    return Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: Text(
                        data[index].label,
                        style: const TextStyle(fontSize: 10),
                      ),
                    );
                  }
                  return const Text('');
                },
              ),
            ),
            rightTitles: const fl.AxisTitles(
                sideTitles: fl.SideTitles(showTitles: false),),
            topTitles: const fl.AxisTitles(
                sideTitles: fl.SideTitles(showTitles: false),),
          ),
          borderData: fl.FlBorderData(show: false),
          barGroups: data.asMap().entries.map((entry) {
            return fl.BarChartGroupData(
              x: entry.key,
              barRods: [
                fl.BarChartRodData(
                  toY: entry.value.value,
                  color: entry.value.color,
                  width: 20,
                  borderRadius:
                      const BorderRadius.vertical(top: Radius.circular(4)),
                ),
              ],
            );
          }).toList(),
        ),
      ),
    );
  }
}

class BarChartItem {
  final String label;
  final double value;
  final Color color;

  const BarChartItem({
    required this.label,
    required this.value,
    required this.color,
  });
}

class LineChartWidget extends StatelessWidget {
  final List<LineChartItem> data;
  final double height;
  final bool showGrid;
  final Color lineColor;

  const LineChartWidget({
    super.key,
    required this.data,
    this.height = 200,
    this.showGrid = true,
    this.lineColor = AppColors.primary,
  });

  @override
  Widget build(BuildContext context) {
    final spots = data.asMap().entries.map((entry) {
      return fl.FlSpot(entry.key.toDouble(), entry.value.value);
    }).toList();

    return SizedBox(
      height: height,
      child: fl.LineChart(
        fl.LineChartData(
          gridData: fl.FlGridData(show: showGrid),
          titlesData: const fl.FlTitlesData(
            leftTitles:
                fl.AxisTitles(sideTitles: fl.SideTitles(showTitles: true)),
            bottomTitles:
                fl.AxisTitles(sideTitles: fl.SideTitles(showTitles: false)),
            rightTitles:
                fl.AxisTitles(sideTitles: fl.SideTitles(showTitles: false)),
            topTitles:
                fl.AxisTitles(sideTitles: fl.SideTitles(showTitles: false)),
          ),
          borderData: fl.FlBorderData(show: false),
          lineBarsData: [
            fl.LineChartBarData(
              spots: spots,
              isCurved: true,
              color: lineColor,
              barWidth: 3,
              isStrokeCapRound: true,
              dotData: const fl.FlDotData(show: false),
              belowBarData: fl.BarAreaData(
                show: true,
                color: lineColor.withValues(alpha: 0.1),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class LineChartItem {
  final String label;
  final double value;

  const LineChartItem({
    required this.label,
    required this.value,
  });
}
