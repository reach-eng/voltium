import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/premium_cards.dart';
import 'package:voltium_rider/theme/app_typography.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/haptic_service.dart';

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
    final l10n = AppLocalizations.of(context);
    final isUnassigned = teamLeaderName == null ||
        teamLeaderName!.isEmpty ||
        teamLeaderName == 'Not Assigned';
    final displayName = isUnassigned
        ? (l10n?.txtnotAssigned ?? 'Not assigned')
        : teamLeaderName!;

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
                    l10n?.txtteamLeader ?? 'Team Leader',
                    style: AppTypography.bodySmall
                        .copyWith(fontWeight: FontWeight.w800)
                        .copyWith(
                            color: colors.onSurfaceMuted, letterSpacing: 1.0),
                  ),
                  InkWell(
                    onTap: onViewDetails != null
                        ? () {
                            HapticService.light();
                            onViewDetails!();
                          }
                        : null,
                    child: Text(
                      l10n?.txtviewDetailsAction ?? 'View Details',
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
                      border: Border.all(color: colors.warningLight),
                    ),
                    child: const Icon(Icons.stars,
                        color: AppColors.warningForeground, size: 24),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          displayName,
                          style: AppTypography.titleSmall
                              .copyWith(color: colors.onSurface),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          isUnassigned
                              ? (l10n?.txttlPendingNotice ??
                                  'Your hub will assign a team leader shortly')
                              : (l10n?.txtassignedTlBadge ?? 'Assigned TL'),
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
                      onPressed: onCall != null
                          ? () {
                              HapticService.light();
                              onCall!();
                            }
                          : null,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ));
  }
}
