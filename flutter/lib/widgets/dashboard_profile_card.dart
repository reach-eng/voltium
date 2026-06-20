import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/rider_model.dart';
import '../theme/app_theme.dart';

/// Profile card with vehicle details for the Active Dashboard.
class DashboardProfileCard extends StatelessWidget {
  final RiderModel rider;
  final VoidCallback? onTap;

  const DashboardProfileCard({super.key, required this.rider, this.onTap});

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(28),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(28),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 20,
                offset: const Offset(0, 4),
              ),
            ],
          ),
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
                    Text(
                      'ID: ${rider.riderId.isEmpty ? 'VF-RD-000' : rider.riderId}',
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppColors.slate500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      (rider.assignedVehicle == null ||
                              rider.assignedVehicle!.isEmpty ||
                              rider.assignedVehicle == 'Not Assigned')
                          ? 'DL-8C-AB-1234'
                          : rider.assignedVehicle!,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppColors.slate500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      (rider.pickupHub == null ||
                              rider.pickupHub!.isEmpty ||
                              rider.pickupHub == 'Not Assigned')
                          ? 'BattSwap Delhi'
                          : rider.pickupHub!,
                      style: const TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w500,
                        color: AppColors.slate500,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildAvatar() {
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
            child: rider.profilePhoto != null && rider.profilePhoto!.isNotEmpty
                ? CachedNetworkImage(
                    imageUrl: rider.profilePhoto!,
                    fit: BoxFit.cover,
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
        Positioned(
          bottom: -2,
          right: -2,
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              shape: BoxShape.circle,
            ),
            padding: const EdgeInsets.all(2),
            child: const Icon(
              Icons.check_circle,
              color: AppColors.primary,
              size: 20,
            ),
          ),
        ),
      ],
    );
  }
}
