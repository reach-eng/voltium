import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import '../../../../theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class StatusTile extends StatelessWidget {
  final String title;
  final String status;

  const StatusTile({
    super.key,
    required this.title,
    required this.status,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final bool isApproved = status.toUpperCase() == 'APPROVED' ||
        status.toUpperCase() == 'VERIFIED';
    final Color dotColor = isApproved ? AppColors.success : AppColors.error;

    return Container(
      padding: Spacing.paddingMd,
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
                style: AppTypography.bodySmall
                    .copyWith(fontWeight: FontWeight.w800)
                    .copyWith(color: colors.onSurfaceMuted, letterSpacing: 0.8),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            status,
            style: AppTypography.labelLarge
                .copyWith(fontWeight: FontWeight.w700)
                .copyWith(color: dotColor),
          ),
        ],
      ),
    );
  }
}

class QuickLinkItem extends StatelessWidget {
  final IconData icon;
  final IconData? activeIcon;
  final Color iconColor;
  final Color iconBgColor;
  final String title;
  final VoidCallback? onTap;
  final Widget? trailing;

  const QuickLinkItem({
    super.key,
    required this.icon,
    this.activeIcon,
    required this.iconColor,
    required this.iconBgColor,
    required this.title,
    this.onTap,
    this.trailing,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
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
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
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
                    style: AppTypography.labelLarge
                        .copyWith(fontWeight: FontWeight.w700)
                        .copyWith(color: colors.onSurface),
                  ),
                ),
                trailing ??
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

class CustomDivider extends StatelessWidget {
  const CustomDivider({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      margin: const EdgeInsets.symmetric(vertical: 12),
      height: 1,
      color: colors.outlineVariant.withValues(alpha: 0.5),
    );
  }
}

class ProfileDetailRow extends StatelessWidget {
  final IconData icon;
  final String title;
  final String value;

  const ProfileDetailRow({
    super.key,
    required this.icon,
    required this.title,
    required this.value,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Row(
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: colors.iconBackground,
            shape: BoxShape.circle,
          ),
          child: Icon(icon, color: colors.onSurfaceVariant, size: 20),
        ),
        const SizedBox(width: 16),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                title,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  color: colors.onSurfaceMuted,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                value,
                style: AppTypography.bodyMedium
                    .copyWith(fontWeight: FontWeight.w600)
                    .copyWith(color: colors.onSurface),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class ProfileGuarantorCard extends StatelessWidget {
  final RiderModel rider;

  const ProfileGuarantorCard({super.key, required this.rider});

  String _capitalize(String text) {
    if (text.isEmpty) return text;
    return text.substring(0, 1).toUpperCase() + text.substring(1).toLowerCase();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final isApproved = rider.guarantorStatus == GuarantorStatus.verified ||
        rider.guarantorStatus == GuarantorStatus.approved;
    return Container(
      padding: Spacing.paddingMd,
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
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: colors.iconBackground,
                  shape: BoxShape.circle,
                  border: Border.all(color: colors.card, width: 2),
                  boxShadow: const [
                    BoxShadow(color: Colors.black12, blurRadius: 4),
                  ],
                ),
                child: (rider.guarantorPhoto != null &&
                        rider.guarantorPhoto!.isNotEmpty)
                    ? ClipOval(
                        child: CachedNetworkImage(
                          imageUrl: rider.guarantorPhoto!,
                          width: 48,
                          height: 48,
                          fit: BoxFit.cover,
                          memCacheWidth: 96,
                          memCacheHeight: 96,
                          errorWidget: (_, __, ___) => Icon(
                            Icons.person,
                            color: colors.outlineVariant,
                            size: 24,
                          ),
                          placeholder: (_, __) => const SizedBox(
                            width: 48,
                            height: 48,
                            child: Center(
                              child: SizedBox(
                                width: 16,
                                height: 16,
                                child:
                                    CircularProgressIndicator(strokeWidth: 2),
                              ),
                            ),
                          ),
                        ),
                      )
                    : Icon(
                        Icons.person,
                        color: colors.outlineVariant,
                        size: 24,
                      ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      rider.guarantorName ?? 'No Name Provided',
                      style: AppTypography.bodyMedium
                          .copyWith(fontWeight: FontWeight.w600)
                          .copyWith(color: colors.onSurface),
                    ),
                    Text(
                      rider.guarantorPhone ?? 'No Phone Provided',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: colors.onSurfaceMuted,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isApproved
                      ? AppColors.of(context).successLight
                      : AppColors.warningSurface,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  border: Border.all(
                    color: isApproved
                        ? AppColors.success.withValues(alpha: 0.2)
                        : AppColors.warningBorder,
                  ),
                ),
                child: Text(
                  _capitalize(rider.guarantorStatus.name),
                  style: AppTypography.labelMedium.copyWith(
                      color: isApproved
                          ? AppColors.success
                          : AppColors.warningDark),
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
                Icon(
                  Icons.home_outlined,
                  color: colors.onSurfaceMuted,
                  size: 16,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    rider.guarantorAddress!,
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 12, color: colors.onSurfaceVariant),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class ProfileEmergencySosTile extends StatelessWidget {
  final VoidCallback onTap;

  const ProfileEmergencySosTile({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: AppColors.errorSurface,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(color: AppColors.errorBorder),
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: AppColors.of(context).errorLight,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.emergency_outlined,
                    color: AppColors.error,
                    size: 22,
                  ),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: Text(
                    'Emergency SOS',
                    style: AppTypography.titleSmall
                        .copyWith(color: AppColors.error),
                  ),
                ),
                const Icon(Icons.chevron_right, color: AppColors.error),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class ProfileLogoutButton extends StatelessWidget {
  final VoidCallback onTap;

  const ProfileLogoutButton({super.key, required this.onTap});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      key: const Key('logoutButton'),
      onPressed: onTap,
      style: ElevatedButton.styleFrom(
        backgroundColor: Colors.transparent,
        foregroundColor: AppColors.error,
        elevation: 0,
        side: const BorderSide(color: AppColors.errorBorder, width: 1.5),
        minimumSize: const Size(double.infinity, 54),
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.full),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.logout, size: 20),
          SizedBox(width: 8),
          Text(
            'Logout',
            style: AppTypography.titleSmall,
          ),
        ],
      ),
    );
  }
}

class ProfileQuickLinks extends StatelessWidget {
  final VoidCallback onEditProfileTap;
  final VoidCallback onMyDocumentsTap;
  final VoidCallback onRewardsTap;
  final VoidCallback onReferralTap;
  final VoidCallback onAppSettingsTap;
  final VoidCallback onLegalTap;
  final VoidCallback onWorkflowHubTap;
  final VoidCallback onFeedbackTap;

