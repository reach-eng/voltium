import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/rider_model.dart';
import '../theme/app_theme.dart';
import 'premium_cards.dart';
/// Profile card with vehicle details for the Active Dashboard.
class DashboardProfileCard extends StatelessWidget {
  final RiderModel rider;
  final VoidCallback? onTap;

  const DashboardProfileCard({super.key, required this.rider, this.onTap});

  @override
  Widget build(BuildContext context) {
    return PremiumDoubleBezelCard.interactive(
      onTap: onTap,
      child: Row(
            children: [
              _buildAvatar(),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rider.name.isEmpty ? 'GUEST RIDER' : rider.name,
                      style: const TextStyle(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E293B),
                        letterSpacing: -0.3,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(6),
                        border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
                      ),
                      child: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          const Icon(Icons.electric_scooter, size: 14, color: AppColors.primary),
                          const SizedBox(width: 6),
                          Text(
                            (rider.assignedVehicle == null ||
                                    rider.assignedVehicle!.isEmpty ||
                                    rider.assignedVehicle == 'Not Assigned')
                                ? 'UNASSIGNED'
                                : rider.assignedVehicle!,
                            style: const TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primary,
                              letterSpacing: 0.5,
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

  Widget _buildAvatar() {
    String? getAvatarUrl() {
      if (rider.profilePhoto == null || rider.profilePhoto!.isEmpty)
        return null;
      if (rider.profilePhoto!.startsWith('http')) return rider.profilePhoto;
      const baseUrl = String.fromEnvironment('API_URL',
          defaultValue: 'http://127.0.0.1:8081');
      return '$baseUrl/api/files/${rider.profilePhoto!.replaceFirst(RegExp(r'^/+'), '')}';
    }

    final avatarUrl = getAvatarUrl();

    return Stack(
      clipBehavior: Clip.none,
      children: [
        Container(
          width: 72,
          height: 72,
          decoration: BoxDecoration(
            shape: BoxShape.circle,
            color: AppColors.iconBackground,
            border: Border.all(color: AppColors.outlineVariant),
          ),
          child: ClipOval(
            child: avatarUrl != null
                ? CachedNetworkImage(
                    imageUrl: avatarUrl,
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    memCacheWidth: 144,
                    memCacheHeight: 144,
                    placeholder: (_, __) => const Center(
                      child: SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      ),
                    ),
                    errorWidget: (_, __, ___) => Center(
                      child: Text(
                        rider.name.isNotEmpty
                            ? rider.name[0].toUpperCase()
                            : 'A',
                        style: const TextStyle(
                          fontSize: 24,
                          fontWeight: FontWeight.w900,
                          color: Color(0xFF1E293B),
                        ),
                      ),
                    ),
                  )
                : Center(
                    child: Text(
                      rider.name.isNotEmpty ? rider.name[0].toUpperCase() : 'A',
                      style: const TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.w900,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                  ),
          ),
        ),
        // Checkmark removed to simplify and strictly contain avatar, name, and vehicle.
      ],
    );
  }
}
