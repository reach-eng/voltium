import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/api_client.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'package:voltium_rider/features/rewards/presentation/screens/rewards_screen.dart';
import 'app_settings_screen.dart';
import 'profile_detail_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/documents_screen.dart';
import 'package:voltium_rider/features/referrals/presentation/screens/referral_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/legal_page_screen.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_sos_screen.dart';
import 'package:voltium_rider/features/workflows/presentation/screens/rider_workflow_hub_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';
import '../widgets/profile_widgets.dart';
import '../../../../theme/app_theme.dart';

import 'package:google_fonts/google_fonts.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';

/// Menu screen (formerly "Profile" tab).
/// Shows a compact rider header and a list of navigation links.
/// Detailed profile information lives in [ProfileDetailScreen].
class ProfileScreen extends ConsumerWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      appBar: _buildAppBar(),
      body: Consumer(
        builder: (context, innerRef, _) {
          final rider = innerRef.watch(appProvider).rider;
          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // ── Compact rider header ──────────────────────────────────
                FadeUpWidget(
                  delay: 0,
                  child: _CompactRiderHeader(rider: rider),
                ),
                const SizedBox(height: 24),

                // ── Menu sections ─────────────────────────────────────────
                const _SectionLabel('ACCOUNT'),
                const SizedBox(height: 12),

                // Profile (opens full detail screen)
                FadeUpWidget(
                  delay: 100,
                  child: QuickLinkItem(
                    key: const Key('profileMenuLink'),
                    icon: Icons.person_outline,
                    activeIcon: Icons.person,
                    iconColor: AppColors.primary,
                    iconBgColor: const Color(0xFFEFF6FF),
                    title: 'Profile',
                    onTap: () =>
                        AppNavigator.push(context, const ProfileDetailScreen()),
                  ),
                ),
                const SizedBox(height: 8),

                FadeUpWidget(
                  delay: 150,
                  child: QuickLinkItem(
                    key: const Key('myDocumentsLink'),
                    icon: Icons.contact_page_outlined,
                    activeIcon: Icons.contact_page,
                    iconColor: AppColors.success,
                    iconBgColor: const Color(0xFFECFDF5),
                    title: 'My Documents',
                    onTap: () =>
                        AppNavigator.push(context, const MyDocumentsScreen()),
                  ),
                ),
                const SizedBox(height: 24),

                const _SectionLabel('REWARDS & MORE'),
                const SizedBox(height: 12),

                FadeUpWidget(
                  delay: 200,
                  child: QuickLinkItem(
                    key: const Key('rewardsLink'),
                    icon: Icons.card_giftcard_outlined,
                    activeIcon: Icons.card_giftcard,
                    iconColor: AppColors.evPurple,
                    iconBgColor: const Color(0xFFF5F3FF),
                    title: 'Rewards',
                    onTap: () =>
                        AppNavigator.push(context, const RewardsScreen()),
                  ),
                ),
                const SizedBox(height: 8),

                FadeUpWidget(
                  delay: 250,
                  child: QuickLinkItem(
                    key: const Key('referralLink'),
                    icon: Icons.people_outline,
                    activeIcon: Icons.people,
                    iconColor: AppColors.warning,
                    iconBgColor: const Color(0xFFFFFBEB),
                    title: 'Referral Program',
                    onTap: () =>
                        AppNavigator.push(context, const ReferralScreen()),
                  ),
                ),
                const SizedBox(height: 24),

                const _SectionLabel('GENERAL'),
                const SizedBox(height: 12),

                FadeUpWidget(
                  delay: 300,
                  child: QuickLinkItem(
                    key: const Key('workflowHubLink'),
                    icon: Icons.route_outlined,
                    activeIcon: Icons.route,
                    iconColor: AppColors.primary,
                    iconBgColor: const Color(0xFFEFF6FF),
                    title: 'Workflow & Services',
                    onTap: () => AppNavigator.push(
                        context, const RiderWorkflowHubScreen()),
                  ),
                ),
                const SizedBox(height: 8),

                FadeUpWidget(
                  delay: 340,
                  child: QuickLinkItem(
                    key: const Key('feedbackLink'),
                    icon: Icons.rate_review_outlined,
                    activeIcon: Icons.rate_review,
                    iconColor: const Color(0xFF7E22CE),
                    iconBgColor: const Color(0xFFF3E8FF),
                    title: 'Feedback',
                    onTap: () => AppNavigator.push(context,
                        FeedbackScreen(onSubmit: () => Navigator.pop(context))),
                  ),
                ),
                const SizedBox(height: 8),

                FadeUpWidget(
                  delay: 380,
                  child: QuickLinkItem(
                    key: const Key('appSettingsLink'),
                    icon: Icons.settings_outlined,
                    activeIcon: Icons.settings,
                    iconColor: AppColors.slate500,
                    iconBgColor: AppColors.iconBackground,
                    title: 'App Settings',
                    onTap: () =>
                        AppNavigator.push(context, const AppSettingsScreen()),
                  ),
                ),
                const SizedBox(height: 8),

                FadeUpWidget(
                  delay: 420,
                  child: QuickLinkItem(
                    key: const Key('legalLink'),
                    icon: Icons.gavel_outlined,
                    activeIcon: Icons.gavel,
                    iconColor: const Color(0xFF0F766E),
                    iconBgColor: const Color(0xFFCCFBF1),
                    title: 'Legal',
                    onTap: () =>
                        AppNavigator.push(context, const LegalPageScreen()),
                  ),
                ),

                const SizedBox(height: 24),

                FadeUpWidget(
                  delay: 460,
                  child: ProfileEmergencySosTile(
                    onTap: () =>
                        AppNavigator.push(context, const EmergencySOSScreen()),
                  ),
                ),
                const SizedBox(height: 16),

                FadeUpWidget(
                  delay: 500,
                  child: ProfileLogoutButton(
                    onTap: () => innerRef.read(appProvider).logout(),
                  ),
                ),
                const SizedBox(height: 48),
              ],
            ),
          );
        },
      ),
    );
  }

  PreferredSizeWidget _buildAppBar() {
    return AppBar(
      backgroundColor: AppColors.iconBackground,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      automaticallyImplyLeading: false,
      centerTitle: false,
      titleSpacing: 20,
      title: Text(
        'Menu',
        style: GoogleFonts.plusJakartaSans(
          fontSize: 24,
          fontWeight: FontWeight.w900,
          color: const Color(0xFF1E293B),
          letterSpacing: -0.5,
        ),
      ),
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Internal widgets
// ─────────────────────────────────────────────────────────────────────────────

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel(this.label);

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: const TextStyle(
        fontSize: 12,
        fontWeight: FontWeight.w900,
        color: Color(0xFF475569),
        letterSpacing: 1.2,
      ),
    );
  }
}

