import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';

import 'package:share_plus/share_plus.dart';

class ReferralScreen extends ConsumerStatefulWidget {
  const ReferralScreen({super.key});

  @override
  ConsumerState<ReferralScreen> createState() => _ReferralScreenState();
}

class _ReferralScreenState extends ConsumerState<ReferralScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _glowCtrl;
  bool _isCopied = false;
  // PR-8 (2026-08-06 fix-plan; 14th audit P0-7): the code used to fall back
  // to a fake 'VOLTIUM-XXXX' placeholder that riders could actually share.
  // Now nullable — resolved from rider cache, else fetched from the singular
  // GET /api/rider/referral endpoint, else a skeleton + retry.
  String? _fetchedReferralCode;
  bool _fetchingCode = false;
  bool _fetchFailed = false;

  @override
  void initState() {
    super.initState();
    _glowCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    )..repeat(reverse: true);
    // Fire the lazy fetch so a rider without a cached code still gets one.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final code = ref.read(riderProvider).rider?.referralCode;
      if (code == null || code.isEmpty) _fetchReferralCode();
    });
  }

  @override
  void dispose() {
    _glowCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchReferralCode() async {
    if (_fetchingCode) return;
    setState(() {
      _fetchingCode = true;
      _fetchFailed = false;
    });
    try {
      final data = await VoltiumApiService().get('/api/rider/referral');
      final code = data['data']?['referralCode'] as String?;
      if (mounted) {
        setState(() {
          _fetchedReferralCode = (code == null || code.isEmpty) ? null : code;
          _fetchingCode = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          _fetchingCode = false;
          _fetchFailed = true;
        });
      }
    }
  }

  void _copyToClipboard(String code) async {
    await HapticFeedback.heavyImpact();
    Clipboard.setData(ClipboardData(text: code));
    PostHogService.capture('referral_shared', properties: {'method': 'copy'});
    setState(() => _isCopied = true);

    if (mounted) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Row(
            children: [
              const Icon(Icons.check_circle_rounded, color: Colors.white),
              SizedBox(width: 12),
              Text(
                'Referral code copied!',
                style: GoogleFonts.plusJakartaSans(fontWeight: FontWeight.w600),
              ),
            ],
          ),
          backgroundColor: AppColors.success,
          behavior: SnackBarBehavior.floating,
          shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(AppRadius.md)),
        ),
      );
    }

    Future.delayed(const Duration(seconds: 3), () {
      if (mounted) setState(() => _isCopied = false);
    });
  }

  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    // PR-8: nullable — never render a fake placeholder code.
    final referralCode = rider?.referralCode ?? _fetchedReferralCode;
    final hasValidCode = referralCode != null && referralCode.isNotEmpty;
    // PR-8: no code yet → skeleton (also covers the fetched-but-null case).
    final showSkeleton = !hasValidCode;

    return Scaffold(
      backgroundColor: AppColors.of(context).iconBackground,
      appBar: AppBar(
        backgroundColor: AppColors.of(context).iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: Text(
            // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded English
            // AppBar title. New `txtreferAndEarn` ARB key.
            AppLocalizations.of(context)!.txtreferAndEarn,
            style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.bold,
                color: AppColors.of(context).onSurface)),
        leadingWidth: 68,
        leading: Padding(
          padding: const EdgeInsets.only(left: 20),
          child: UnconstrainedBox(
            child: GestureDetector(
              onTap: () {
                if (Navigator.canPop(context)) {
                  Navigator.pop(context);
                }
              },
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4))
                  ],
                ),
                child: Icon(Icons.arrow_back,
                    color: AppColors.of(context).onSurface, size: 20),
              ),
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          children: [
            Container(
              padding: Spacing.paddingXl,
              width: double.infinity,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.radiusModal),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.05),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                children: [
                  // Hero Graphic
                  Stack(
                    alignment: Alignment.center,
                    children: [
                      RepaintBoundary(
                        child: AnimatedBuilder(
                          animation: _glowCtrl,
                          builder: (context, child) {
                            return Container(
                              width: 100,
                              height: 100,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: AppColors.success.withValues(
                                        alpha: 0.1 + (_glowCtrl.value * 0.15)),
                                    blurRadius: 20 + (_glowCtrl.value * 10),
                                    spreadRadius: _glowCtrl.value * 5,
                                  )
                                ],
                              ),
                            );
                          },
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.all(Spacing.md),
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            colors: [
                              AppColors.of(context).successLight,
                              AppColors.success.withValues(alpha: 0.2),
                            ],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.people_alt_rounded,
                            color: AppColors.success, size: 56),
                      ),
                    ],
                  ),
                  SizedBox(height: 32),
                  Text(
                    'Invite Friends,\nEarn Rewards!',
                    textAlign: TextAlign.center,
                    style: AppTypography.headingLarge.copyWith(
                        color: AppColors.of(context).onSurface,
                        height: 1.2,
                        letterSpacing: -0.5),
                  ),
                  SizedBox(height: 16),
                  Text(
                    'Share your referral code with friends and you both get 50 bonus points when they take their first ride.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.plusJakartaSans(
                      color: AppColors.of(context).onSurfaceVariant,
                      fontSize: 15,
                      height: 1.6,
                    ),
                  ),
                  SizedBox(height: 40),
                  Text(
                    'YOUR REFERRAL CODE',
                    style: AppTypography.labelMedium.copyWith(
                        color: AppColors.slate400, letterSpacing: 1.5),
                  ),
                  const SizedBox(height: 12),
                  // PR-8: skeleton + retry when the code hasn't resolved yet —
                  // never a fabricated placeholder.
                  if (showSkeleton)
                    _ReferralCodeSkeleton(
                      onRetry: _fetchReferralCode,
                      showRetry: _fetchFailed,
                    )
                  else
                    // Interactive Code Box with Dashed Border Simulation
                    GestureDetector(
                      onTap: hasValidCode
                          ? () => _copyToClipboard(referralCode)
                          : null,
                      child: AnimatedContainer(
                        duration: const Duration(milliseconds: 300),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 24, vertical: 20),
                        decoration: BoxDecoration(
                          color: _isCopied
                              ? AppColors.of(context).successLight
                              : AppColors.of(context).iconBackground,
                          borderRadius: BorderRadius.circular(AppRadius.lg),
                          border: Border.all(
                            color: _isCopied
                                ? AppColors.success
                                : AppColors.primary.withValues(alpha: 0.3),
                            width: 2,
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              referralCode,
                              style: GoogleFonts.ibmPlexMono(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: _isCopied
                                    ? AppColors.success
                                    : AppColors.primary,
                                letterSpacing: 2,
                              ),
                            ),
                            const SizedBox(width: 20),
                            AnimatedSwitcher(
                              duration: const Duration(milliseconds: 300),
                              child: Icon(
                                _isCopied
                                    ? Icons.check_circle_rounded
                                    : Icons.copy_rounded,
                                key: ValueKey(_isCopied),
                                color: _isCopied
                                    ? AppColors.success
                                    : AppColors.primary,
                                size: 24,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  const SizedBox(height: 40),
                  // Gradient Share Button
                  Container(
                    width: double.infinity,
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [AppColors.primary, AppColors.indigoVivid],
                        begin: Alignment.centerLeft,
                        end: Alignment.centerRight,
                      ),
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.primary.withValues(alpha: 0.3),
                          blurRadius: 15,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        onTap: () {
                          HapticFeedback.lightImpact();
                          if (!hasValidCode) {
                            ScaffoldMessenger.of(context).showSnackBar(
                              SnackBar(
                                content: Text(
                                  'Referral code generating...',
                                  style: GoogleFonts.plusJakartaSans(
                                      fontWeight: FontWeight.w600,
                                      color: Colors.white),
                                ),
                                backgroundColor:
                                    AppColors.of(context).onSurface,
                                behavior: SnackBarBehavior.floating,
                                shape: RoundedRectangleBorder(
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.md)),
                              ),
                            );
                            return;
                          }
                          Share.share(
                            'Join Voltium EV Mobility! Use my referral code $referralCode to earn bonus reward points on your first ride: https://voltium.app/ref/$referralCode',
                            subject: 'Voltium Referral Code',
                          );
                        },
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        child: Padding(
                          padding: const EdgeInsets.symmetric(vertical: 18),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              const Icon(Icons.share_rounded,
                                  color: Colors.white, size: 20),
                              SizedBox(width: 12),
                              Text(
                                'Share Code',
                                style: AppTypography.titleSmall
                                    .copyWith(color: Colors.white),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// PR-8: shown while the referral code is loading (or after a failed fetch)
/// instead of a fake 'VOLTIUM-XXXX' placeholder. Retry re-hits the singular
/// GET /api/rider/referral endpoint.
class _ReferralCodeSkeleton extends StatelessWidget {
  final VoidCallback onRetry;
  final bool showRetry;
  const _ReferralCodeSkeleton({
    required this.onRetry,
    this.showRetry = false,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      decoration: BoxDecoration(
        color: AppColors.of(context).iconBackground,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.2),
          width: 2,
        ),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Container(
            width: 160,
            height: 28,
            decoration: BoxDecoration(
              color: AppColors.slate400.withValues(alpha: 0.25),
              borderRadius: BorderRadius.circular(6),
            ),
          ),
          const SizedBox(height: 12),
          if (showRetry)
            TextButton.icon(
              key: const Key('referralCodeRetry'),
              onPressed: onRetry,
              icon: const Icon(Icons.refresh_rounded, size: 16),
              label: Text(
                'Could not load code — tap to retry',
                style: GoogleFonts.plusJakartaSans(
                  color: AppColors.of(context).onSurfaceVariant,
                  fontSize: 13,
                ),
              ),
            )
          else
            Text(
              'Loading your referral code…',
              style: GoogleFonts.plusJakartaSans(
                color: AppColors.of(context).onSurfaceVariant,
                fontSize: 13,
              ),
            ),
        ],
      ),
    );
  }
}
