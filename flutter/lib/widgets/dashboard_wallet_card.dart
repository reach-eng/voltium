import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

/// Reusable wallet card used across dashboard screens.
/// Supports a low-balance warning variant and a normal variant.
class WalletCard extends StatelessWidget {
  final double walletBalance;
  final double requiredPayment;
  final int paymentStreak;
  final String? currentPlan;
  final VoidCallback? onTopUp;
  final bool compact;

  const WalletCard({
    super.key,
    required this.walletBalance,
    required this.requiredPayment,
    required this.paymentStreak,
    this.currentPlan,
    this.onTopUp,
    this.compact = false,
  });

  @override
  Widget build(BuildContext context) {
    final bool isLowBalance = walletBalance < (0.25 * requiredPayment);
    final bool isDailyPlan =
        currentPlan?.toLowerCase().contains('daily') ?? false;

    if (isLowBalance) {
      return _buildLowBalanceCard(isDailyPlan);
    }
    return _buildNormalCard();
  }

  Widget _buildLowBalanceCard(bool isDailyPlan) {
    final Color themeColor =
        isDailyPlan ? AppColors.warning : AppColors.error;
    final Color lightBgColor =
        isDailyPlan ? const Color(0xFFFFFBEB) : const Color(0xFFFEF2F2);
    final Color borderColor =
        isDailyPlan ? const Color(0xFFFDE68A) : const Color(0xFFFECACA);

    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(28),
        border: Border.all(color: borderColor, width: 2),
        boxShadow: [
          BoxShadow(
            color: themeColor.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
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
                    style: TextStyle(
                      fontSize: compact ? 9 : 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate500,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '₹${walletBalance.floor()}',
                        style: TextStyle(
                          fontSize: compact ? 28 : 32,
                          fontWeight: FontWeight.w800,
                          color: themeColor,
                        ),
                      ),
                      Text(
                        '.${((walletBalance % 1) * 100).toInt().toString().padLeft(2, '0')}',
                        style: const TextStyle(
                          fontSize: 18,
                          fontWeight: FontWeight.w700,
                          color: AppColors.slate400,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: lightBgColor,
                  borderRadius: BorderRadius.circular(16),
                ),
                child: Icon(Icons.account_balance_wallet, color: themeColor),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: lightBgColor,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: borderColor),
            ),
            child: Row(
              children: [
                Icon(Icons.warning_amber_rounded, color: themeColor),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    'Top Up Now to Ride. Your\nbalance is insufficient.',
                    style: TextStyle(
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
              onPressed: onTopUp,
              style: ElevatedButton.styleFrom(
                backgroundColor: themeColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 16),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(16),
                ),
                elevation: 0,
              ),
              child: const Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text('Top Up Wallet',
                    style: TextStyle(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                  SizedBox(width: 8),
                  Icon(Icons.add_circle_outline, size: 20),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildNormalCard() {
    return Container(
      padding: const EdgeInsets.all(20),
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
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    compact ? 'TOTAL BALANCE' : 'TOTAL BALANCE',
                    style: TextStyle(
                      fontSize: compact ? 9 : 11,
                      fontWeight: FontWeight.w800,
                      color: AppColors.slate500,
                      letterSpacing: 1.0,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    '₹${walletBalance.toStringAsFixed(0)}',
                    style: TextStyle(
                      fontSize: compact ? 28 : 32,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF1E293B),
                    ),
                  ),
                ],
              ),
              Material(
                color: AppColors.primary,
                borderRadius: BorderRadius.circular(16),
                child: InkWell(
                  borderRadius: BorderRadius.circular(16),
                  onTap: onTopUp,
                  child: Container(
                    width: 48,
                    height: 48,
                    alignment: Alignment.center,
                    child: const Icon(Icons.add, color: Colors.white, size: 24),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 20),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Rental Recovery Streak',
                style: TextStyle(
                  fontSize: compact ? 12 : 14,
                  fontWeight: FontWeight.w600,
                  color: compact
                      ? const Color(0xFF475569)
                      : const Color(0xFF1E293B),
                ),
              ),
              Text(
                '$paymentStreak/5 Days',
                style: const TextStyle(
                  fontSize: 13,
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Row(
            children: List.generate(
              5,
              (i) => Expanded(
                child: Container(
                  height: 8,
                  margin: EdgeInsets.only(right: i < 4 ? (compact ? 4 : 6) : 0),
                  decoration: BoxDecoration(
                    color: i < paymentStreak
                        ? AppColors.success
                        : AppColors.iconBackground,
                    borderRadius: BorderRadius.circular(4),
                  ),
                ),
              ),
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'A minimum recharge of ₹${requiredPayment > 0 ? requiredPayment.toStringAsFixed(0) : '2000'} is required to proceed further.',
            style: TextStyle(
              fontSize: compact ? 10 : 12,
              fontWeight: FontWeight.w500,
              color: AppColors.slate500,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
