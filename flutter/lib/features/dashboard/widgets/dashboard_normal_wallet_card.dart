import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_theme.dart';
import '../../../theme/app_typography.dart';
import '../../../widgets/animated_balance_counter.dart';
import '../../../widgets/effect_widgets.dart';
import '../../../widgets/premium_cards.dart';
import '../../../widgets/streak_celebration_bar.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/haptic_service.dart';

/// Normal (healthy balance) variant of the wallet card.
class DashboardNormalWalletCard extends StatelessWidget {
  final double walletBalance;
  final double requiredPayment;
  final int paymentStreak;
  final VoidCallback? onTopUp;
  final bool compact;
  final ThemeColors colors;
  final Color amountTextColor;
  final bool hasPulsatingRedAmountHalo;

  const DashboardNormalWalletCard({
    super.key,
    required this.walletBalance,
    required this.requiredPayment,
    required this.paymentStreak,
    this.onTopUp,
    this.compact = false,
    required this.colors,
    required this.amountTextColor,
    required this.hasPulsatingRedAmountHalo,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final minAmountStr =
        requiredPayment > 0 ? requiredPayment.toStringAsFixed(0) : '2000';

    Widget balanceCounter = AnimatedBalanceCounter(
      value: walletBalance,
      showRupeeSymbol: true,
      compact: true,
      duration: const Duration(milliseconds: 700),
      textStyle: GoogleFonts.plusJakartaSans(
        fontSize: compact ? 28 : 32,
        fontWeight: FontWeight.w800,
        color: amountTextColor,
      ),
    );

    if (hasPulsatingRedAmountHalo) {
      balanceCounter = AnimatedGlow(
        color: AppColors.error,
        duration: const Duration(milliseconds: 1500),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          child: balanceCounter,
        ),
      );
    }

    return PremiumDoubleBezelCard(
      padding: EdgeInsets.zero,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: Container(
            padding: Spacing.paddingMd,
            decoration: BoxDecoration(
              color: colors.card.withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(AppRadius.radiusModal),
              boxShadow: AppShadows.glass,
              border: Border.all(
                  color: colors.outlineVariant.withValues(alpha: 0.4),
                  width: 1),
            ),
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
                          l10n?.txttotalBalance ?? 'TOTAL BALANCE',
                          style: AppTypography.bodySmall
                              .copyWith(fontWeight: FontWeight.w800)
                              .copyWith(
                                  color: colors.onSurfaceMuted,
                                  letterSpacing: 1.2),
                        ),
                        const SizedBox(height: 8),
                        balanceCounter,
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            _QuickAmountChip(
                              label: '+₹200',
                              onTap: onTopUp != null
                                  ? () {
                                      HapticService.light();
                                      onTopUp!();
                                    }
                                  : null,
                            ),
                            const SizedBox(width: 8),
                            _QuickAmountChip(
                              label: '+₹500',
                              onTap: onTopUp != null
                                  ? () {
                                      HapticService.light();
                                      onTopUp!();
                                    }
                                  : null,
                            ),
                          ],
                        ),
                      ],
                    ),
                    Material(
                      color: AppColors.primary,
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      child: InkWell(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        onTap: onTopUp != null
                            ? () {
                                HapticService.light();
                                onTopUp!();
                              }
                            : null,
                        child: Container(
                          width: 48,
                          height: 48,
                          alignment: Alignment.center,
                          child: const Icon(Icons.add,
                              color: Colors.white, size: 24),
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      l10n?.txtrentalRecoveryStreak ?? 'Rental Recovery Streak',
                      style: AppTypography.titleSmall.copyWith(
                        fontSize: compact ? 12 : 14,
                        fontWeight: FontWeight.w600,
                        color: compact
                            ? colors.onSurfaceVariant
                            : colors.onSurface,
                      ),
                    ),
                    Text(
                      l10n?.txtstreakDays(paymentStreak, 5) ??
                          '$paymentStreak/5 Days',
                      style: AppTypography.bodyMedium
                          .copyWith(fontSize: 13, fontWeight: FontWeight.w700)
                          .copyWith(color: AppColors.primary),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                StreakCelebrationBar(
                  streak: paymentStreak,
                  height: compact ? 8 : 10,
                  borderRadius: 4,
                ),
                const SizedBox(height: 16),
                Text(
                  l10n?.txtminRechargeNotice(minAmountStr) ??
                      'A minimum recharge of ₹$minAmountStr is required to proceed further.',
                  style: AppTypography.bodySmall.copyWith(
                    fontSize: compact ? 10 : 12,
                    fontWeight: FontWeight.w500,
                    color: colors.onSurfaceMuted,
                    height: 1.4,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _QuickAmountChip extends StatelessWidget {
  final String label;
  final VoidCallback? onTap;

  const _QuickAmountChip({required this.label, this.onTap});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.full),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
          decoration: BoxDecoration(
            color: colors.primarySurface,
            borderRadius: BorderRadius.circular(AppRadius.full),
            border: Border.all(
              color: AppColors.primary.withValues(alpha: 0.3),
              width: 1,
            ),
          ),
          child: Text(
            label,
            style: AppTypography.labelSmall.copyWith(
              color: AppColors.primary,
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
      ),
    );
  }
}
