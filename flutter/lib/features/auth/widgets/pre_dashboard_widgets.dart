import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../../../models/rider_model.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/premium_cards.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Pre-Dashboard state banner showing current onboarding status.
class PreDashboardBanner extends StatelessWidget {
  final bool kycRejected;
  final bool kycVerified;
  final bool planDone;

  const PreDashboardBanner({
    super.key,
    required this.kycRejected,
    required this.kycVerified,
    required this.planDone,
  });

  @override
  Widget build(BuildContext context) {
    if (kycRejected) {
      return _buildRejectedBanner(context);
    }
    if (kycVerified) {
      return _buildApprovedBanner(context);
    }
    return _buildActionRequiredBanner(context);
  }

  Widget _buildRejectedBanner(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: AppColors.of(context).errorRose,
        borderRadius: BorderRadius.circular(AppRadius.full),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.circle, color: AppColors.error, size: 10),
          SizedBox(width: 8),
          Text(
            'KYC REJECTED',
            style: AppTypography.bodyMedium
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: AppColors.error, letterSpacing: 1.2),
          ),
        ],
      ),
    );
  }

  Widget _buildApprovedBanner(BuildContext context) {
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: AppColors.warningSurface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: AppColors.of(context).warningBorder),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: AppColors.warningDark,
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.schedule, color: Colors.white, size: 18),
          ),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'KYC Approved',
                  style: AppTypography.labelLarge
                      .copyWith(color: AppColors.warningDark),
                ),
                Text(
                  planDone ? 'Pickup your vehicle' : 'Choose a Plan',
                  style: AppTypography.bodySmall
                      .copyWith(fontWeight: FontWeight.w600)
                      .copyWith(color: AppColors.warningDark),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: AppColors.of(context).card,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: AppColors.warningDark),
            ),
            child: Text(
              'PENDING',
              style: AppTypography.overline
                  .copyWith(color: AppColors.warningDark, letterSpacing: 0.8),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionRequiredBanner(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.errorLight,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.error.withValues(alpha: 0.3)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: AppColors.error,
              shape: BoxShape.circle,
            ),
            child: const Icon(
              Icons.warning_amber_rounded,
              color: Colors.white,
              size: 18,
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Account Action',
                  style: AppTypography.labelLarge.copyWith(
                    color: colors.errorLightForeground,
                  ),
                ),
                Text(
                  'Required',
                  style: AppTypography.bodySmall
                      .copyWith(fontWeight: FontWeight.w600)
                      .copyWith(color: colors.errorLightForeground),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: colors.error.withValues(alpha: 0.5)),
            ),
            child: Text(
              'ACTION',
              style: AppTypography.overline.copyWith(
                  color: colors.errorLightForeground, letterSpacing: 0.8),
            ),
          ),
        ],
      ),
    );
  }
}

/// Pre-Dashboard profile card with KYC state indicators.
class PreDashboardProfileCard extends StatelessWidget {
  final RiderModel rider;
  final bool kycVerified;
  final bool kycRejected;

  const PreDashboardProfileCard({
    super.key,
    required this.rider,
    required this.kycVerified,
    required this.kycRejected,
  });

  @override
  Widget build(BuildContext context) {
    if (kycRejected) {
      return _buildRejectedProfile(context);
    }
    return _buildNormalProfile(context);
  }

