import 'package:flutter/material.dart';
import '../../../../theme/app_theme.dart';

class EmergencySOSScreen extends StatelessWidget {
  const EmergencySOSScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      appBar: AppBar(
        backgroundColor: AppColors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text('Emergency SOS',
            style: TextStyle(
                fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
        leading: Padding(
          padding: const EdgeInsets.only(left: 20),
          child: GestureDetector(
            onTap: () {
              if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: [
                  BoxShadow(
                      color: Colors.black.withValues(alpha: 0.05),
                      blurRadius: 10,
                      offset: const Offset(0, 4))
                ],
              ),
              child: const Icon(Icons.arrow_back,
                  color: Color(0xFF1E293B), size: 20),
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            const SizedBox(height: 40),
            GestureDetector(
              onLongPress: () {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('SOS Alert Triggered! Help is on the way.'),
                    backgroundColor: AppColors.error,
                  ),
                );
              },
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  color: AppColors.error,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: AppColors.error.withValues(alpha: 0.4),
                      blurRadius: 30,
                      spreadRadius: 10,
                    ),
                  ],
                ),
                child: const Center(
                  child: Text(
                    'SOS',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 48,
                      fontWeight: FontWeight.bold,
                      letterSpacing: 2,
                    ),
                  ),
                ),
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Press and hold to trigger an emergency alert',
              style: TextStyle(color: AppColors.slate500, fontSize: 16),
            ),
            const SizedBox(height: 64),
            Row(
              children: [
                Expanded(
                  child: _buildEmergencyContactCard(
                    icon: Icons.local_police,
                    title: 'Police',
                    number: '100',
                    color: Colors.blue,
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildEmergencyContactCard(
                    icon: Icons.local_hospital,
                    title: 'Ambulance',
                    number: '108',
                    color: Colors.red,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            _buildEmergencyContactCard(
              icon: Icons.support_agent,
              title: 'Voltium Support',
              number: '+91-9876543210',
              color: AppColors.primary,
              isFullWidth: true,
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEmergencyContactCard({
    required IconData icon,
    required String title,
    required String number,
    required Color color,
    bool isFullWidth = false,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: isFullWidth
          ? Row(
              children: [
                Icon(icon, color: color, size: 32),
                const SizedBox(width: 16),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 16)),
                    Text(number,
                        style: const TextStyle(color: AppColors.slate500)),
                  ],
                ),
                const Spacer(),
                Icon(Icons.call, color: color),
              ],
            )
          : Column(
              children: [
                Icon(icon, color: color, size: 32),
                const SizedBox(height: 12),
                Text(title,
                    style: const TextStyle(fontWeight: FontWeight.bold)),
                Text(number, style: const TextStyle(color: AppColors.slate500)),
              ],
            ),
    );
  }
}
