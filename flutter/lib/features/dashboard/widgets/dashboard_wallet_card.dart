import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';
import '../../../utils/app_constants.dart';
import '../../../widgets/effect_widgets.dart';
import 'dashboard_low_balance_card.dart';
import 'dashboard_normal_wallet_card.dart';

/// Thin dispatcher wallet card for rider dashboard.
/// Delegates rendering to [DashboardLowBalanceCard] or [DashboardNormalWalletCard].
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
    final hasActivePlan = planEndDate != null;
    final daysUntilDue =
        hasActivePlan ? planEndDate!.difference(now).inDays : null;
    final double rentAmount =
        requiredPayment > 0 ? requiredPayment : AppConstants.defaultRentalPrice;
    // P1: without an active plan there is no due date, so plan-less riders
    // with an empty wallet always saw the calm Normal card with no
    // actionable prompt — yet they still need funds (deposit/plan).
    // They get the Low card, but WITHOUT the infinite pulsating halo
    // (that urgency signal stays plan-gated to due dates): the halo
    // below still keys off isDueSoon only.
    final bool isDueSoon = hasActivePlan && (daysUntilDue! <= 3);
    final bool showLowCard =
        walletBalance < rentAmount && (isDueSoon || !hasActivePlan);
    final bool isCriticalDue = hasActivePlan && (daysUntilDue! <= 1);

    final bool hasPulsatingRedAmountHalo =
        (walletBalance < rentAmount) && isDueSoon;

    final Color amountTextColor =
        (walletBalance >= rentAmount) ? colors.success : colors.warning;

    final bool hasWholeCardRedHalo =
        (walletBalance < rentAmount) && isCriticalDue;

    final bool isDailyPlan =
        currentPlan?.toLowerCase().contains('daily') ?? false;

    Widget cardChild;
    if (showLowCard) {
      cardChild = DashboardLowBalanceCard(
        walletBalance: walletBalance,
        requiredPayment: requiredPayment,
        paymentStreak: paymentStreak,
        isDailyPlan: isDailyPlan,
        onTopUp: onTopUp,
        compact: compact,
        colors: colors,
        amountTextColor: amountTextColor,
        hasPulsatingRedAmountHalo: hasPulsatingRedAmountHalo,
      );
    } else {
      cardChild = DashboardNormalWalletCard(
        walletBalance: walletBalance,
        requiredPayment: requiredPayment,
        paymentStreak: paymentStreak,
        onTopUp: onTopUp,
        compact: compact,
        colors: colors,
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
}
