import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:share_plus/share_plus.dart';
import '../../../theme/app_theme.dart';
import '../../../widgets/premium_cards.dart';
import 'package:voltium_rider/theme/app_typography.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

/// Reusable referral card with green gradient, code display, and copy/share actions.
class ReferralCard extends StatelessWidget {
  final String referralCode;
  final VoidCallback? onCopy;
  final VoidCallback? onShare;

  const ReferralCard({
    super.key,
    required this.referralCode,
    this.onCopy,
    this.onShare,
  });

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final displayCode = referralCode.isEmpty ? '—' : referralCode;

    return PremiumDoubleBezelCard(
        padding: EdgeInsets.zero,
        child: Container(
          padding: Spacing.paddingMd,
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [AppColors.success, AppColors.successDark],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadius.radiusModal),
            boxShadow: AppShadows.glass,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Container(
                    width: 48,
                    height: 48,
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      borderRadius: BorderRadius.circular(14),
                    ),
                    child: const Icon(
                      Icons.card_giftcard,
                      color: Colors.white,
                      size: 24,
                    ),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n?.txtreferAndEarn ?? 'Refer & Earn',
                          style: AppTypography.titleSmall
                              .copyWith(color: Colors.white),
                        ),
                        Text(
                          l10n?.txtshareCodeWithFriends ??
                              'Share your code with friends',
                          style: AppTypography.bodySmall.copyWith(
                            color: AppColors.of(context).successLight,
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border:
                      Border.all(color: Colors.white.withValues(alpha: 0.2)),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n?.txtyourCode ?? 'YOUR CODE',
                          style: AppTypography.bodySmall
                              .copyWith(fontWeight: FontWeight.w800)
                              .copyWith(
                                color: Colors.white.withValues(alpha: 0.8),
                                letterSpacing: 1.2,
                              ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          displayCode,
                          style: AppTypography.titleSmall.copyWith(
                              color: Colors.white, letterSpacing: 1.0),
                        ),
                      ],
                    ),
                    Row(
                      children: [
                        InkWell(
                          onTap: () {
                            HapticService.light();
                            Clipboard.setData(ClipboardData(text: displayCode));
                            Toast.success(
                              context,
                              l10n?.txtreferralCodeCopied ??
                                  'Referral code copied!',
                            );
                            onCopy?.call();
                          },
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(AppRadius.md),
                            ),
                            child: const Icon(
                              Icons.copy,
                              color: Colors.white,
                              size: 16,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        InkWell(
                          onTap: () {
                            HapticService.light();
                            PostHogService.capture('referral_shared',
                                properties: {'code': displayCode});
                            final shareMsg = l10n
                                    ?.txtshareReferralMessage(displayCode) ??
                                'Use my code $displayCode to join Voltium!';
                            final shareSub = l10n?.txtjoinVoltiumSubject ??
                                'Join Voltium';
                            SharePlus.instance.share(
                              ShareParams(
                                text: shareMsg,
                                subject: shareSub,
                              ),
                            );
                            onShare?.call();
                          },
                          child: Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: Colors.white.withValues(alpha: 0.2),
                              borderRadius: BorderRadius.circular(AppRadius.md),
                            ),
                            child: const Icon(
                              Icons.share,
                              color: Colors.white,
                              size: 16,
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
        ));
  }
}
