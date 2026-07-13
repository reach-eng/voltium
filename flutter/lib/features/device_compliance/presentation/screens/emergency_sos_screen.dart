import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

class EmergencySOSScreen extends ConsumerWidget {
  const EmergencySOSScreen({super.key});

  Future<void> _callNumber(String number) async {
    final sanitizedNumber = number.replaceAll(RegExp(r'[^\d+]'), '');
    final uri = Uri.parse('tel:$sanitizedNumber');
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rider = ref.watch(appProvider.select((p) => p.rider));
    final emergencyContact = rider?.emergencyContact;

    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      appBar: AppBar(
        backgroundColor: AppColors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text('Emergency SOS',
            style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.bold, color: AppColors.slate800)),
        leadingWidth: 68,
        leading: Padding(
          padding: const EdgeInsets.only(left: 20),
          child: UnconstrainedBox(
            child: GestureDetector(
              onTap: () {
                if (Navigator.canPop(context)) {
                  Navigator.pop(context);
                }
              },
              child: Container(
                width: 44,
                height: 44,
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
                    color: AppColors.slate800, size: 20),
              ),
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            SizedBox(height: 40),
            GestureDetector(
              onLongPress: () {
                PostHogService.capture('emergency_sos_triggered');
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
                child: Center(
                  child: Text(
                    'SOS',
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white,
                      fontSize: 48,
                      fontWeight: FontWeight.w900,
                      letterSpacing: 2,
                    ),
                  ),
                ),
              ),
            ),
            SizedBox(height: 24),
            Text(
              'Press and hold to trigger an emergency alert',
              style: GoogleFonts.plusJakartaSans(
                  color: AppColors.slate500, fontSize: 16),
            ),
            const SizedBox(height: 64),
            // Personal emergency contact (from profile).
            if (emergencyContact != null &&
                emergencyContact.toString().isNotEmpty) ...[
              _buildEmergencyContactCard(
                icon: Icons.person,
                title: 'My Emergency Contact',
                number: emergencyContact.toString(),
                color: AppColors.errorRed,
                isFullWidth: true,
                onTap: () => _callNumber(emergencyContact.toString()),
              ),
              const SizedBox(height: 16),
            ],
            Row(
              children: [
                Expanded(
                  child: _buildEmergencyContactCard(
                    icon: Icons.local_police,
                    title: 'Police',
                    number: '100',
                    color: Colors.blue,
                    onTap: () => _callNumber('100'),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: _buildEmergencyContactCard(
                    icon: Icons.local_hospital,
                    title: 'Ambulance',
                    number: '108',
                    color: Colors.red,
                    onTap: () => _callNumber('108'),
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
              onTap: () => _callNumber('9876543210'),
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
    VoidCallback? onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
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
                  SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(title, style: AppTypography.titleSmall),
                        Text(number,
                            style: GoogleFonts.plusJakartaSans(
                                color: AppColors.slate500)),
                      ],
                    ),
                  ),
                  Icon(Icons.call, color: color),
                ],
              )
            : Column(
                children: [
                  Icon(icon, color: color, size: 32),
                  SizedBox(height: 12),
                  Text(title,
                      style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.bold)),
                  Text(number,
                      style: GoogleFonts.plusJakartaSans(
                          color: AppColors.slate500)),
                  const SizedBox(height: 8),
                  Icon(Icons.call, color: color, size: 18),
                ],
              ),
      ),
    );
  }
}
