import 'package:flutter/material.dart';

/// A glass-styled KPI tile for dashboard grid.
class GlassKpiTile extends StatelessWidget {
  final String label;
  final String value;
  final IconData icon;
  final Color color;

  const GlassKpiTile({
    super.key,
    required this.label,
    required this.value,
    required this.icon,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white.withOpacity(0.1),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white.withOpacity(0.2)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 18),
              const Spacer(),
              Container(
                width: 4,
                height: 4,
                decoration: BoxDecoration(
                  color: color,
                  shape: BoxShape.circle,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            label,
            style: TextStyle(
              fontSize: 8,
              fontWeight: FontWeight.w900,
              color: Colors.white.withOpacity(0.4),
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.bold,
              color: Colors.white,
            ),
          ),
        ],
      ),
    );
  }
}

/// A glass KPI grid with 4 tiles for speed, wallet, battery, and renewal.
class KpiGrid extends StatelessWidget {
  final double walletBalance;
  final double batteryPercent;
  final double currentSpeed;
  final DateTime? planEndDate;

  const KpiGrid({
    super.key,
    required this.walletBalance,
    required this.batteryPercent,
    required this.currentSpeed,
    this.planEndDate,
  });

  @override
  Widget build(BuildContext context) {
    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 16,
      crossAxisSpacing: 16,
      childAspectRatio: 1.4,
      children: [
        GlassKpiTile(
          label: 'COMMAND WALLET',
          value: '₹${walletBalance.toInt()}',
          icon: Icons.account_balance_wallet_rounded,
          color: const Color(0xFF0053C1),
        ),
        GlassKpiTile(
          label: 'SYSTEM HEALTH',
          value: '${batteryPercent.toInt()}%',
          icon: Icons.battery_charging_full_rounded,
          color: batteryPercent < 20 ? Colors.red : const Color(0xFF10B981),
        ),
        GlassKpiTile(
          label: 'VELOCITY',
          value: '${currentSpeed.toInt()} km/h',
          icon: Icons.speed_rounded,
          color: Colors.purpleAccent,
        ),
        GlassKpiTile(
          label: 'TIME TO RENEW',
          value: '${planEndDate?.difference(DateTime.now()).inDays ?? 0}d',
          icon: Icons.timer_rounded,
          color: Colors.orangeAccent,
        ),
      ],
    );
  }
}
