import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_contacts_screen.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_sos_screen.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/documents_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/intent_of_use_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/signature_pad_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notifications_screen.dart';
import 'package:voltium_rider/features/onboarding/presentation/screens/legal_page_screen.dart';
import 'package:voltium_rider/features/profile/presentation/screens/edit_profile_screen.dart';
import 'package:voltium_rider/features/referrals/presentation/screens/referral_screen.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/choose_plan_screen.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/end_rental_screen.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/rental_details_screen.dart';
import 'package:voltium_rider/features/rewards/presentation/screens/rewards_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/faq_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_checklist_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/troubleshooter_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/history_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_flow.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_navigator.dart';

class RiderWorkflowHubScreen extends ConsumerWidget {
  const RiderWorkflowHubScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final riderId = ref.read(riderProvider).riderId ?? 'local';
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        title: Text(l10n?.menu_workflowServices ?? 'Workflow & Services'),
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          _Section(
            title: 'Onboarding & verification',
            children: [
              _Tile(
                title: l10n?.txtintentOfUse ?? 'Intent of use',
                icon: Icons.assignment_outlined,
                iconColor: AppColors.primary,
                onTap: () =>
                    AppNavigator.push(context, const IntentOfUseScreen()),
              ),
              _Tile(
                title: 'Rider profile',
                icon: Icons.person_add_alt,
                iconColor: AppColors.info,
                onTap: () =>
                    AppNavigator.push(context, const UserOnboardingScreen()),
              ),
              _Tile(
                title: 'Signature / consent',
                icon: Icons.draw_outlined,
                iconColor: AppColors.accentPurple,
                onTap: () =>
                    AppNavigator.push(context, const SignaturePadScreen()),
              ),
              _Tile(
                title: l10n?.menu_myDocuments ?? 'My documents',
                icon: Icons.folder_copy_outlined,
                iconColor: AppColors.success,
                onTap: () =>
                    AppNavigator.push(context, const MyDocumentsScreen()),
              ),
              _Tile(
                title: 'Guarantor details',
                icon: Icons.verified_user_outlined,
                iconColor: AppColors.primary,
                onTap: () => AppNavigator.push(
                  context,
                  GuarantorOnboardingScreen(
                    onNext: () => Navigator.maybePop(context),
                  ),
                ),
              ),
            ],
          ),
          _Section(
            title: 'Plan, wallet & deposit',
            children: [
              _Tile(
                title: 'Choose plan',
                icon: Icons.electric_bolt_outlined,
                iconColor: AppColors.warning,
                onTap: () => AppNavigator.push(
                  context,
                  ChoosePlanScreen(
                    onNext: () => Navigator.maybePop(context),
                  ),
                ),
              ),
              _Tile(
                title: 'Top-up / deposit flow',
                icon: Icons.account_balance_wallet_outlined,
                iconColor: AppColors.primary,
                onTap: () => AppNavigator.push(context, const TopUpFlow()),
              ),
              _Tile(
                title: 'Transaction history',
                icon: Icons.history,
                iconColor: AppColors.info,
                onTap: () => AppNavigator.push(
                  context,
                  HistoryScreen(riderId: riderId),
                ),
              ),
              _Tile(
                title: l10n?.menu_rewards ?? 'Rewards',
                icon: Icons.card_giftcard_outlined,
                iconColor: AppColors.accentPurple,
                onTap: () => AppNavigator.push(context, const RewardsScreen()),
              ),
              _Tile(
                title: l10n?.menu_referralProgram ?? 'Referrals',
                icon: Icons.people_alt_outlined,
                iconColor: AppColors.warning,
                onTap: () => AppNavigator.push(context, const ReferralScreen()),
              ),
            ],
          ),
          _Section(
            title: 'Pickup, rental & return',
            children: [
              _Tile(
                title: 'Rental details',
                icon: Icons.description_outlined,
                iconColor: AppColors.info,
                onTap: () =>
                    AppNavigator.push(context, const RentalDetailsScreen()),
              ),
              _Tile(
                title: 'End rental / return',
                icon: Icons.assignment_return_outlined,
                iconColor: AppColors.error,
                onTap: () =>
                    AppNavigator.push(context, const EndRentalScreen()),
              ),
            ],
          ),
          _Section(
            title: 'Support & communication',
            children: [
              _Tile(
                title: 'Support center',
                icon: Icons.support_agent,
                iconColor: AppColors.primary,
                onTap: () =>
                    AppNavigator.push(context, const SupportCenterScreen()),
              ),
              _Tile(
                title: 'Support checklist',
                icon: Icons.checklist_outlined,
                iconColor: AppColors.info,
                onTap: () => AppNavigator.push(
                  context,
                  const SupportChecklistScreen(),
                ),
              ),
              _Tile(
                title: 'FAQ',
                icon: Icons.help_outline,
                iconColor: AppColors.accentPurple,
                onTap: () => AppNavigator.push(context, const FaqScreen()),
              ),
              _Tile(
                title: 'Troubleshooter',
                icon: Icons.build_circle_outlined,
                iconColor: AppColors.warning,
                onTap: () =>
                    AppNavigator.push(context, const TroubleshooterScreen()),
              ),
              _Tile(
                title: l10n?.settings_feedback ?? 'Feedback',
                icon: Icons.rate_review_outlined,
                iconColor: AppColors.accentPurple,
                onTap: () => AppNavigator.push(
                  context,
                  FeedbackScreen(
                    onSubmit: () => Navigator.maybePop(context),
                  ),
                ),
              ),
              _Tile(
                title: l10n?.settings_notifications ?? 'Notifications',
                icon: Icons.notifications_outlined,
                iconColor: AppColors.primary,
                onTap: () => AppNavigator.push(
                  context,
                  const NotificationsScreen(),
                ),
              ),
            ],
          ),
          _Section(
            title: 'Profile, legal & safety',
            children: [
              _Tile(
                title: l10n?.txteditProfile ?? 'Edit profile',
                icon: Icons.edit_outlined,
                iconColor: AppColors.info,
                onTap: () =>
                    AppNavigator.push(context, const EditProfileScreen()),
              ),
              _Tile(
                title: l10n?.settings_legal ?? 'Legal documents',
                icon: Icons.gavel_outlined,
                iconColor: AppColors.successDark,
                onTap: () =>
                    AppNavigator.push(context, const LegalPageScreen()),
              ),
              _Tile(
                title: l10n?.menu_emergencySos ?? 'Emergency SOS',
                icon: Icons.sos_outlined,
                iconColor: AppColors.error,
                onTap: () =>
                    AppNavigator.push(context, const EmergencySOSScreen()),
              ),
              _Tile(
                title: 'Emergency contacts',
                icon: Icons.contact_phone_outlined,
                iconColor: AppColors.warning,
                onTap: () => AppNavigator.push(
                  context,
                  const EmergencyContactsScreen(),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _Section extends StatelessWidget {
  final String title;
  final List<_Tile> children;

  const _Section({required this.title, required this.children});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(color: colors.outlineVariant),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 14,
            offset: const Offset(0, 6),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTypography.bodySmall.copyWith(
              fontWeight: FontWeight.w800,
              letterSpacing: 0.8,
              color: colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 12),
          ...children
              .expand((tile) => [tile, const SizedBox(height: 8)])
              .toList()
            ..removeLast(),
        ],
      ),
    );
  }
}

class _Tile extends StatelessWidget {
  final String title;
  final IconData icon;
  final Color iconColor;
  final VoidCallback onTap;

  const _Tile({
    required this.title,
    required this.icon,
    this.iconColor = AppColors.primary,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: colors.surface,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadius.md),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          child: Row(
            children: [
              Icon(icon, color: iconColor, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.w800,
                    color: colors.onSurface,
                  ),
                ),
              ),
              Icon(Icons.chevron_right, color: colors.onSurfaceMuted),
            ],
          ),
        ),
      ),
    );
  }
}
