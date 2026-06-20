import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

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
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
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
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('Team Leader',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: AppColors.slate400,
                  letterSpacing: 1.0,
                ),
              ),
              InkWell(
                onTap: onViewDetails,
                child: const Text('View Details',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppColors.primary,
                  ),
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
                  color: const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: AppColors.warningLight),
                ),
                child:
                    const Icon(Icons.stars, color: AppColors.warning, size: 24),
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
                          ? 'Amit Sharma'
                          : teamLeaderName!,
                      style: const TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 4),
                    const Text('Assigned TL',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: AppColors.slate500,
                      ),
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
                  icon: const Icon(Icons.phone,
                      color: Color(0xFF475569), size: 20,),
                  onPressed: onCall,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
