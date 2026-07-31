import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/premium_cards.dart';
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
    final colors = AppColors.of(context);
    return PremiumDoubleBezelCard(
        padding: EdgeInsets.zero,
        child: Container(
          padding: Spacing.paddingMd,
          decoration: BoxDecoration(
            color: colors.card,
            borderRadius: BorderRadius.circular(AppRadius.radiusBottomSheet),
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
                    style: AppTypography.bodySmall
                        .copyWith(fontWeight: FontWeight.w800)
                        .copyWith(
                            color: colors.onSurfaceMuted, letterSpacing: 1.0),
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
              const SizedBox(height: 16),
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: AppColors.warningSurface,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(color: AppColors.warningLight),
                    ),
                    child: const Icon(Icons.stars,
                        color: AppColors.warning, size: 24),
                  ),
                  const SizedBox(width: 16),
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
                              .copyWith(color: colors.onSurface),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Assigned TL',
                          style: AppTypography.bodySmall
                              .copyWith(fontWeight: FontWeight.w600)
                              .copyWith(color: colors.onSurfaceVariant),
                        ),
                      ],
                    ),
                  ),
                  Container(
                    decoration: BoxDecoration(
                      color: colors.iconBackground,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: IconButton(
                      icon: Icon(
                        Icons.phone,
                        color: colors.onSurfaceVariant,
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
