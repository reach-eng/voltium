import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// A bento-styled tile for the Active Dashboard grid.
class BentoGrid extends StatelessWidget {
  final String? pickupHub;
  final String? teamLeader;
  final VoidCallback? onTeamLeaderTap;

  const BentoGrid({
    super.key,
    this.pickupHub,
    this.teamLeader,
    this.onTeamLeaderTap,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: _BentoTile(
            icon: Icons.location_on,
            iconColor: AppColors.primary,
            iconBgColor: AppColors.primarySurface,
            title: 'ACTIVE HUB',
            value: (pickupHub == null ||
                    pickupHub!.isEmpty ||
                    pickupHub == 'Not Assigned')
                ? 'Central Hub'
                : pickupHub!,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: InkWell(
            onTap: onTeamLeaderTap,
            child: _BentoTile(
              icon: Icons.stars,
              iconColor: AppColors.warningDark,
              iconBgColor: AppColors.warningSurface,
              title: 'TEAM LEADER',
              value: (teamLeader == null ||
                      teamLeader!.isEmpty ||
                      teamLeader == 'Not Assigned')
                  ? 'Not assigned'
                  : teamLeader!,
            ),
          ),
        ),
      ],
    );
  }
}

class _BentoTile extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final String title;
  final String value;

  const _BentoTile({
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(20),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(icon, color: iconColor, size: 20),
          ),
          SizedBox(height: 12),
          Text(
            title,
            style: AppTypography.overline
                .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.0),
          ),
          SizedBox(height: 4),
          Text(
            value,
            style: AppTypography.labelLarge.copyWith(color: colors.onSurface),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
