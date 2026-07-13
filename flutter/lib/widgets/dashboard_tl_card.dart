import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import 'premium_cards.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Team Leader card widget for the Active Dashboard.
class TeamLeaderCard extends StatelessWidget {
  final String? teamLeaderName;
  final VoidCallback? onViewDetails;
  final VoidCallback? onCall;

  const TeamLeaderCard({
    super.key,
    required this.teamLeaderName,
    this.onViewDetails,
    this.onCall,
  });

  @override
  Widget build(BuildContext context) {
    return PremiumDoubleBezelCard(
        padding: EdgeInsets.zero,
        child: Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            boxShadow: AppShadows.glass,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Team Leader',
                    style: AppTypography.bodySmallStrong.copyWith(
                        color: AppColors.slate400, letterSpacing: 1.0),
                  ),
                  InkWell(
                    onTap: onViewDetails,
                    child: Text(
                      'View Details',
                      style: AppTypography.labelMedium
                          .copyWith(color: AppColors.primary),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.warningSurface,
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: AppColors.warningLight),
                    ),
                    child: const Icon(Icons.stars,
                        color: AppColors.warning, size: 24),
                  ),
                  SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          (teamLeaderName == null ||
                                  teamLeaderName!.isEmpty ||
                                  teamLeaderName == 'Not Assigned')
                              ? 'Not assigned'
                              : teamLeaderName!,
                          style: AppTypography.titleSmall
                              .copyWith(color: AppColors.slate800),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Assigned TL',
                          style: AppTypography.bodySmallEmphasis
                              .copyWith(color: AppColors.slate500),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      color: AppColors.iconBackground,
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: IconButton(
                      icon: const Icon(
                        Icons.phone,
                        color: AppColors.slate600,
                        size: 20,
                      ),
                      onPressed: onCall,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ));
  }
}
