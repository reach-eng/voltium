import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

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
            iconBgColor: const Color(0xFFEFF6FF),
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
              iconBgColor: const Color(0xFFFFFBEB),
              title: 'TEAM LEADER',
              value: (teamLeader == null ||
                      teamLeader!.isEmpty ||
                      teamLeader == 'Not Assigned')
                  ? 'Amit Sharma'
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
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
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
          const SizedBox(height: 12),
          Text(
            title,
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w800,
              color: AppColors.slate400,
              letterSpacing: 1.0,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E293B),
            ),
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}
