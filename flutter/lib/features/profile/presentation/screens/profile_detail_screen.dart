import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import '../widgets/profile_widgets.dart';
import '../../../../theme/app_theme.dart';
import 'edit_profile_screen.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

/// Shows the rider's full profile details:
/// avatar card, personal details, KYC/Guarantor status, guarantor card,
/// and an Edit Profile entry.
class ProfileDetailScreen extends ConsumerStatefulWidget {
  const ProfileDetailScreen({super.key});

  @override
  ConsumerState<ProfileDetailScreen> createState() =>
      _ProfileDetailScreenState();
}

class _ProfileDetailScreenState extends ConsumerState<ProfileDetailScreen> {
  @override
  void initState() {
    super.initState();
    PostHogService.screen('profile_detail_screen');
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final rider = ref.watch(riderProvider.select((p) => p.rider));

    return Scaffold(
      backgroundColor: colors.surface,
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
                onTap: () {
                  HapticService.light();
                  AppNavigator.push(context, const EditProfileScreen());
                },
              ),
            ),
            const SizedBox(height: 24),
            _SectionLabel(l10n?.txtpersonalDetails ?? 'PERSONAL DETAILS'),
            const SizedBox(height: 12),
            FadeUpWidget(
              delay: 150,
              child: _buildPersonalDetailsCard(context, rider),
            ),
            const SizedBox(height: 16),
            FadeUpWidget(
              delay: 220,
              child: _buildStatusBentos(context, rider),
            ),
            if (rider?.guarantorName != null) ...[
              const SizedBox(height: 24),
              _SectionLabel(l10n?.txtguarantorDetails ?? 'GUARANTOR DETAILS'),
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
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return AppBar(
      backgroundColor: colors.surface,
      surfaceTintColor: Colors.transparent,
      elevation: 0,
      leading: IconButton(
        icon: Icon(Icons.arrow_back, color: colors.onSurface, size: 20),
        tooltip: l10n?.txtback ?? 'Back',
        onPressed: () {
          HapticService.light();
          Navigator.maybePop(context);
        },
      ),
      title: Text(
        l10n?.txtprofile ?? 'Profile',
        style: AppTypography.headingSmall.copyWith(color: colors.onSurface),
      ),
    );
  }

  Widget _buildProfileCard(BuildContext context, RiderModel? rider) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    String? getAvatarUrl() {
      if (rider?.profilePhoto == null || rider!.profilePhoto!.isEmpty) {
        return null;
      }
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
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(
          color: colors.outlineVariant.withValues(alpha: 0.5),
        ),
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
                  border: Border.all(color: colors.card, width: 3),
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
                    border: Border.all(color: colors.card, width: 2),
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
            rider?.name ?? (l10n?.txtguestRider ?? 'Rider'),
            style: AppTypography.titleLarge.copyWith(color: colors.onSurface),
          ),
          const SizedBox(height: 8),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: isVerified ? colors.successSurface : colors.warningSurface,
              borderRadius: BorderRadius.circular(AppRadius.radiusModal),
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
                const SizedBox(width: 6),
                Text(
                  'KYC: ${kycStatusName == 'SUBMITTED' ? (l10n?.txtunderReview ?? 'Under Review') : _capitalize(kycStatusName.toLowerCase())}',
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

  Widget _buildPersonalDetailsCard(BuildContext context, RiderModel? rider) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final notProvided = l10n?.txtnotProvided ?? 'Not provided';
    String dobFormatted = notProvided;
    if (rider?.dob != null) {
      dobFormatted = DateFormat('dd MMM yyyy').format(rider!.dob!);
    }

    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(
          color: colors.outlineVariant.withValues(alpha: 0.5),
        ),
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
            title: l10n?.txtfullName ?? 'Name',
            value: rider?.name ?? notProvided,
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.email_outlined,
            title: l10n?.txtemailAddress ?? 'Email',
            value: rider?.email ?? notProvided,
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.phone_outlined,
            title: l10n?.txtphone ?? 'Phone',
            value: rider?.phone ?? notProvided,
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.calendar_today_outlined,
            title: l10n?.txtdateOfBirth ?? 'Date of Birth',
            value: dobFormatted,
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.person_outline,
            title: l10n?.txtfathersName ?? "Father's Name",
            value: rider?.fatherName ?? notProvided,
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.person_outline,
            title: l10n?.txtmothersName ?? "Mother's Name",
            value: rider?.motherName ?? notProvided,
          ),
          const CustomDivider(),
          ProfileDetailRow(
            icon: Icons.home_outlined,
            title: l10n?.txtaddress ?? 'Address',
            value: rider?.currentAddress ?? notProvided,
          ),
          const CustomDivider(),
          GestureDetector(
            onTap: () {
              final phone = rider?.emergencyContact;
              if (phone != null && phone.isNotEmpty) {
                HapticService.light();
                launchUrl(Uri.parse('tel:$phone'));
              }
            },
            child: ProfileDetailRow(
              icon: Icons.phone_android_outlined,
              title: l10n?.txtemergencyContact ?? 'Emergency Contact',
              value: rider?.emergencyContact ?? notProvided,
            ),
          ),
          if (rider?.assignedVehicle != null &&
              rider!.assignedVehicle!.isNotEmpty &&
              rider.assignedVehicle != 'Not Assigned') ...[
            const CustomDivider(),
            ProfileDetailRow(
              icon: Icons.directions_car_outlined,
              title: l10n?.txtvehicleTitle ?? 'Vehicle',
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
              title: l10n?.txtteamLeader ?? 'Team Leader',
              value: rider.teamLeader!,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildStatusBentos(BuildContext context, RiderModel? rider) {
    final l10n = AppLocalizations.of(context);
    final rawStatus = rider?.kycStatus.name ?? 'Pending';
    final String kycStatus = rawStatus == 'submitted'
        ? (l10n?.txtunderReview ?? 'Under Review')
        : _capitalize(rawStatus);
    final String guarantorStatus =
        _capitalize(rider?.guarantorStatus.name ?? 'Pending');

    return Row(
      children: [
        Expanded(
          child: StatusTile(
            title: l10n?.txtkycStatusTitle ?? 'KYC STATUS',
            status: kycStatus,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: StatusTile(
            title: l10n?.txtguarantorStatusTitle ?? 'GUARANTOR',
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

class _SectionLabel extends StatelessWidget {
  final String label;
  const _SectionLabel(this.label);

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Text(
      label,
      style: AppTypography.bodySmall.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: 1.2,
        color: colors.onSurfaceMuted,
      ),
    );
  }
}

class _EditProfileTile extends StatelessWidget {
  final VoidCallback onTap;
  const _EditProfileTile({required this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(
          color: colors.outlineVariant.withValues(alpha: 0.5),
        ),
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
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.primarySurface,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.edit_outlined,
                      color: AppColors.info, size: 22),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Text(
                    l10n?.txteditProfile ?? 'Edit Profile',
                    style: AppTypography.labelLarge
                        .copyWith(fontWeight: FontWeight.w700)
                        .copyWith(color: colors.onSurface),
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  color: colors.outlineVariant,
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
