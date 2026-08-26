import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class ReferralCard extends StatelessWidget {
  final String referralCode;
  final String? userName;
  final double? rewardAmount;
  final VoidCallback? onShare;
  final VoidCallback? onCopy;

  const ReferralCard({
    super.key,
    required this.referralCode,
    this.userName,
    this.rewardAmount,
    this.onShare,
    this.onCopy,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: Spacing.paddingMd,
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [AppColors.primary, AppColors.info],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 20,
            offset: const Offset(0, 10),
          ),
        ],
      ),
      child: Padding(
        padding: Spacing.paddingLg,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Refer Friends',
                      style: AppTypography.titleLarge
                          .copyWith(color: Colors.white),
                    ),
                    if (userName != null)
                      Text(
                        'Hey $userName!',
                        style: GoogleFonts.plusJakartaSans(
                          color: Colors.white70,
                          fontSize: 14,
                        ),
                      ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.all(Spacing.sm),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.card_giftcard,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
              ],
            ),
            const SizedBox(height: 24),
            Container(
              padding: Spacing.paddingMd,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Your Referral Code',
                          style: GoogleFonts.plusJakartaSans(
                            color: AppColors.onSurfaceMuted,
                            fontSize: 12,
                          ),
                        ),
                        SizedBox(height: 4),
                        Text(
                          referralCode,
                          style: AppTypography.headingMedium.copyWith(
                              color: AppColors.primary, letterSpacing: 2),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    onPressed: () {
                      Clipboard.setData(ClipboardData(text: referralCode));
                      onCopy?.call();
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Code copied!')),
                      );
                    },
                    icon: const Icon(Icons.copy, color: AppColors.primary),
                  ),
                ],
              ),
            ),
            if (rewardAmount != null) ...[
              SizedBox(height: 16),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: AppColors.warning,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(
                      Icons.card_giftcard,
                      color: Colors.white,
                      size: 18,
                    ),
                    SizedBox(width: 8),
                    Text(
                      'Get \$${rewardAmount!.toStringAsFixed(2)} for each referral',
                      style: AppTypography.labelMedium
                          .copyWith(color: Colors.white),
                    ),
                  ],
                ),
              ),
            ],
            const SizedBox(height: 20),
            SizedBox(
              width: double.infinity,
              child: ElevatedButton.icon(
                onPressed: onShare,
                icon: const Icon(Icons.share),
                label: const Text('Share Referral'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.primary,
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ReferralStatsCard extends StatelessWidget {
  final int totalReferrals;
  final double totalEarnings;
  final int pendingReferrals;

  const ReferralStatsCard({
    super.key,
    required this.totalReferrals,
    required this.totalEarnings,
    required this.pendingReferrals,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16),
      child: Row(
        children: [
          Expanded(
            child: _StatItem(
              icon: Icons.people,
              value: totalReferrals.toString(),
              label: 'Referrals',
              color: AppColors.primary,
            ),
          ),
          Expanded(
            child: _StatItem(
              icon: Icons.attach_money,
              value: '\$${totalEarnings.toStringAsFixed(0)}',
              label: 'Earned',
              color: AppColors.success,
            ),
          ),
          Expanded(
            child: _StatItem(
              icon: Icons.hourglass_empty,
              value: pendingReferrals.toString(),
              label: 'Pending',
              color: AppColors.warningDark,
            ),
          ),
        ],
      ),
    );
  }
}

class _StatItem extends StatelessWidget {
  final IconData icon;
  final String value;
  final String label;
  final Color color;

  const _StatItem({
    required this.icon,
    required this.value,
    required this.label,
    required this.color,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: Spacing.paddingSm,
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.md),
      ),
      child: Column(
        children: [
          Icon(icon, color: color, size: 24),
          SizedBox(height: 8),
          Text(
            value,
            style: AppTypography.titleLarge.copyWith(color: color),
          ),
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: AppColors.onSurfaceMuted,
            ),
          ),
        ],
      ),
    );
  }
}

class ReferralShareOptions extends StatelessWidget {
  final String referralCode;
  final VoidCallback? onShare;

  const ReferralShareOptions({
    super.key,
    required this.referralCode,
    this.onShare,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: Spacing.paddingMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Share via',
            style: AppTypography.bodyLarge,
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceAround,
            children: [
              _ShareOption(
                icon: Icons.message,
                label: 'Message',
                color: AppColors.success,
                onTap: () {},
              ),
              _ShareOption(
                icon: Icons.chat,
                label: 'WhatsApp',
                color: AppColors.whatsappGreen,
                onTap: () {},
              ),
              _ShareOption(
                icon: Icons.link,
                label: 'Copy Link',
                color: AppColors.primary,
                onTap: () {
                  Clipboard.setData(ClipboardData(text: referralCode));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Link copied!')),
                  );
                },
              ),
              _ShareOption(
                icon: Icons.qr_code,
                label: 'QR Code',
                color: AppColors.accentPurple,
                onTap: () {},
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ShareOption extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;
  final VoidCallback onTap;

  const _ShareOption({
    required this.icon,
    required this.label,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: Container(
        padding: const EdgeInsets.all(Spacing.sm),
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(Spacing.sm),
              decoration: BoxDecoration(
                color: color.withValues(alpha: 0.1),
                shape: BoxShape.circle,
              ),
              child: Icon(icon, color: color),
            ),
            SizedBox(height: 8),
            Text(
              label,
              style: GoogleFonts.plusJakartaSans(fontSize: 12),
            ),
          ],
        ),
      ),
    );
  }
}