/// Compact header showing avatar, name and KYC badge — no redundant detail.
class _CompactRiderHeader extends StatelessWidget {
  final RiderModel? rider;
  const _CompactRiderHeader({this.rider});

  String? _getAvatarUrl() {
    if (rider?.profilePhoto == null || rider!.profilePhoto!.isEmpty)
      return null;
    if (rider!.profilePhoto!.startsWith('http')) return rider!.profilePhoto;
    final baseUrl = ApiClient().baseUrl;
    return '$baseUrl/api/files/${rider!.profilePhoto!.replaceFirst(RegExp(r'^/+'), '')}';
  }

  @override
  Widget build(BuildContext context) {
    final avatarUrl = _getAvatarUrl();
    final String initial = (rider?.name.isNotEmpty ?? false)
        ? rider!.name.substring(0, 1).toUpperCase()
        : '?';
    final String kycStatusName =
        rider?.kycStatus.name.toUpperCase() ?? 'PENDING';
    final bool isVerified =
        kycStatusName == 'VERIFIED' || kycStatusName == 'APPROVED';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      child: Row(
        children: [
          // Avatar
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              color: isVerified ? AppColors.success : const Color(0xFF2563EB),
              shape: BoxShape.circle,
              border: Border.all(color: Colors.white, width: 3),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.08),
                  blurRadius: 12,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            alignment: Alignment.center,
            child: avatarUrl != null
                ? ClipRRect(
                    borderRadius: BorderRadius.circular(28),
                    child: CachedNetworkImage(
                      imageUrl: avatarUrl,
                      width: 56,
                      height: 56,
                      fit: BoxFit.cover,
                      memCacheWidth: 112,
                      memCacheHeight: 112,
                      placeholder: (_, __) => const SizedBox(
                        width: 56,
                        height: 56,
                        child: Center(
                            child: CircularProgressIndicator(strokeWidth: 2)),
                      ),
                      errorWidget: (_, __, ___) => const Icon(Icons.person,
                          size: 28, color: Colors.white),
                    ),
                  )
                : Text(
                    initial,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
          ),
          const SizedBox(width: 16),
          // Name + KYC pill
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  rider?.name ?? 'Rider',
                  style: const TextStyle(
                    fontSize: 17,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B),
                  ),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
                const SizedBox(height: 4),
                Row(
                  children: [
                    Icon(
                      Icons.shield_outlined,
                      size: 12,
                      color: isVerified
                          ? AppColors.success
                          : AppColors.warningDark,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      'KYC: ${kycStatusName == 'SUBMITTED' ? 'Under Review' : _capitalize(kycStatusName.toLowerCase())}',
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: isVerified
                            ? AppColors.success
                            : AppColors.warningDark,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          // Phone chip
          if (rider?.phone != null)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: AppColors.iconBackground,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                rider?.phone ?? '',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.slate500,
                ),
              ),
            ),
        ],
      ),
    );
  }

  String _capitalize(String text) {
    if (text.isEmpty) return text;
    return text.substring(0, 1).toUpperCase() + text.substring(1).toLowerCase();
  }
}
