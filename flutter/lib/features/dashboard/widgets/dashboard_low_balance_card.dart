import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../theme/app_theme.dart';
import '../../../theme/app_typography.dart';
import '../../../utils/app_constants.dart';
import '../../../widgets/animated_balance_counter.dart';
import '../../../widgets/effect_widgets.dart';
import '../../../widgets/premium_cards.dart';
import '../../../widgets/streak_celebration_bar.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/haptic_service.dart';

/// Low-balance warning variant of the wallet card.
class DashboardLowBalanceCard extends StatelessWidget {
  final double walletBalance;
  final double requiredPayment;
  final int paymentStreak;
  final bool isDailyPlan;
  final VoidCallback? onTopUp;
  final bool compact;
  final ThemeColors colors;
  final Color amountTextColor;
  final bool hasPulsatingRedAmountHalo;

  const DashboardLowBalanceCard({
    super.key,
    required this.walletBalance,
    required this.requiredPayment,
    required this.paymentStreak,
    required this.isDailyPlan,
    this.onTopUp,
    this.compact = false,
    required this.colors,
    required this.amountTextColor,
    required this.hasPulsatingRedAmountHalo,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final minTopUp = (requiredPayment > 0
            ? requiredPayment
            : AppConstants.defaultRentalPrice)
        .toInt();

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final Color themeColor = isDailyPlan
        ? (isDark ? colors.warningLightForeground : AppColors.warningForeground)
        : (isDark ? colors.errorLightForeground : AppColors.error);
    final Color lightBgColor =
        isDailyPlan ? colors.warningLight : colors.errorLight;
    final Color borderColor =
        isDailyPlan ? colors.warning : colors.error;

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

    final balanceLabel = compact
        ? (l10n?.txttotalBalance ?? 'TOTAL BALANCE')
        : (l10n?.txtavailableBalance ?? 'AVAILABLE BALANCE');

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
                          balanceLabel,
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
                const SizedBox(height: 20),
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
                      const SizedBox(width: 12),
                      Expanded(
                        child: Text(
                          l10n?.txtlowBalanceWarningNotice(minTopUp) ??
                              'Top Up Now to Ride. Your balance is insufficient. Min top-up: ₹$minTopUp.',
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
                const SizedBox(height: 20),
                SizedBox(
                  width: double.infinity,
                  child: ElevatedButton(
                    onPressed: onTopUp != null
                        ? () {
                            HapticService.light();
                            onTopUp!();
                          }
                        : null,
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
                          l10n?.txttopUpWalletAction ?? 'Top Up Wallet',
                          style: AppTypography.titleSmall,
                        ),
                        const SizedBox(width: 8),
                        const Icon(Icons.add_circle_outline, size: 20),
                      ],
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      l10n?.txtrentalRecoveryStreak ?? 'Rental Recovery Streak',
                      style: GoogleFonts.plusJakartaSans(
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
}
