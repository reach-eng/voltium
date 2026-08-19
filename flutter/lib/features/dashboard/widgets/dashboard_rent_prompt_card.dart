import 'package:flutter/material.dart';
import '../../../models/upcoming_rent_prompt.dart';
import '../../../theme/app_theme.dart';
import '../../../theme/app_typography.dart';
import '../../../widgets/premium_cards.dart';
import '../../wallet/presentation/screens/top_up_flow.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/haptic_service.dart';

/// Bento card for proactive rent top-up prompt ("Top-up before tomorrow 6 AM").
class DashboardRentPromptCard extends StatelessWidget {
  final UpcomingRentPrompt prompt;

  const DashboardRentPromptCard({
    super.key,
    required this.prompt,
  });

  @override
  Widget build(BuildContext context) {
    if (!prompt.showPrompt) return const SizedBox.shrink();

    final l10n = AppLocalizations.of(context);
    final isShortfall = prompt.requiresTopUp;

    final rentStr = prompt.rentAmountInRupees.toString();
    final balStr = prompt.walletBalanceInRupees.toString();
    final shortStr = prompt.shortfallInRupees.toString();
    final topUpStr = prompt.recommendedTopUpRupees.toString();

    final messageText = isShortfall
        ? (l10n?.txtrentDebitNoticeShortfall(rentStr, balStr, shortStr) ??
            'Rent of ₹$rentStr will be debited automatically. Your current wallet balance is ₹$balStr (shortfall: ₹$shortStr).')
        : (l10n?.txtrentDebitNoticeSufficient(rentStr, balStr) ??
            'Rent of ₹$rentStr will be debited tomorrow 6 AM. Wallet balance ₹$balStr is sufficient.');

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      child: PremiumDoubleBezelCard(
        padding: EdgeInsets.zero,
        child: Container(
          padding: Spacing.paddingLg,
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isShortfall
                  ? const [
                      AppColors.rentPromptBrownStart,
                      AppColors.rentPromptBrownEnd,
                    ]
                  : const [
                      AppColors.rentPromptGreenStart,
                      AppColors.rentPromptGreenEnd,
                    ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadius.radiusModal),
            border: Border.all(
              color: isShortfall
                  ? AppColors.rentPromptOrange.withValues(alpha: 0.4)
                  : AppColors.success.withValues(alpha: 0.4),
              width: 1,
            ),
            boxShadow: AppShadows.glass,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Row(
                    children: [
                      Icon(
                        isShortfall
                            ? Icons.warning_amber_rounded
                            : Icons.check_circle_outline_rounded,
                        color: isShortfall
                            ? AppColors.rentPromptOrange
                            : AppColors.success,
                        size: 22,
                      ),
                      const SizedBox(width: 8),
                      Text(
                        l10n?.txtupcomingRentDebit ?? 'UPCOMING RENT DEBIT',
                        style: AppTypography.labelMedium.copyWith(
                          color: Colors.white70,
                          letterSpacing: 1.0,
                        ),
                      ),
                    ],
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                    decoration: BoxDecoration(
                      color: isShortfall
                          ? AppColors.rentPromptOrange.withValues(alpha: 0.2)
                          : AppColors.success.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                    ),
                    child: Text(
                      prompt.dueTimeFormatted,
                      style: AppTypography.labelSmall.copyWith(
                        color: isShortfall
                            ? AppColors.rentPromptOrangeLight
                            : AppColors.success,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                l10n?.txttopUpBeforeTomorrow6am ?? 'Top-up before tomorrow 6 AM',
                style: AppTypography.headingSmall.copyWith(color: Colors.white),
              ),
              const SizedBox(height: 6),
              Text(
                messageText,
                style: AppTypography.bodyMedium.copyWith(
                  color: Colors.white.withValues(alpha: 0.85),
                ),
              ),
              const SizedBox(height: 16),
              SizedBox(
                width: double.infinity,
                child: ElevatedButton.icon(
                  onPressed: () {
                    HapticService.light();
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => TopUpFlow(
                          initialAmount: prompt.recommendedTopUpRupees,
                        ),
                      ),
                    );
                  },
                  icon: const Icon(Icons.account_balance_wallet_rounded,
                      size: 18),
                  label: Text(
                    l10n?.txttopUpAmountAction(topUpStr) ??
                        'Top up ₹$topUpStr',
                    style: AppTypography.labelLarge
                        .copyWith(fontWeight: FontWeight.bold),
                  ),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: isShortfall
                        ? AppColors.rentPromptOrange
                        : AppColors.primary,
                    foregroundColor: Colors.white,
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
      ),
    );
  }
}
