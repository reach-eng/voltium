import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/intent_of_use_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/user_onboarding_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/signature_pad_screen.dart';
import 'package:voltium_rider/features/kyc/presentation/screens/documents_screen.dart';
import 'package:voltium_rider/features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/top_up_flow.dart';
import 'package:voltium_rider/features/wallet/presentation/screens/history_screen.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/choose_plan_screen.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/rental_details_screen.dart';
import 'package:voltium_rider/features/rentals/presentation/screens/end_rental_screen.dart';
import 'package:voltium_rider/features/pickup/presentation/screens/pickup_hub_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_checklist_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/faq_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/troubleshooter_screen.dart';
import 'package:voltium_rider/features/support/presentation/screens/feedback_screen.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notification_center_screen.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/notification_preferences_screen.dart';
import 'package:voltium_rider/features/notifications/presentation/screens/smart_notifications_screen.dart';
import 'package:voltium_rider/features/profile/presentation/screens/edit_profile_screen.dart';
import 'package:voltium_rider/features/profile/presentation/screens/app_settings_screen.dart';
import 'package:voltium_rider/features/profile/presentation/screens/legal_page_screen.dart';
import 'package:voltium_rider/features/referrals/presentation/screens/referral_screen.dart';
import 'package:voltium_rider/features/rewards/presentation/screens/rewards_screen.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_sos_screen.dart';
import 'package:voltium_rider/features/device_compliance/presentation/screens/emergency_contacts_screen.dart';
import '../../../../theme/app_theme.dart';

class RiderWorkflowHubScreen extends StatelessWidget {
  const RiderWorkflowHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final rider = context.watch<AppProvider>().rider;
    final riderId = rider?.id ?? rider?.riderId ?? 'local';

    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      appBar: AppBar(
        title: const Text('Workflow & Services'),
        backgroundColor: AppColors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
        children: [
          _Section(
            title: 'Onboarding & verification',
            children: [
              _Tile('Intent of use', Icons.assignment_outlined,
                  () => AppNavigator.push(context, const IntentOfUseScreen()),),
              _Tile(
                  'Rider profile',
                  Icons.person_add_alt,
                  () =>
                      AppNavigator.push(context, const UserOnboardingScreen()),),
              _Tile('Signature / consent', Icons.draw_outlined,
                  () => AppNavigator.push(context, const SignaturePadScreen()),),
              _Tile('My documents', Icons.folder_copy_outlined,
                  () => AppNavigator.push(context, const MyDocumentsScreen()),),
              _Tile(
                  'Guarantor details',
                  Icons.verified_user_outlined,
                  () => AppNavigator.push(
                      context, const GuarantorOnboardingScreen(),),),
            ],
          ),
          _Section(
            title: 'Plan, wallet & deposit',
            children: [
              _Tile(
                  'Choose plan',
                  Icons.electric_bolt_outlined,
                  () => AppNavigator.push(
                      context,
                      ChoosePlanScreen(
                          onNext: () => Navigator.maybePop(context),),),),
              _Tile(
                  'Top-up / deposit flow',
                  Icons.account_balance_wallet_outlined,
                  () => AppNavigator.push(context, const TopUpFlow()),),
              _Tile(
                  'Transaction history',
                  Icons.history,
                  () => AppNavigator.push(
                      context, HistoryScreen(riderId: riderId),),),
              _Tile('Rewards', Icons.card_giftcard_outlined,
                  () => AppNavigator.push(context, const RewardsScreen()),),
              _Tile('Referrals', Icons.people_alt_outlined,
                  () => AppNavigator.push(context, const ReferralScreen()),),
            ],
          ),
          _Section(
            title: 'Pickup, rental & return',
            children: [
              _Tile(
                  'Pickup hub and vehicle',
                  Icons.store_mall_directory_outlined,
                  () => AppNavigator.push(
                      context,
                      PickupHubScreen(
                          onNext: (_, __, ___, ____, _____, ______, _______,
                              ________, _________,) {},),),),
              _Tile(
                  'Rental details',
                  Icons.description_outlined,
                  () =>
                      AppNavigator.push(context, const RentalDetailsScreen()),),
              _Tile('End rental / return', Icons.assignment_return_outlined,
                  () => AppNavigator.push(context, const EndRentalScreen()),),
            ],
          ),
          _Section(
            title: 'Support & communication',
            children: [
              _Tile(
                  'Support center',
                  Icons.support_agent,
                  () =>
                      AppNavigator.push(context, const SupportCenterScreen()),),
              _Tile(
                  'Support checklist',
                  Icons.checklist_outlined,
                  () => AppNavigator.push(
                      context, const SupportChecklistScreen(),),),
              _Tile('FAQ', Icons.help_outline,
                  () => AppNavigator.push(context, const FaqScreen()),),
              _Tile(
                  'Troubleshooter',
                  Icons.build_circle_outlined,
                  () =>
                      AppNavigator.push(context, const TroubleshooterScreen()),),
              _Tile(
                  'Feedback',
                  Icons.rate_review_outlined,
                  () => AppNavigator.push(
                      context,
                      FeedbackScreen(
                          onSubmit: () => Navigator.maybePop(context),),),),
              _Tile(
                  'Notifications',
                  Icons.notifications_outlined,
                  () => AppNavigator.push(
                      context, const NotificationCenterScreen(),),),
              _Tile(
                  'Smart notifications',
                  Icons.tips_and_updates_outlined,
                  () => AppNavigator.push(
                      context, const SmartNotificationsScreen(),),),
              _Tile(
                  'Notification preferences',
                  Icons.tune_outlined,
                  () => AppNavigator.push(
                      context, const NotificationPreferencesScreen(),),),
            ],
          ),
          _Section(
            title: 'Profile, legal & safety',
            children: [
              _Tile('Edit profile', Icons.edit_outlined,
                  () => AppNavigator.push(context, const EditProfileScreen()),),
              _Tile('App settings', Icons.settings_outlined,
                  () => AppNavigator.push(context, const AppSettingsScreen()),),
              _Tile('Legal documents', Icons.gavel_outlined,
                  () => AppNavigator.push(context, const LegalPageScreen()),),
              _Tile('Emergency SOS', Icons.sos_outlined,
                  () => AppNavigator.push(context, const EmergencySOSScreen()),),
              _Tile(
                  'Emergency contacts',
                  Icons.contact_phone_outlined,
                  () => AppNavigator.push(
                      context, const EmergencyContactsScreen(),),),
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
    return Container(
      margin: const EdgeInsets.only(bottom: 18),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
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
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.w900,
              color: Color(0xFF475569),
              letterSpacing: 0.8,
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
  final VoidCallback onTap;

  const _Tile(this.title, this.icon, this.onTap);

  @override
  Widget build(BuildContext context) {
    return Material(
      color: const Color(0xFFF8FAFC),
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 13),
          child: Row(
            children: [
              Icon(icon, color: AppColors.primary, size: 22),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  title,
                  style: const TextStyle(
                      fontWeight: FontWeight.w800, color: Color(0xFF1E293B),),
                ),
              ),
              const Icon(Icons.chevron_right, color: AppColors.slate400),
            ],
          ),
        ),
      ),
    );
  }
}
