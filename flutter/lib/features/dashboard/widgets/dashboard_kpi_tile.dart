import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

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
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: Colors.white.withValues(alpha: 0.2)),
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
          SizedBox(height: 12),
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 8,
              fontWeight: FontWeight.w800,
              color: Colors.white.withValues(alpha: 0.4),
              letterSpacing: 1.0,
            ),
          ),
          SizedBox(height: 2),
          Text(
            value,
            style: AppTypography.titleMedium.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}

/// A glass KPI grid with 4 tiles for speed, wallet, battery, and renewal.
class KpiGrid extends StatelessWidget {
  final double walletBalance;
  // PR-10 (F-040 — 2026-08-22 deep audit): battery now flows
  // through as nullable so the UI can show "Unavailable" when
  // the device-data sync hasn't reported a reading yet, instead
  // of silently displaying "0%" (which the rider reads as
  // "battery dead, call support"). Callers that already have a
  // value can pass it; the dashboard wires this from the rider
  // model's nullable `batteryPercent`.
  final double? batteryPercent;
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
          color: AppColors.primary,
        ),
        GlassKpiTile(
          label: 'SYSTEM HEALTH',
          // PR-10 (F-040): show "Unavailable" instead of "0%"
          // when no reading has arrived. The previous code
          // displayed a silent "0%" which the rider reads as
          // "battery dead, call support" — a false alarm.
          value: batteryPercent != null ? '${batteryPercent!.toInt()}%' : '—',
          icon: Icons.battery_charging_full_rounded,
          color: batteryPercent == null
              ? AppColors.of(context).onSurfaceVariant
              : (batteryPercent! < 20 ? AppColors.error : AppColors.success),
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
