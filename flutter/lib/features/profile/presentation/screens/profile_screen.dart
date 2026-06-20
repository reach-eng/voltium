import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'rewards_screen.dart';
import 'app_settings_screen.dart';
import 'edit_profile_screen.dart';
import 'documents_screen.dart';
import 'referral_screen.dart';
import 'legal_page_screen.dart';
import 'emergency_sos_screen.dart';
import 'package:voltium_rider/features/workflows/presentation/screens/rider_workflow_hub_screen.dart';
import '../widgets/profile_widgets.dart';
import '../../../../theme/app_theme.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor:
          AppColors.iconBackground, // Very light gray-blue background
      appBar: _buildAppBar(context),
      body: Consumer<AppProvider>(
        builder: (context, provider, _) {
          final rider = provider.rider;
          return SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                FadeUpWidget(
                  delay: 0,
                  child: _buildProfileCard(context, rider),
                ),
                const SizedBox(height: 24),
                const Text('Personal Details',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF475569), // slate-600
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 12),
                FadeUpWidget(
                  delay: 100,
                  child: _buildPersonalDetailsCard(rider),
                ),
                const SizedBox(height: 16),
                FadeUpWidget(
                  delay: 200,
                  child: _buildStatusBentos(rider),
                ),
                if (rider?.guarantorName != null) ...[
                  const SizedBox(height: 24),
                  const Text('Guarantor Details',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w900,
                      color: Color(0xFF475569),
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(height: 12),
                  FadeUpWidget(
                    delay: 250,
                    child: ProfileGuarantorCard(rider: rider!),
                  ),
                ],
                const SizedBox(height: 24),
                const Text('QUICK LINKS',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF475569), // slate-600
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 12),
                ProfileQuickLinks(
                  onEditProfileTap: () {
                    AppNavigator.push(context, const EditProfileScreen());
                  },
                  onMyDocumentsTap: () {
                    AppNavigator.push(context, const MyDocumentsScreen());
                  },
                  onRewardsTap: () {
                    AppNavigator.push(context, const RewardsScreen());
                  },
                  onReferralTap: () {
                    AppNavigator.push(context, const ReferralScreen());
                  },
                  onAppSettingsTap: () {
                    AppNavigator.push(context, const AppSettingsScreen());
                  },
                  onLegalTap: () {
                    AppNavigator.push(context, const LegalPageScreen());
                  },
                  onWorkflowHubTap: () {
                    AppNavigator.push(context, const RiderWorkflowHubScreen());
                  },
                ),
                const SizedBox(height: 24),
                FadeUpWidget(
                  delay: 700,
                  child: ProfileEmergencySosTile(
                    onTap: () {
                      AppNavigator.push(context, const EmergencySOSScreen());
                    },
                  ),
                ),
                const SizedBox(height: 24),
                FadeUpWidget(
                  delay: 800,
                  child: ProfileLogoutButton(
                    onTap: () {
                      provider.logout();
                    },
                  ),
                ),
                const SizedBox(height: 48), // Bottom padding
              ],
            ),
          );
        },
      ),
    );
  }

  PreferredSizeWidget _buildAppBar(BuildContext context) {
    return AppBar(
      backgroundColor: AppColors.iconBackground,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      leadingWidth: 68,
      leading: Padding(
        padding: const EdgeInsets.only(left: 20.0),
        child: UnconstrainedBox(
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
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                borderRadius: BorderRadius.circular(9999),
                onTap: () {
                  if (Navigator.canPop(context)) {
                    Navigator.pop(context);
                  }
                },
                child: const Icon(Icons.arrow_back,
                    color: Color(0xFF1E293B), size: 20,),
              ),
            ),
          ),
        ),
      ),
      title: const Text('Profile',
        style: TextStyle(
          fontSize: 22,
          fontWeight: FontWeight.bold,
          color: Color(0xFF1E293B),
        ),
      ),
    );
  }

  Widget _buildProfileCard(BuildContext context, RiderModel? rider) {
    final String initial = (rider?.name.isNotEmpty ?? false)
        ? rider!.name.substring(0, 1).toUpperCase()
        : '?';
    final String riderId = rider?.riderId ?? 'NOT-ASSIGNED';
    final String kycStatusName = rider?.kycStatus.name ?? 'PENDING';
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
      padding: const EdgeInsets.symmetric(vertical: 32, horizontal: 16),
      child: Column(
        children: [
          Stack(
            clipBehavior: Clip.none,
            children: [
              Container(
                width: 96,
                height: 96,
                decoration: BoxDecoration(
                  color: isVerified
                      ? AppColors.success
                      : const Color(0xFF2563EB),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 4),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withValues(alpha: 0.1),
                      blurRadius: 20,
                      offset: const Offset(0, 8),
                    ),
                  ],
                ),
                alignment: Alignment.center,
                child: (rider?.profilePhoto != null &&
                        rider!.profilePhoto!.isNotEmpty)
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(48),
                        child: CachedNetworkImage(
                            imageUrl: rider.profilePhoto!,
                            width: 96,
                            height: 96,
                            fit: BoxFit.cover,
                            placeholder: (_, __) => const SizedBox(
                              width: 96,
                              height: 96,
                              child: Center(child: CircularProgressIndicator(strokeWidth: 2)),
                            ),
                            errorWidget: (_, __, ___) => const Icon(Icons.person, size: 48),),
                      )
                    : Text(
                        initial,
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 40,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
              ),
              Positioned(
                bottom: 2,
                right: 4,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: isVerified
                        ? AppColors.success
                        : AppColors.warning,
                    shape: BoxShape.circle,
                    border: Border.all(color: Colors.white, width: 3),
                  ),
                  child: Icon(
                    isVerified ? Icons.check : Icons.access_time_filled,
                    color: Colors.white,
                    size: 14,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Text(
            rider?.name ?? 'Test Rider',
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.iconBackground, // slate-100
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              riderId,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.bold,
                fontFamily: 'monospace',
                color: Color(0xFF475569),
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: isVerified
                  ? const Color(0xFFECFDF5)
                  : const Color(0xFFFFFBEB),
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                  color: isVerified
                      ? AppColors.success.withValues(alpha: 0.2)
                      : const Color(0xFFFDE68A),),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shield_outlined,
                    color: isVerified
                        ? AppColors.success
                        : AppColors.warningDark,
                    size: 14,),
                const SizedBox(width: 6),
                Text(
                  'KYC: ${_capitalize(kycStatusName)}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isVerified
                        ? AppColors.success
                        : AppColors.warningDark,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPersonalDetailsCard(RiderModel? rider) {
    String dobFormatted = 'Not provided';
    if (rider?.dob != null) {
      dobFormatted = DateFormat('dd MMM yyyy').format(rider!.dob!);
    }

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
      padding: const EdgeInsets.all(16),
      child: Column(
        children: [
          ProfileDetailRow(
            icon: Icons.person_outline,
            title: 'Name',
            value: rider?.name ?? 'Not provided',
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.email_outlined,
            title: 'Email',
            value: rider?.email ?? 'Not provided',
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.phone_outlined,
            title: 'Phone',
            value: rider?.phone ?? 'Not provided',
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.calendar_today_outlined,
            title: 'Date of Birth',
            value: dobFormatted,
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.person_outline,
            title: "Father's Name",
            value: rider?.fatherName ?? 'Not provided',
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.person_outline,
            title: "Mother's Name",
            value: rider?.motherName ?? 'Not provided',
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.home_outlined,
            title: 'Address',
            value: rider?.currentAddress ?? 'Not provided',
          ),
          const CustomDivider(),
          GestureDetector(
            onTap: () {
              final phone = rider?.emergencyContact;
              if (phone != null && phone.isNotEmpty) {
                launchUrl(Uri.parse('tel:$phone'));
              }
            },
            child: ProfileDetailRow(
              icon: Icons.phone_android_outlined,
              title: 'Emergency Contact',
              value: rider?.emergencyContact ?? 'Not provided',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBentos(RiderModel? rider) {
    final String kycStatus = _capitalize(rider?.kycStatus.name ?? 'Pending');
    final String guarantorStatus =
        _capitalize(rider?.guarantorStatus.name ?? 'Pending');

    return Row(
      children: [
        Expanded(
          child: StatusTile(
            title: 'KYC STATUS',
            status: kycStatus,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatusTile(
            title: 'GUARANTOR',
            status: guarantorStatus,
          ),
        ),
      ],
    );
  }

  String _capitalize(String text) {
    if (text.isEmpty) return text;
    return text.substring(0, 1).toUpperCase() + text.substring(1).toLowerCase();
  }
}