  const ProfileQuickLinks({
    super.key,
    required this.onEditProfileTap,
    required this.onMyDocumentsTap,
    required this.onRewardsTap,
    required this.onReferralTap,
    required this.onAppSettingsTap,
    required this.onLegalTap,
    required this.onWorkflowHubTap,
    required this.onFeedbackTap,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        FadeUpWidget(
          delay: 300,
          child: QuickLinkItem(
            key: const Key('editProfileLink'),
            icon: Icons.edit_outlined,
            iconColor: AppColors.info, // blue-500
            iconBgColor: AppColors.of(context).primarySurface, // blue-50
            title: 'Edit Profile',
            onTap: onEditProfileTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 350,
          child: QuickLinkItem(
            key: const Key('myDocumentsLink'),
            icon: Icons.contact_page_outlined,
            iconColor: AppColors.success, // emerald-500
            iconBgColor: AppColors.of(context).successLight, // emerald-50
            title: 'My Documents',
            onTap: onMyDocumentsTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 400,
          child: QuickLinkItem(
            key: const Key('rewardsLink'),
            icon: Icons.card_giftcard_outlined,
            iconColor: AppColors.accentPurple, // violet-500
            iconBgColor: AppColors.accentPurpleSurface, // violet-50
            title: 'Rewards',
            onTap: onRewardsTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 450,
          child: QuickLinkItem(
            key: const Key('referralLink'),
            icon: Icons.people_outline,
            iconColor: AppColors.warning, // amber-500
            iconBgColor: AppColors.warningSurface, // amber-50
            title: 'Referral Program',
            onTap: onReferralTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 500,
          child: QuickLinkItem(
            key: const Key('appSettingsLink'),
            icon: Icons.settings_outlined,
            iconColor: AppColors.of(context).onSurfaceVariant, // slate-500
            iconBgColor: AppColors.of(context).iconBackground, // slate-100
            title: 'App settings',
            onTap: onAppSettingsTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 550,
          child: QuickLinkItem(
            key: const Key('workflowHubLink'),
            icon: Icons.route_outlined,
            iconColor: AppColors.primary,
            iconBgColor: AppColors.of(context).primarySurface,
            title: 'Workflow & Services',
            onTap: onWorkflowHubTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 575,
          child: QuickLinkItem(
            key: const Key('feedbackLink'),
            icon: Icons.rate_review_outlined,
            iconColor: AppColors.accentPurple,
            iconBgColor: AppColors.accentPurpleSurface,
            title: 'Feedback',
            onTap: onFeedbackTap,
          ),
        ),
        const SizedBox(height: 8),
        FadeUpWidget(
          delay: 600,
          child: QuickLinkItem(
            key: const Key('legalLink'),
            icon: Icons.gavel_outlined,
            iconColor: AppColors.successDark, // teal-700
            iconBgColor: AppColors.of(context).successLight, // teal-50
            title: 'Legal',
            onTap: onLegalTap,
          ),
        ),
      ],
    );
  }
}