  Widget _buildRejectedProfile(BuildContext context) {
    return PremiumDoubleBezelCard(
      padding: EdgeInsets.zero,
      child: Builder(
        builder: (context) {
          final colors = AppColors.of(context);
          return Container(
            padding: Spacing.paddingLg,
            decoration: BoxDecoration(
              color: colors.card,
              borderRadius: BorderRadius.circular(AppRadius.radiusModal),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withValues(alpha: 0.02),
                  blurRadius: 20,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: Row(
              children: [
                Stack(
                  clipBehavior: Clip.none,
                  children: [
                    Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                            color: AppColors.of(context).errorRose, width: 3),
                      ),
                      padding: const EdgeInsets.all(2),
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          border: Border.all(color: AppColors.error, width: 2),
                        ),
                        child: ClipOval(
                          child: rider.profilePhoto != null &&
                                  rider.profilePhoto!.isNotEmpty
                              ? CachedNetworkImage(
                                  imageUrl: rider.profilePhoto!,
                                  fit: BoxFit.cover,
                                  errorWidget: (_, __, ___) =>
                                      _buildPlaceholder(rider),
                                  placeholder: (_, __) =>
                                      _buildPlaceholder(rider),
                                )
                              : _buildPlaceholder(rider),
                        ),
                      ),
                    ),
                    Positioned(
                      bottom: -4,
                      right: -4,
                      child: Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: AppColors.error,
                          shape: BoxShape.circle,
                          border: Border.all(color: Colors.white, width: 2),
                        ),
                        child: const Icon(
                          Icons.warning_amber_rounded,
                          color: Colors.white,
                          size: 16,
                        ),
                      ),
                    ),
                  ],
                ),
                SizedBox(width: 20),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        rider.name.isNotEmpty ? rider.name : 'Rider',
                        style: AppTypography.headingSmall
                            .copyWith(color: colors.onSurface),
                      ),
                      SizedBox(height: 6),
                      Row(
                        children: [
                          Text(
                            'RIDER ID',
                            style: AppTypography.labelSmall.copyWith(
                                color: colors.onSurfaceMuted,
                                letterSpacing: 1.0),
                          ),
                          SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 8,
                              vertical: 4,
                            ),
                            decoration: BoxDecoration(
                              color: colors.iconBackground,
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              rider.riderId.isEmpty ? '—' : rider.riderId,
                              style: AppTypography.bodySmall
                                  .copyWith(fontWeight: FontWeight.w800)
                                  .copyWith(color: colors.onSurface),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildNormalProfile(BuildContext context) {
    final String badgeText = kycVerified ? 'KYC VERIFIED' : 'PENDING KYC';
    final Color badgeBg = kycVerified
        ? AppColors.of(context).successLight
        : AppColors.warningSurface;
    final Color badgeTextColor =
        kycVerified ? AppColors.success : AppColors.warning;
    final Color badgeBorder = kycVerified
        ? AppColors.of(context).successLight
        : AppColors.of(context).warningBorder;

    return PremiumDoubleBezelCard(
        padding: EdgeInsets.zero,
        child: Builder(
          builder: (context) {
            final colors = AppColors.of(context);
            return Container(
              padding: Spacing.paddingLg,
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(AppRadius.radiusModal),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.02),
                    blurRadius: 20,
                    offset: const Offset(0, 4),
                  ),
                ],
              ),
              child: Column(
                children: [
                  Container(
                    width: 96,
                    height: 96,
                    decoration: BoxDecoration(
                      shape: BoxShape.circle,
                      border:
                          Border.all(color: colors.iconBackground, width: 4),
                    ),
                    child: ClipOval(
                      child: rider.profilePhoto != null &&
                              rider.profilePhoto!.isNotEmpty
                          ? CachedNetworkImage(
                              imageUrl: rider.profilePhoto!,
                              fit: BoxFit.cover,
                              errorWidget: (_, __, ___) =>
                                  _buildPlaceholder(rider),
                              placeholder: (_, __) => _buildPlaceholder(rider),
                            )
                          : _buildPlaceholder(rider),
                    ),
                  ),
                  SizedBox(height: 14),
                  Text(
                    rider.name.isNotEmpty ? rider.name : 'Rider',
                    style: AppTypography.titleMedium
                        .copyWith(color: colors.onSurface),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'ID: ${rider.riderId}',
                    style: AppTypography.bodyMedium
                        .copyWith(fontSize: 13)
                        .copyWith(
                            color: colors.onSurfaceMuted, letterSpacing: 0.3),
                  ),
                  SizedBox(height: 12),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    decoration: BoxDecoration(
                      color: badgeBg,
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      border: Border.all(color: badgeBorder),
                    ),
                    child: Text(
                      badgeText,
                      style: AppTypography.overline
                          .copyWith(color: badgeTextColor, letterSpacing: 1.2),
                    ),
                  ),
                ],
              ),
            );
          },
        ));
  }

  Widget _buildPlaceholder(RiderModel rider) {
    return Builder(
      builder: (context) {
        final colors = AppColors.of(context);
        return Container(
          color: colors.outlineVariant,
          child: Center(
            child: Text(
              rider.name.isEmpty ? '?' : rider.name[0].toUpperCase(),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 36,
                fontWeight: FontWeight.w700,
                color: colors.onSurfaceVariant,
              ),
            ),
          ),
        );
      },
    );
  }
}

/// Generic Rejection Remarks card.
class RejectionCard extends StatelessWidget {
  final String title;
  final String reason;
  final VoidCallback onResubmit;
  final String buttonText;

