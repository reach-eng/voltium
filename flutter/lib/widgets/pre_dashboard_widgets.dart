import 'package:flutter/material.dart';
import 'package:cached_network_image/cached_network_image.dart';
import '../models/rider_model.dart';
import '../theme/app_theme.dart';

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
      return _buildRejectedBanner();
    }
    if (kycVerified) {
      return _buildApprovedBanner();
    }
    return _buildActionRequiredBanner();
  }

  Widget _buildRejectedBanner() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFFFFE4E6),
        borderRadius: BorderRadius.circular(9999),
      ),
      child: const Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(Icons.circle, color: AppColors.error, size: 10),
          SizedBox(width: 8),
          Text('KYC REJECTED',
            style: TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.w800,
              color: AppColors.error,
              letterSpacing: 1.2,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildApprovedBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF8E1),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFFE082)),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: const BoxDecoration(
              color: Color(0xFFFFA000),
              shape: BoxShape.circle,
            ),
            child: const Icon(Icons.schedule, color: Colors.white, size: 18),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('KYC Approved',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFFE65100),
                  ),
                ),
                Text(
                  planDone ? 'Pickup your vehicle' : 'Choose a Plan',
                  style: const TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: Color(0xFFF57C00),
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: const Color(0xFFFFA000)),
            ),
            child: const Text('PENDING',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: Color(0xFFFFA000),
                letterSpacing: 0.8,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionRequiredBanner() {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFECACA)),
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
            child: const Icon(Icons.warning_amber_rounded,
                color: Colors.white, size: 18,),
          ),
          const SizedBox(width: 14),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text('Account Action',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.w700,
                    color: Color(0xFF991B1B),
                  ),
                ),
                Text('Required',
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: AppColors.errorDark,
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 4),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: AppColors.error),
            ),
            child: const Text('INACTIVE',
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: AppColors.error,
                letterSpacing: 0.8,
              ),
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
      return _buildRejectedProfile();
    }
    return _buildNormalProfile();
  }

  Widget _buildRejectedProfile() {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
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
                  border: Border.all(color: const Color(0xFFFFE4E6), width: 3),
                ),
                padding: const EdgeInsets.all(2),
                child: Container(
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    border:
                        Border.all(color: AppColors.error, width: 2),
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
          const SizedBox(width: 20),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  rider.name.isNotEmpty ? rider.name : 'Rider',
                  style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF1E293B),
                  ),
                ),
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Text('RIDER ID',
                      style: TextStyle(
                        fontSize: 11,
                        fontWeight: FontWeight.w700,
                        color: AppColors.slate400,
                        letterSpacing: 1.0,
                      ),
                    ),
                    const SizedBox(width: 8),
                    Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 8, vertical: 4,),
                      decoration: BoxDecoration(
                        color: AppColors.iconBackground,
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        rider.riderId.isEmpty ? 'VF-RD-000' : rider.riderId,
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF1E293B),
                        ),
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
  }

  Widget _buildNormalProfile() {
    final String badgeText = kycVerified ? 'KYC VERIFIED' : 'PENDING KYC';
    final Color badgeBg =
        kycVerified ? const Color(0xFFF0FDF4) : const Color(0xFFFFF7ED);
    final Color badgeTextColor =
        kycVerified ? const Color(0xFF16A34A) : const Color(0xFFEA580C);
    final Color badgeBorder =
        kycVerified ? const Color(0xFFBBF7D0) : const Color(0xFFFED7AA);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
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
              border: Border.all(color: AppColors.iconBackground, width: 4),
            ),
            child: ClipOval(
              child: rider.profilePhoto != null &&
                      rider.profilePhoto!.isNotEmpty
                  ? CachedNetworkImage(
                      imageUrl: rider.profilePhoto!,
                      fit: BoxFit.cover,
                      errorWidget: (_, __, ___) => _buildPlaceholder(rider),
                      placeholder: (_, __) => _buildPlaceholder(rider),
                    )
                  : _buildPlaceholder(rider),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            rider.name.isNotEmpty ? rider.name : 'Rider',
            style: const TextStyle(
              fontSize: 18,
              fontWeight: FontWeight.w700,
              color: Color(0xFF1E293B),
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'ID: ${rider.riderId}',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w500,
              color: AppColors.slate400,
              letterSpacing: 0.3,
            ),
          ),
          const SizedBox(height: 12),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
            decoration: BoxDecoration(
              color: badgeBg,
              borderRadius: BorderRadius.circular(20),
              border: Border.all(color: badgeBorder),
            ),
            child: Text(
              badgeText,
              style: TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w900,
                color: badgeTextColor,
                letterSpacing: 1.2,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlaceholder(RiderModel rider) {
    return Container(
      color: AppColors.outlineVariant,
      child: Center(
        child: Text(
          rider.name.isEmpty ? '?' : rider.name[0].toUpperCase(),
          style: const TextStyle(
            fontSize: 36,
            fontWeight: FontWeight.w700,
            color: AppColors.slate500,
          ),
        ),
      ),
    );
  }
}

