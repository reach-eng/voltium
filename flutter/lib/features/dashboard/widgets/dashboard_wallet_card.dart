import 'package:flutter/material.dart';
import 'dart:ui';
import '../../../theme/app_theme.dart';
import '../../../widgets/premium_cards.dart';
import '../../../widgets/animated_balance_counter.dart';
import '../../../widgets/streak_celebration_bar.dart';
import '../../../widgets/effect_widgets.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import '../../../utils/app_constants.dart';

/// Reusable wallet card used across dashboard screens.
/// Supports a low-balance warning variant and a normal variant.
class WalletCard extends StatelessWidget {
  final double walletBalance;
  final double requiredPayment;
  final int paymentStreak;
  final String? currentPlan;
  final DateTime? planEndDate;
  final VoidCallback? onTopUp;
  final bool compact;

  const WalletCard({
    super.key,
    required this.walletBalance,
    required this.requiredPayment,
    required this.paymentStreak,
    this.currentPlan,
    this.planEndDate,
    this.onTopUp,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final now = DateTime.now();
    final daysUntilDue = planEndDate?.difference(now).inDays;
    final int effectiveDays = daysUntilDue ?? 0;
    final double rentAmount =
        requiredPayment > 0 ? requiredPayment : AppConstants.defaultRentalPrice;

    // Rule 1: Pulsating red halo around amount text only if balance < top up required AND days <= 3
    final bool hasPulsatingRedAmountHalo =
        (walletBalance < rentAmount) && (effectiveDays <= 3);

    // Rule 2 & 3: Amount text color (Green if >= rent required, Amber if < rent required)
    final Color amountTextColor =
        (walletBalance >= rentAmount) ? colors.success : colors.warning;

    // Rule 4: Whole card red halo if balance < rent required AND days <= 1
    final bool hasWholeCardRedHalo =
        (walletBalance < rentAmount) && (effectiveDays <= 1);

    final bool isDailyPlan =
        currentPlan?.toLowerCase().contains('daily') ?? false;

    Widget cardChild;
    if (walletBalance < rentAmount && effectiveDays <= 3) {
      cardChild = _buildLowBalanceCard(
        isDailyPlan,
        colors,
        amountTextColor: amountTextColor,
        hasPulsatingRedAmountHalo: hasPulsatingRedAmountHalo,
      );
    } else {
      cardChild = _buildNormalCard(
        colors,
        amountTextColor: amountTextColor,
        hasPulsatingRedAmountHalo: hasPulsatingRedAmountHalo,
      );
    }

    if (hasWholeCardRedHalo) {
      return AnimatedGlow(
        color: AppColors.error,
        duration: const Duration(milliseconds: 1800),
        child: cardChild,
      );
    }

    return cardChild;
  }

  Widget _buildLowBalanceCard(
    bool isDailyPlan,
    ThemeColors colors, {
    required Color amountTextColor,
    required bool hasPulsatingRedAmountHalo,
  }) {
    final Color themeColor =
        isDailyPlan ? AppColors.warningForeground : AppColors.error;
    final Color lightBgColor =
        isDailyPlan ? AppColors.warningSurface : AppColors.errorSurface;
    final Color borderColor =
        isDailyPlan ? AppColors.warningBorder : AppColors.errorBorder;

    Widget balanceCounter = AnimatedBalanceCounter(
      value: walletBalance,
      showRupeeSymbol: true,
      compact: true,
      decimalPlaces: 2,
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
              color: colors.surface.withValues(alpha: 0.8),
              borderRadius: BorderRadius.circular(AppRadius.radiusModal),
              border: Border.all(
                  color: borderColor.withValues(alpha: 0.5), width: 2),
              boxShadow: AppShadows.glass,
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
                          compact ? 'TOTAL BALANCE' : 'AVAILABLE BALANCE',
                          style: AppTypography.bodySmall
                              .copyWith(fontWeight: FontWeight.w800)
                              .copyWith(
                                  color: colors.onSurfaceMuted,
                                  letterSpacing: 1.2),
                        ),
                        const SizedBox(height: 8),
                        balanceCounter,
                      ],
                    ),
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: lightBgColor.withValues(alpha: 0.5),
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        border: Border.all(
                            color: borderColor.withValues(alpha: 0.3)),
                      ),
                      child:
                          Icon(Icons.account_balance_wallet, color: themeColor),
                    ),
                  ],
                ),
                SizedBox(height: 20),
                Container(
                  padding: Spacing.paddingMd,
                  decoration: BoxDecoration(
                    color: lightBgColor.withValues(alpha: 0.3),
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border:
                        Border.all(color: borderColor.withValues(alpha: 0.5)),
                  ),
                  child: Row(
                    children: [
                      Icon(Icons.warning_amber_rounded, color: themeColor),
                      SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          'Top Up Now to Ride. Your balance is insufficient. Min top-up: ₹${(requiredPayment > 0 ? requiredPayment : AppConstants.defaultRentalPrice).toInt()}.',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: compact ? 13 : 14,
                            fontWeight: FontWeight.w700,
                            color: themeColor,
                            height: 1.4,
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onTopUp,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: themeColor,
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
                        Text(
                          'Top Up Wallet',
                          style: AppTypography.titleSmall,
                        ),
                        SizedBox(width: 8),
                        Icon(Icons.add_circle_outline, size: 20),
                      ],
                    ),
                  ),
                ),
                SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Rental Recovery Streak',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: compact ? 12 : 14,
                        fontWeight: FontWeight.w600,
                        color: compact
                            ? colors.onSurfaceVariant
                            : colors.onSurface,
                      ),
                    ),
                    Text(
                      '$paymentStreak/5 Days',
                      style: AppTypography.bodyMedium
                          .copyWith(fontSize: 13, fontWeight: FontWeight.w700)
                          .copyWith(color: themeColor),
                    ),
                  ],
                ),
                const SizedBox(height: 10),
                StreakCelebrationBar(
                  streak: paymentStreak,
                  height: compact ? 8 : 10,
                  borderRadius: 4,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildNormalCard(
    ThemeColors colors, {
    required Color amountTextColor,
    required bool hasPulsatingRedAmountHalo,
  }) {
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
                            'TOTAL BALANCE',
                            style: AppTypography.bodySmall
                                .copyWith(fontWeight: FontWeight.w800)
                                .copyWith(
                                    color: colors.onSurfaceMuted,
                                    letterSpacing: 1.2),
                          ),
                          const SizedBox(height: 8),
                          balanceCounter,
                        ],
                      ),
                      Material(
                        color: AppColors.primary,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(AppRadius.lg),
                          onTap: onTopUp,
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
                  SizedBox(height: 20),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Rental Recovery Streak',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: compact ? 12 : 14,
                          fontWeight: FontWeight.w600,
                          color: compact
                              ? colors.onSurfaceVariant
                              : colors.onSurface,
                        ),
                      ),
                      Text(
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
                  SizedBox(height: 16),
                  Text(
                    'A minimum recharge of ₹${requiredPayment > 0 ? requiredPayment.toStringAsFixed(0) : '2000'} is required to proceed further.',
                    style: GoogleFonts.plusJakartaSans(
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
        ));
  }
}