  const RejectionCard({
    super.key,
    required this.title,
    required this.reason,
    required this.onResubmit,
    this.buttonText = 'Update',
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: AppColors.of(context).errorRose,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border:
            Border.all(color: AppColors.of(context).errorBorder, width: 1.5),
      ),
      child: Padding(
        padding: Spacing.paddingLg,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: AppColors.of(context).errorRose,
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                  child: const Icon(
                    Icons.error_outline,
                    color: AppColors.error,
                    size: 24,
                  ),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Builder(builder: (context) {
                        final colors = AppColors.of(context);
                        return Text(
                          title,
                          style: AppTypography.titleLarge
                              .copyWith(color: colors.onSurface),
                        );
                      }),
                      SizedBox(height: 8),
                      Builder(builder: (context) {
                        final colors = AppColors.of(context);
                        return Text(
                          reason,
                          style: AppTypography.bodyLarge
                              .copyWith(color: colors.onSurface, height: 1.4),
                        );
                      }),
                    ],
                  ),
                ),
              ],
            ),
            SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onResubmit,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                  ),
                  elevation: 0,
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.upload_file, size: 20),
                    SizedBox(width: 8),
                    Text(
                      buttonText,
                      style: AppTypography.titleSmall,
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// CTA cards for pre-dashboard (Book Vehicle, Start Registration, Pickup, Need Help).
class PreDashboardCtaCard extends StatelessWidget {
  final String title;
  final String description;
  final String buttonLabel;
  final IconData buttonIcon;
  final List<Color> gradientColors;
  final Color buttonColor;
  final VoidCallback? onPressed;
  final bool showCurtain;

  const PreDashboardCtaCard({
    super.key,
    required this.title,
    required this.description,
    required this.buttonLabel,
    required this.buttonIcon,
    required this.gradientColors,
    required this.buttonColor,
    this.onPressed,
    this.showCurtain = false,
  });

  factory PreDashboardCtaCard.bookVehicle({
    required VoidCallback? onPressed,
  }) {
    return PreDashboardCtaCard(
      title: 'Rental Plan Selection',
      description:
          'Choose a rental plan (Daily, Weekly, or Monthly) to proceed with your vehicle booking.',
      buttonLabel: 'SELECT RENTAL PLAN',
      buttonIcon: Icons.two_wheeler,
      gradientColors: [AppColors.primary, AppColors.primaryDark],
      buttonColor: AppColors.primary,
      onPressed: onPressed,
    );
  }

  factory PreDashboardCtaCard.startRegistration({
    required VoidCallback? onPressed,
  }) {
    return PreDashboardCtaCard(
      title: 'Complete Your Registration',
      description:
          'Set up your profile, verify your identity, and add a guarantor to start riding with Voltium.',
      buttonLabel: 'START REGISTRATION',
      buttonIcon: Icons.arrow_forward,
      gradientColors: [AppColors.successDark, AppColors.success],
      buttonColor: AppColors.successDark,
      onPressed: onPressed,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: Spacing.paddingLg,
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradientColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: [
          BoxShadow(
            color: gradientColors.first.withValues(alpha: 0.3),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTypography.titleLarge.copyWith(color: Colors.white),
          ),
          SizedBox(height: 8),
          Text(
            description,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 13,
              fontWeight: FontWeight.w400,
              color: AppColors.primaryLightBlue,
              height: 1.4,
            ),
          ),
          SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: AppColors.of(context).card,
                foregroundColor: buttonColor,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                elevation: 0,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    buttonLabel,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 13,
                      fontWeight: FontWeight.w800,
                      letterSpacing: 1.2,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Icon(buttonIcon, size: 18),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

/// Pickup Vehicle button.
class PickupButton extends StatelessWidget {
  final VoidCallback? onPressed;

  const PickupButton({super.key, this.onPressed});

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: AppColors.primary,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(vertical: 18),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.radiusModal),
          ),
          elevation: 8,
          shadowColor: AppColors.primary.withValues(alpha: 0.4),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.local_shipping, size: 22),
            SizedBox(width: 12),
            Text(
              'PICKUP YOUR VEHICLE',
              style: AppTypography.labelLarge
                  .copyWith(fontWeight: FontWeight.w700)
                  .copyWith(letterSpacing: 1.2),
            ),
          ],
        ),
      ),
    );
  }
}

/// Need Help? support card.
class NeedHelpCard extends StatelessWidget {
  final VoidCallback? onTap;

  const NeedHelpCard({super.key, this.onTap});

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.radiusModal),
      child: Container(
        padding: const EdgeInsets.all(Spacing.md),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [AppColors.primary, AppColors.primaryDark],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.3),
              blurRadius: 20,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          children: [
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.2),
                borderRadius: BorderRadius.circular(14),
              ),
              child:
                  const Icon(Icons.help_outline, color: Colors.white, size: 24),
            ),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'NEED HELP?',
                    style:
                        AppTypography.titleSmall.copyWith(color: Colors.white),
                  ),
                  SizedBox(height: 4),
                  Text(
                    'Contact support for onboarding assistance',
                    style: AppTypography.bodySmall
                        .copyWith(color: AppColors.primaryLightBlue),
                  ),
                ],
              ),
            ),
            const Icon(Icons.arrow_forward_ios, color: Colors.white, size: 16),
          ],
        ),
      ),
    );
  }
}
