import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class GradientWalletCard extends StatelessWidget {
  final double balance;
  final String? name;
  final String? vehicleNumber;
  final VoidCallback? onTap;
  final Gradient? gradient;

  const GradientWalletCard({
    super.key,
    required this.balance,
    this.name,
    this.vehicleNumber,
    this.onTap,
    this.gradient,
  });

  static const _defaultGradient = LinearGradient(
    begin: Alignment.topLeft,
    end: Alignment.bottomRight,
    colors: [AppColors.primary, AppColors.primaryDeep, AppColors.primaryDeep],
  );

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        width: double.infinity,
        height: 216,
        margin: const EdgeInsets.symmetric(horizontal: 16),
        clipBehavior: Clip.antiAlias,
        decoration: BoxDecoration(
          gradient: gradient ?? _defaultGradient,
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.4),
              blurRadius: 20,
              offset: const Offset(0, 10),
            ),
          ],
        ),
        child: Stack(
          children: [
            Positioned(
              top: -50,
              right: -50,
              child: Container(
                width: 200,
                height: 200,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.1),
                ),
              ),
            ),
            Positioned(
              bottom: -30,
              left: -30,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.05),
                ),
              ),
            ),
            Positioned.fill(
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 25, sigmaY: 25),
                child: Container(color: Colors.transparent),
              ),
            ),
            Padding(
              padding: Spacing.paddingLg,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Wallet Balance',
                        style: AppTypography.bodyMedium
                            .copyWith(color: Colors.white70),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 6,
                        ),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(AppRadius.lg),
                        ),
                        child: Row(
                          children: [
                            Icon(
                              Icons.bolt,
                              color: AppColors.warning,
                              size: 16,
                            ),
                            SizedBox(width: 4),
                            Text(
                              'EV Plus',
                              style: AppTypography.bodySmall
                                  .copyWith(fontWeight: FontWeight.w600)
                                  .copyWith(color: Colors.white),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 12),
                  Text(
                    '₹${(balance / 100).toStringAsFixed(2)}',
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white,
                      fontSize: 36,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -1,
                    ),
                  ),
                  const Spacer(),
                  if (vehicleNumber != null) ...[
                    Row(
                      children: [
                        Container(
                          padding: Spacing.paddingSm,
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(10),
                          ),
                          child: const Icon(
                            Icons.electric_moped,
                            color: Colors.white,
                            size: 20,
                          ),
                        ),
                        SizedBox(width: 12),
                        Text(
                          vehicleNumber!,
                          style: AppTypography.bodyLarge
                              .copyWith(color: Colors.white),
                        ),
                      ],
                    ),
                  ],
                  if (name != null) ...[
                    SizedBox(height: 12),
                    Text(
                      name!,
                      style: GoogleFonts.plusJakartaSans(
                        color: Colors.white70,
                        fontSize: 14,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class MiniWalletCard extends StatelessWidget {
  final double balance;
  final String label;
  final IconData icon;
  final Color? color;

  const MiniWalletCard({
    super.key,
    required this.balance,
    required this.label,
    required this.icon,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: (color ?? AppColors.primary).withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: (color ?? AppColors.primary).withValues(alpha: 0.2),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: Spacing.paddingSm,
            decoration: BoxDecoration(
              color: color ?? AppColors.primary,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: Colors.white, size: 20),
          ),
          SizedBox(height: 12),
          Text(
            '₹${(balance / 100).toStringAsFixed(2)}',
            style: AppTypography.titleLarge.copyWith(
                color: color != null ? colors.onSurface : AppColors.primary),
          ),
          SizedBox(height: 4),
          Text(
            label,
            style: GoogleFonts.plusJakartaSans(
              fontSize: 12,
              color: colors.onSurfaceMuted,
            ),
          ),
        ],
      ),
    );
  }
}

class WalletActionButton extends StatelessWidget {
  final IconData icon;
  final String label;
  final VoidCallback? onTap;
  final Color? color;

  const WalletActionButton({
    super.key,
    required this.icon,
    required this.label,
    this.onTap,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        padding: Spacing.paddingMd,
        child: Column(
          children: [
            Container(
              padding: const EdgeInsets.all(Spacing.sm),
              decoration: BoxDecoration(
                color: (color ?? AppColors.primary).withValues(alpha: 0.1),
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
              child: Icon(
                icon,
                color: color ?? AppColors.primary,
                size: 24,
              ),
            ),
            SizedBox(height: 8),
            Text(
              label,
              style: AppTypography.bodySmall
                  .copyWith(color: colors.onSurfaceVariant),
            ),
          ],
        ),
      ),
    );
  }
}
