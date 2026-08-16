import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_navigator.dart';

class TlDetailsScreen extends ConsumerWidget {
  const TlDetailsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rider = ref.watch(riderProvider).rider;
    final tlName = (rider?.teamLeader == null ||
            rider!.teamLeader!.isEmpty ||
            rider.teamLeader == 'Not Assigned')
        ? 'Not assigned'
        : rider.teamLeader!;
    final tlPhone =
        (rider?.emergencyContact == null || rider!.emergencyContact!.isEmpty)
            ? ''
            : rider.emergencyContact!;

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                child: Column(
                  children: [
                    _buildTLProfileCard(context, tlName),
                    const SizedBox(height: 20),
                    if (tlPhone.isNotEmpty) _buildContactCard(context, tlPhone),
                    const SizedBox(height: 16),
                    _buildInfoCard(context),
                    const SizedBox(height: 32),
                    _buildActions(context),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          GestureDetector(
            key: const Key('backButton'),
            onTap: () => Navigator.maybePop(context),
            child: Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: AppShadows.glass,
              ),
              child: const Icon(
                Icons.arrow_back,
                size: 18,
                color: AppColors.onSurface,
              ),
            ),
          ),
          SizedBox(width: 16),
          Text(
            'Team Leader',
            style: AppTypography.titleLarge
                .copyWith(fontSize: 21)
                .copyWith(color: AppColors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _buildTLProfileCard(BuildContext context, String name) {
    return Container(
      padding: Spacing.paddingLg,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        children: [
          CircleAvatar(
            radius: 48,
            backgroundColor: AppColors.of(context).iconBackground,
            child:
                Icon(Icons.person, size: 48, color: AppColors.onSurfaceVariant),
          ),
          SizedBox(height: 16),
          Text(
            name,
            style:
                AppTypography.headingSmall.copyWith(color: AppColors.onSurface),
          ),
          SizedBox(height: 4),
          Text(
            'Assigned Team Leader',
            style: AppTypography.bodyMedium
                .copyWith(fontSize: 13)
                .copyWith(color: AppColors.onSurfaceVariant),
          ),
        ],
      ),
    );
  }

  Widget _buildContactCard(BuildContext context, String phone) {
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: AppColors.of(context).surfaceBright,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        children: [
          const Icon(Icons.phone_outlined, color: AppColors.primary, size: 20),
          SizedBox(width: 16),
          Expanded(
            child: Text(
              phone,
              style:
                  AppTypography.bodyLarge.copyWith(color: AppColors.onSurface),
            ),
          ),
          GestureDetector(
            onTap: () async {
              final sanitized = phone.replaceAll(RegExp(r'[^\d+]'), '');
              final uri = Uri.parse('tel:$sanitized');
              if (await canLaunchUrl(uri)) {
                await launchUrl(uri);
              }
            },
            child: Container(
              padding: Spacing.paddingSm,
              decoration: BoxDecoration(
                color: AppColors.of(context).successLight,
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: const Icon(Icons.call, color: AppColors.success, size: 18),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(BuildContext context) {
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: AppColors.of(context).primarySurface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.of(context).infoLight),
      ),
      child: Row(
        children: [
          const Icon(Icons.info_outline, size: 18, color: AppColors.primary),
          SizedBox(width: 12),
          Expanded(
            child: Text(
              'Your team leader is your primary point of contact for daily operations, route guidance, and on-ground support.',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                color: AppColors.primaryDark,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActions(BuildContext context) {
    return Column(
      children: [
        _buildActionBtn(
          // PR-ONBOARDING-2026-08-11 (audit 1.8): the previous onTap popped the
          // screen and showed a green "Request submitted to support team"
          // snackbar without calling any API. Riders thought their TL-change
          // request was submitted; it was not. Now routes to the support
          // center so the rider can actually file a ticket.
          label: 'Request Team Leader change',
          icon: Icons.swap_horiz,
          color: AppColors.error,
          onTap: () => AppNavigator.push(context, const SupportCenterScreen()),
        ),
        const SizedBox(height: 12),
        _buildActionBtn(
          label: 'Back to Dashboard',
          icon: Icons.home_outlined,
          color: AppColors.primary,
          onTap: () => Navigator.pop(context),
        ),
      ],
    );
  }

  Widget _buildActionBtn({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 52,
        width: double.infinity,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(AppRadius.full),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: Colors.white),
            SizedBox(width: 8),
            Text(
              label,
              style: AppTypography.labelLarge.copyWith(color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
