import 'package:flutter/material.dart';
import '../models/rider_model.dart';

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
                color: Colors.black.withOpacity(0.03),
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
                        color: Color(0xFF64748B),
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
                        color: Color(0xFF64748B),
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
                        color: Color(0xFF64748B),
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
            color: const Color(0xFFF1F5F9),
            border: Border.all(color: const Color(0xFFE2E8F0)),
          ),
          child: ClipOval(
            child: rider.profilePhoto != null &&
                    rider.profilePhoto!.isNotEmpty
                ? Image.network(
                    rider.profilePhoto!,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Center(
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
              color: Color(0xFF0053C1),
              size: 20,
            ),
          ),
        ),
      ],
    );
  }
}
