import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../models/rider_model.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/premium_cards.dart';
import '../../../core/network/api_client.dart';
import 'package:voltium_rider/theme/app_typography.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/haptic_service.dart';

/// Profile card with vehicle details for the Active Dashboard.
class DashboardProfileCard extends StatelessWidget {
  final RiderModel rider;
  final VoidCallback? onTap;

  const DashboardProfileCard({super.key, required this.rider, this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final fallbackRider = l10n?.txtguestRider ?? 'Rider';
    final isUnassignedVehicle = rider.assignedVehicle == null ||
        rider.assignedVehicle!.isEmpty ||
        rider.assignedVehicle == 'Not Assigned';
    final vehicleText = isUnassignedVehicle
        ? (l10n?.txtvehiclePendingAssignment ?? 'Vehicle Pending Assignment')
        : rider.assignedVehicle!;

    return PremiumDoubleBezelCard.interactive(
      onTap: onTap != null
          ? () {
              HapticService.light();
              onTap!();
            }
          : null,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      child: Row(
        children: [
          _buildAvatar(colors),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  rider.name.isEmpty ? fallbackRider : rider.name,
                  style: AppTypography.titleLarge
                      .copyWith(color: colors.onSurface, letterSpacing: -0.3),
                ),
                const SizedBox(height: 4),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(6),
                    border: Border.all(
                        color: AppColors.primary.withValues(alpha: 0.2)),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.electric_scooter,
                          size: 14, color: AppColors.primary),
                      const SizedBox(width: 6),
                      Flexible(
                        child: Text(
                          vehicleText,
                          style: AppTypography.labelMedium.copyWith(
                              color: AppColors.primary, letterSpacing: 0.5),
                          overflow: TextOverflow.ellipsis,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAvatar(ThemeColors colors) {
    String? getAvatarUrl() {
      if (rider.profilePhoto == null || rider.profilePhoto!.isEmpty)
        return null;
      if (rider.profilePhoto!.startsWith('http')) return rider.profilePhoto;
      final baseUrl = ApiClient().baseUrl;
      return '$baseUrl/api/files/${rider.profilePhoto!.replaceFirst(RegExp(r'^/+'), '')}';
    }

    final avatarUrl = getAvatarUrl();

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 56,
          height: 56,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: colors.iconBackground,
            border: Border.all(color: colors.outlineVariant),
          ),
          child: ClipOval(
            child: avatarUrl != null
                ? CachedNetworkImage(
                    imageUrl: avatarUrl,
                    width: 56,
                    height: 56,
                    fit: BoxFit.cover,
                    memCacheWidth: 112,
                    memCacheHeight: 112,
                    placeholder: (_, __) => const Center(
                      child: SizedBox(
                        width: 18,
                        height: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                    errorWidget: (_, __, ___) => Center(
                      child: Text(
                        rider.name.isNotEmpty
                            ? rider.name[0].toUpperCase()
                            : 'A',
                        style: AppTypography.headingSmall
                            .copyWith(color: colors.onSurface),
                      ),
                    ),
                  )
                : Center(
                    child: Text(
                      rider.name.isNotEmpty ? rider.name[0].toUpperCase() : 'A',
                      style: AppTypography.headingSmall
                          .copyWith(color: colors.onSurface),
                    ),
                  ),
          ),
        ),
        // Checkmark removed to simplify and strictly contain avatar, name, and vehicle.
      ],
    );
  }
}