/// KYC Rejection Remarks card.
class RejectionCard extends StatelessWidget {
  final RiderModel rider;
  final VoidCallback? onReupload;

  const RejectionCard({
    super.key,
    required this.rider,
    this.onReupload,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFF1F2),
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: const Color(0xFFFDA4AF), width: 1.5),
      ),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFFFFE4E6),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.error_outline,
                      color: AppColors.error, size: 24,),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Text('Rejection Remarks',
                        style: TextStyle(
                          fontSize: 20,
                          fontWeight: FontWeight.w800,
                          color: Color(0xFF0F172A),
                        ),
                      ),
                      const SizedBox(height: 8),
                      Text(
                        rider.kycRejectionReason != null &&
                                rider.kycRejectionReason!.isNotEmpty
                            ? rider.kycRejectionReason!
                            : 'The uploaded PAN card document was blurry and unreadable. Please ensure all details are clearly visible in the new upload.',
                        style: const TextStyle(
                          fontSize: 16,
                          fontWeight: FontWeight.w500,
                          color: Color(0xFF334155),
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton(
                onPressed: onReupload,
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppColors.error,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(16),),
                  elevation: 0,
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.upload_file, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'Re-upload Documents',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
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
      title: 'Ready to hit the road?',
      description:
          'Available plans are fetched from admin panel. Complete your profile to start your first journey.',
      buttonLabel: 'BOOK VEHICLE',
      buttonIcon: Icons.arrow_forward,
      gradientColors: [const Color(0xFF2563EB), const Color(0xFF1D4ED8)],
      buttonColor: const Color(0xFF2563EB),
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
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: gradientColors,
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(28),
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
            style: const TextStyle(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: Colors.white,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            description,
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w400,
              color: Color(0xFFBFDBFE),
              height: 1.4,
            ),
          ),
          const SizedBox(height: 24),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: onPressed,
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: buttonColor,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(16),),
                elevation: 0,
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    buttonLabel,
                    style: const TextStyle(
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
            borderRadius: BorderRadius.circular(28),
          ),
          elevation: 8,
          shadowColor: AppColors.primary.withValues(alpha: 0.4),
        ),
        child: const Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(Icons.local_shipping, size: 22),
            SizedBox(width: 12),
            Text('PICKUP YOUR VEHICLE',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w800,
                letterSpacing: 1.2,
              ),
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
      borderRadius: BorderRadius.circular(28),
      child: Container(
        padding: const EdgeInsets.all(20),
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            colors: [Color(0xFF2563EB), Color(0xFF1D4ED8)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
          borderRadius: BorderRadius.circular(28),
          boxShadow: [
            BoxShadow(
              color: const Color(0xFF2563EB).withValues(alpha: 0.3),
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
            const SizedBox(width: 14),
            const Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('NEED HELP?',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  SizedBox(height: 4),
                  Text('Contact support for onboarding assistance',
                    style: TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: Color(0xFFBFDBFE),
                    ),
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
