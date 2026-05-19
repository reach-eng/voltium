import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/rider_model.dart';
import '../providers/app_provider.dart';
import '../utils/app_navigator.dart';
import '../widgets/fade_up_widget.dart';
import 'rewards_screen.dart';
import 'app_settings_screen.dart';
import 'edit_profile_screen.dart';
import 'documents_screen.dart';
import 'referral_screen.dart';
import 'legal_screen.dart';
import 'emergency_sos_screen.dart';

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor:
          const Color(0xFFF1F5F9), // Very light gray-blue background
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
                const Text(
                  'PERSONAL DETAILS',
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
                  const Text(
                    'GUARANTOR DETAILS',
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
                    child: _buildGuarantorCard(rider!),
                  ),
                ],
                const SizedBox(height: 24),
                const Text(
                  'QUICK LINKS',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: Color(0xFF475569), // slate-600
                    letterSpacing: 1.2,
                  ),
                ),
                const SizedBox(height: 12),
                _buildQuickLinks(context),
                const SizedBox(height: 24),
                FadeUpWidget(
                  delay: 700,
                  child: _buildEmergencySOS(context),
                ),
                const SizedBox(height: 24),
                FadeUpWidget(
                  delay: 800,
                  child: _buildLogout(context, provider),
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
      backgroundColor: const Color(0xFFF1F5F9),
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
                    color: Color(0xFF1E293B), size: 20),
              ),
            ),
          ),
        ),
      ),
      title: const Text(
        'Profile',
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
                      ? const Color(0xFF10B981)
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
                        child: Image.network(rider!.profilePhoto!,
                            width: 96,
                            height: 96,
                            fit: BoxFit.cover,
                            cacheWidth: 192,
                            cacheHeight: 192),
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
                        ? const Color(0xFF10B981)
                        : const Color(0xFFF59E0B),
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
              color: const Color(0xFFF1F5F9), // slate-100
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
                      ? const Color(0xFF10B981).withValues(alpha: 0.2)
                      : const Color(0xFFFDE68A)),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.shield_outlined,
                    color: isVerified
                        ? const Color(0xFF10B981)
                        : const Color(0xFFD97706),
                    size: 14),
                const SizedBox(width: 6),
                Text(
                  'KYC: ${_capitalize(kycStatusName)}',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.bold,
                    color: isVerified
                        ? const Color(0xFF10B981)
                        : const Color(0xFFD97706),
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
          _buildDetailRow(
            Icons.person_outline,
            'Name',
            rider?.name ?? 'Not provided',
          ),
          const CustomDivider(),
          _buildDetailRow(
            Icons.email_outlined,
            'Email',
            rider?.email ?? 'Not provided',
          ),
          const CustomDivider(),
          _buildDetailRow(
            Icons.phone_outlined,
            'Phone',
            rider?.phone ?? 'Not provided',
          ),
          const CustomDivider(),
          _buildDetailRow(
            Icons.calendar_today_outlined,
            'Date of Birth',
            dobFormatted,
          ),
          const CustomDivider(),
          _buildDetailRow(
            Icons.person_outline,
            "Father's Name",
            rider?.fatherName ?? 'Not provided',
          ),
          const CustomDivider(),
          _buildDetailRow(
            Icons.person_outline,
            "Mother's Name",
            rider?.motherName ?? 'Not provided',
          ),
          const CustomDivider(),
          _buildDetailRow(
            Icons.home_outlined,
            'Address',
            rider?.currentAddress ?? 'Not provided',
          ),
          const CustomDivider(),
          GestureDetector(
            onTap: () {
              final phone = rider?.emergencyContact;
              if (phone != null && phone.isNotEmpty) {
                launchUrl(Uri.parse('tel:$phone'));
              }
            },
            child: _buildDetailRow(
              Icons.phone_android_outlined,
              'Emergency Contact',
              rider?.emergencyContact ?? 'Not provided',
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String title, String value) {
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: const BoxDecoration(
            color: Color(0xFFF1F5F9), // slate-100
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: const Color(0xFF64748B), size: 20),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: const TextStyle(
                  fontSize: 11,
                  color: Color(0xFF64748B),
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E293B), // slate-800
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildStatusBentos(RiderModel? rider) {
    final String kycStatus = _capitalize(rider?.kycStatus.name ?? 'Pending');
    final String guarantorStatus =
        _capitalize(rider?.guarantorStatus.name ?? 'Pending');

    return Row(
      children: [
        Expanded(
          child: _StatusTile(
            title: 'KYC STATUS',
            status: kycStatus,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: _StatusTile(
            title: 'GUARANTOR',
            status: guarantorStatus,
          ),
        ),
      ],
    );
  }

  Widget _buildGuarantorCard(RiderModel rider) {
    final isApproved = rider.guarantorStatus == GuarantorStatus.VERIFIED;
    return Container(
      padding: const EdgeInsets.all(16),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  shape: BoxShape.circle,
                  border: Border.all(color: Colors.white, width: 2),
                  boxShadow: const [
                    BoxShadow(color: Colors.black12, blurRadius: 4),
                  ],
                ),
                child: (rider.guarantorPhoto != null &&
                        rider.guarantorPhoto!.isNotEmpty)
                    ? ClipOval(
                        child: Image.network(
                          rider.guarantorPhoto!,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                          cacheWidth: 96,
                          cacheHeight: 96,
                          errorBuilder: (_, __, ___) => const Icon(Icons.person,
                              color: Color(0xFF94A3B8), size: 24),
                        ),
                      )
                    : const Icon(Icons.person,
                        color: Color(0xFF94A3B8), size: 24),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rider.guarantorName ?? 'No Name Provided',
                      style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                          color: Color(0xFF1E293B)),
                    ),
                    Text(
                      rider.guarantorPhone ?? 'No Phone Provided',
                      style: const TextStyle(
                          fontSize: 12, color: Color(0xFF64748B)),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isApproved
                      ? const Color(0xFFECFDF5)
                      : const Color(0xFFFFFBEB),
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                      color: isApproved
                          ? const Color(0xFF10B981).withValues(alpha: 0.2)
                          : const Color(0xFFFDE68A)),
                ),
                child: Text(
                  _capitalize(rider.guarantorStatus.name),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: isApproved
                        ? const Color(0xFF10B981)
                        : const Color(0xFFD97706),
                  ),
                ),
              ),
            ],
          ),
          if (rider.guarantorAddress != null &&
              rider.guarantorAddress!.isNotEmpty) ...[
            const SizedBox(height: 12),
            const CustomDivider(),
            const SizedBox(height: 8),
            Row(
              children: [
                const Icon(Icons.home_outlined,
                    color: Color(0xFF64748B), size: 16),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    rider.guarantorAddress!,
                    style:
                        const TextStyle(fontSize: 12, color: Color(0xFF475569)),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildQuickLinks(BuildContext context) {
    return Column(
      children: [
        FadeUpWidget(
          delay: 300,
          child: _QuickLinkItem(
            key: const Key('editProfileLink'),
            icon: Icons.edit_outlined,
            iconColor: const Color(0xFF3B82F6), // blue-500
            iconBgColor: const Color(0xFFEFF6FF), // blue-50
            title: 'Edit Profile',
            onTap: () {
              AppNavigator.push(context, const EditProfileScreen());
            },
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 350,
          child: _QuickLinkItem(
            key: const Key('myDocumentsLink'),
            icon: Icons.contact_page_outlined,
            iconColor: const Color(0xFF10B981), // emerald-500
            iconBgColor: const Color(0xFFECFDF5), // emerald-50
            title: 'My Documents',
            onTap: () {
              AppNavigator.push(context, const MyDocumentsScreen());
            },
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 400,
          child: _QuickLinkItem(
            key: const Key('rewardsLink'),
            icon: Icons.card_giftcard_outlined,
            iconColor: const Color(0xFF8B5CF6), // violet-500
            iconBgColor: const Color(0xFFF5F3FF), // violet-50
            title: 'Rewards',
            onTap: () {
              AppNavigator.push(context, const RewardsScreen());
            },
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 450,
          child: _QuickLinkItem(
            key: const Key('referralLink'),
            icon: Icons.people_outline,
            iconColor: const Color(0xFFF59E0B), // amber-500
            iconBgColor: const Color(0xFFFFFBEB), // amber-50
            title: 'Referral Program',
            onTap: () {
              AppNavigator.push(context, const ReferralScreen());
            },
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 500,
          child: _QuickLinkItem(
            key: const Key('appSettingsLink'),
            icon: Icons.settings_outlined,
            iconColor: const Color(0xFF64748B), // slate-500
            iconBgColor: const Color(0xFFF1F5F9), // slate-100
            title: 'App settings',
            onTap: () {
              AppNavigator.push(context, const AppSettingsScreen());
            },
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 600,
          child: _QuickLinkItem(
            key: const Key('legalLink'),
            icon: Icons.gavel_outlined,
            iconColor: const Color(0xFF0F766E), // teal-700
            iconBgColor: const Color(0xFFCCFBF1), // teal-50
            title: 'Legal',
            onTap: () {
              AppNavigator.push(context, const LegalScreen());
            },
          ),
        ),
      ],
    );
  }

  Widget _buildEmergencySOS(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2), // red-50
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFFECACA)), // red-200
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          key: const Key('emergencySosLink'),
          borderRadius: BorderRadius.circular(24),
          onTap: () {
            AppNavigator.push(context, const EmergencySOSScreen());
          },
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFEE2E2), // red-100
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.emergency_outlined,
                      color: Color(0xFFDC2626), size: 22),
                ),
                const SizedBox(width: 16),
                const Expanded(
                  child: Text(
                    'Emergency SOS',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFFDC2626), // red-600
                    ),
                  ),
                ),
                const Icon(Icons.chevron_right,
                    color: Color(0xFFEF4444)), // red-500
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildLogout(BuildContext context, AppProvider provider) {
    return ElevatedButton(
      key: const Key('logoutButton'),
      onPressed: () {
        provider.logout();
      },
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.transparent,
        foregroundColor: const Color(0xFFDC2626),
        elevation: 0,
        side: const BorderSide(color: Color(0xFFFECACA), width: 1.5),
        minimumSize: const Size(double.infinity, 54),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(9999),
        ),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.logout, size: 20),
          SizedBox(width: 8),
          Text(
            'Logout',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
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

class _StatusTile extends StatelessWidget {
  final String title;
  final String status;

  const _StatusTile({
    required this.title,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    final bool isApproved = status.toUpperCase() == 'APPROVED' ||
        status.toUpperCase() == 'VERIFIED';
    final Color dotColor =
        isApproved ? const Color(0xFF10B981) : const Color(0xFFDC2626);

    return Container(
      padding: const EdgeInsets.all(16),
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: dotColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 8),
              Text(
                title,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF64748B),
                  letterSpacing: 0.8,
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            status,
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.bold,
              color: dotColor,
            ),
          ),
        ],
      ),
    );
  }
}

class _QuickLinkItem extends StatelessWidget {
  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final String title;
  final VoidCallback onTap;

  const _QuickLinkItem({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    required this.title,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
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
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(24),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: iconBgColor,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(icon, color: iconColor, size: 22),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    title,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B),
                    ),
                  ),
                ),
                const Icon(
                  Icons.chevron_right,
                  color: Color(0xFFCBD5E1), // slate-300
                  size: 20,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class CustomDivider extends StatelessWidget {
  const CustomDivider({super.key});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 12),
      height: 1,
      color: const Color(0xFFF1F5F9), // slate-100
    );
  }
}
