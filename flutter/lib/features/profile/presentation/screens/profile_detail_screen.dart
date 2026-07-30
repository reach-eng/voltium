import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import '../widgets/profile_widgets.dart';
import '../../../../theme/app_theme.dart';
import 'edit_profile_screen.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Shows the rider's full profile details:
/// avatar card, personal details, KYC/Guarantor status, guarantor card,
/// and an Edit Profile entry.
class ProfileDetailScreen extends ConsumerWidget {
  const ProfileDetailScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rider = ref.watch(riderProvider.select((p) => p.rider));

    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      appBar: _buildAppBar(context),
      body: SingleChildScrollView(
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            FadeUpWidget(
              delay: 0,
              child: _buildProfileCard(context, rider),
            ),
            const SizedBox(height: 20),
            // Edit Profile quick-action button
            FadeUpWidget(
              delay: 80,
              child: _EditProfileTile(
                onTap: () =>
                    AppNavigator.push(context, const EditProfileScreen()),
              ),
            ),
            const SizedBox(height: 24),
            const _SectionLabel('PERSONAL DETAILS'),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 150,
              child: _buildPersonalDetailsCard(rider),
            ),
            const SizedBox(height: 16),
            FadeUpWidget(
              delay: 220,
              child: _buildStatusBentos(rider),
            ),
            if (rider?.guarantorName != null) ...[
              const SizedBox(height: 24),
              const _SectionLabel('GUARANTOR DETAILS'),
              const SizedBox(height: 12),
              FadeUpWidget(
                delay: 280,
                child: ProfileGuarantorCard(rider: rider!),
              ),
            ],
            const SizedBox(height: 48),
          ],
        ),
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
            width: 44,
            height: 44,
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
                borderRadius: BorderRadius.circular(AppRadius.full),
                onTap: () {
                  if (Navigator.canPop(context)) Navigator.pop(context);
                },
                child: const Icon(
                  Icons.arrow_back,
                  color: AppColors.slate800,
                  size: 20,
                ),
              ),
            ),
          ),
        ),
      ),
      title: Text(
        'Profile',
        style: AppTypography.headingSmall.copyWith(color: AppColors.slate800),
      ),
    );
  }

  Widget _buildProfileCard(BuildContext context, RiderModel? rider) {
    String? getAvatarUrl() {
      if (rider?.profilePhoto == null || rider!.profilePhoto!.isEmpty)
        return null;
      if (rider.profilePhoto!.startsWith('http')) return rider.profilePhoto;
      final baseUrl = ApiClient().baseUrl;
      return '$baseUrl/api/files/${rider.profilePhoto!.replaceFirst(RegExp(r'^/+'), '')}';
    }

    final avatarUrl = getAvatarUrl();
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
        borderRadius: BorderRadius.circular(AppRadius.xl),
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
                  color: isVerified ? AppColors.success : AppColors.primary,
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
                child: avatarUrl != null
                    ? ClipRRect(
                        borderRadius: BorderRadius.circular(48),
                        child: CachedNetworkImage(
                          imageUrl: avatarUrl,
                          width: 96,
                          height: 96,
                          fit: BoxFit.cover,
                          memCacheWidth: 192,
                          memCacheHeight: 192,
                          placeholder: (_, __) => const SizedBox(
                            width: 96,
                            height: 96,
                            child: Center(
                                child:
                                    CircularProgressIndicator(strokeWidth: 2)),
                          ),
                          errorWidget: (_, __, ___) =>
                              const Icon(Icons.person, size: 48),
                        ),
                      )
                    : Text(
                        initial,
                        style: AppTypography.displayLarge
                            .copyWith(color: Colors.white),
                      ),
              ),
              Positioned(
                bottom: 2,
                right: 4,
                child: Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: isVerified ? AppColors.success : AppColors.warning,
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
          SizedBox(height: 16),
          Text(
            rider?.name ?? 'Test Rider',
            style: AppTypography.titleLarge.copyWith(color: AppColors.slate800),
          ),
          SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: isVerified
                  ? AppColors.successSurfaceAlt
                  : AppColors.warningSurface,
              borderRadius: BorderRadius.circular(AppRadius.xl),
              border: Border.all(
                color: isVerified
                    ? AppColors.success.withValues(alpha: 0.2)
                    : AppColors.warningBorder,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(
                  Icons.shield_outlined,
                  color: isVerified ? AppColors.success : AppColors.warningDark,
                  size: 14,
                ),
                SizedBox(width: 6),
                Text(
                  'KYC: ${kycStatusName == 'SUBMITTED' ? 'Under Review' : _capitalize(kycStatusName.toLowerCase())}',
                  style: AppTypography.bodyMedium
                      .copyWith(fontSize: 13, fontWeight: FontWeight.w700)
                      .copyWith(
                          color: isVerified
                              ? AppColors.success
                              : AppColors.warningDark),
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
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.02),
            blurRadius: 10,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      padding: Spacing.paddingMd,
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
          if (rider?.assignedVehicle != null &&
              rider!.assignedVehicle!.isNotEmpty &&
              rider.assignedVehicle != 'Not Assigned') ...[
            const CustomDivider(),
            ProfileDetailRow(
              icon: Icons.directions_car_outlined,
              title: 'Vehicle',
              value: [
                rider.assignedVehicle,
                if (rider.vehicleModel != null &&
                    rider.vehicleModel!.isNotEmpty)
                  rider.vehicleModel,
              ].where((e) => e != null && e.isNotEmpty).join(' · '),
            ),
          ],
          if (rider?.teamLeader != null &&
              rider!.teamLeader!.isNotEmpty &&
              rider.teamLeader != 'Not Assigned') ...[
            const CustomDivider(),
            ProfileDetailRow(
              icon: Icons.supervisor_account_outlined,
              title: 'Team Leader',
              value: rider.teamLeader!,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatusBentos(RiderModel? rider) {
    final rawStatus = rider?.kycStatus.name ?? 'Pending';
    final String kycStatus =
        rawStatus == 'submitted' ? 'Under Review' : _capitalize(rawStatus);
    final String guarantorStatus =
        _capitalize(rider?.guarantorStatus.name ?? 'Pending');

    return Row(
      children: [
        Expanded(
          child: StatusTile(title: 'KYC STATUS', status: kycStatus),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatusTile(title: 'GUARANTOR', status: guarantorStatus),
        ),
      ],
    );
  }

  String _capitalize(String text) {
    if (text.isEmpty) return text;
    return text.substring(0, 1).toUpperCase() + text.substring(1).toLowerCase();
  }
}

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel(this.label);

  @override
  Widget build(BuildContext context) {
    return Text(
      label,
      style: AppTypography.bodySmall
          .copyWith(fontWeight: FontWeight.w800, letterSpacing: 1.2)
          .copyWith(color: AppColors.slate600, letterSpacing: 1.2),
    );
  }
}

class _EditProfileTile extends StatelessWidget {
  final VoidCallback onTap;
  const _EditProfileTile({required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.xl),
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
          key: const Key('editProfileLink'),
          borderRadius: BorderRadius.circular(AppRadius.xl),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: const BoxDecoration(
                    color: AppColors.primarySurface,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.edit_outlined,
                      color: AppColors.info, size: 22),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: Text(
                    'Edit Profile',
                    style: AppTypography.labelLarge
                        .copyWith(fontWeight: FontWeight.w700)
                        .copyWith(color: AppColors.slate800),
                  ),
                ),
                const Icon(Icons.chevron_right,
                    color: AppColors.borderMedium, size: 20),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
