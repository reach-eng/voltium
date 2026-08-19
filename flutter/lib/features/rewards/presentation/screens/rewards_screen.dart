import 'dart:ui';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class RewardsScreen extends ConsumerStatefulWidget {
  const RewardsScreen({super.key});

  @override
  ConsumerState<RewardsScreen> createState() => _RewardsScreenState();
}

class _RewardsScreenState extends ConsumerState<RewardsScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _pulseCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final points = rider?.totalRewardPoints ?? 0;

    // Tier calculation logic
    final currentTier =
        points < 500 ? 'Bronze' : (points < 2000 ? 'Silver' : 'Gold');
    final nextTierThreshold =
        points < 500 ? 500 : (points < 2000 ? 2000 : 5000);
    final progress = points / nextTierThreshold;
    final pointsToNext = nextTierThreshold - points;

    return Scaffold(
      backgroundColor: AppColors.of(context).iconBackground,
      appBar: AppBar(
        backgroundColor: AppColors.of(context).iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        // T-66: hardcoded English AppBar title. Localised via
        // the existing `txtrewards` ARB key.
        title: Text(AppLocalizations.of(context)!.txtrewards,
            style: GoogleFonts.plusJakartaSans(
                fontWeight: FontWeight.bold,
                color: AppColors.of(context).onSurface)),
        leading: IconButton(
          icon: Icon(Icons.arrow_back,
              color: AppColors.of(context).onSurface, size: 20),
          tooltip: AppLocalizations.of(context)?.txtback ?? 'Back',
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          },
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Dynamic Points Dashboard Card
            Stack(
              children: [
                // Background Glow
                Positioned.fill(
                  child: RepaintBoundary(
                    child: AnimatedBuilder(
                      animation: _pulseCtrl,
                      builder: (context, child) {
                        return Container(
                          decoration: BoxDecoration(
                            borderRadius:
                                BorderRadius.circular(AppRadius.radiusModal),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.accentPurple.withValues(
                                    alpha: 0.2 + (_pulseCtrl.value * 0.15)),
                                blurRadius: 30 + (_pulseCtrl.value * 20),
                                spreadRadius: 2 + (_pulseCtrl.value * 5),
                              )
                            ],
                          ),
                        );
                      },
                    ),
                  ),
                ),
                // Glass Card
                ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.radiusModal),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
                    child: Container(
                      padding: Spacing.paddingLg,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppColors.accentPurple.withValues(alpha: 0.8),
                            AppColors.accentPurple.withValues(alpha: 0.9),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius:
                            BorderRadius.circular(AppRadius.radiusModal),
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.2),
                            width: 1.5),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              // Pulse Star
                              AnimatedBuilder(
                                animation: _pulseCtrl,
                                builder: (context, child) {
                                  return Transform.scale(
                                    scale: 1.0 + (_pulseCtrl.value * 0.1),
                                    child: Container(
                                      padding: Spacing.paddingMd,
                                      decoration: BoxDecoration(
                                        color:
                                            Colors.white.withValues(alpha: 0.2),
                                        shape: BoxShape.circle,
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.white.withValues(
                                                alpha: 0.2 * _pulseCtrl.value),
                                            blurRadius: 10,
                                            spreadRadius: 2,
                                          )
                                        ],
                                      ),
                                      child: const Icon(Icons.star_rounded,
                                          color: Colors.white, size: 40),
                                    ),
                                  );
                                },
                              ),
                              SizedBox(width: 20),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'Total Points',
                                    style: AppTypography.bodyLarge
                                        .copyWith(color: Colors.white70),
                                  ),
                                  Text(
                                    '$points',
                                    style: GoogleFonts.plusJakartaSans(
                                      color: Colors.white,
                                      fontSize: 36,
                                      fontWeight: FontWeight.bold,
                                      letterSpacing: -1,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const SizedBox(height: 24),
                          // Tier Progression
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment:
                                    MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    '$currentTier Tier',
                                    style: AppTypography.bodyMedium
                                        .copyWith(fontWeight: FontWeight.w600)
                                        .copyWith(color: Colors.white),
                                  ),
                                  Text(
                                    '$pointsToNext pts to next',
                                    style: AppTypography.bodySmall
                                        .copyWith(color: Colors.white70),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 8),
                              Stack(
                                children: [
                                  Container(
                                    height: 8,
                                    decoration: BoxDecoration(
                                      color:
                                          Colors.white.withValues(alpha: 0.2),
                                      borderRadius:
                                          BorderRadius.circular(AppRadius.xs),
                                    ),
                                  ),
                                  FractionallySizedBox(
                                    widthFactor: progress.clamp(0.0, 1.0),
                                    child: Container(
                                      height: 8,
                                      decoration: BoxDecoration(
                                        color: Colors.white,
                                        borderRadius:
                                            BorderRadius.circular(AppRadius.xs),
                                        boxShadow: [
                                          BoxShadow(
                                            color: Colors.white
                                                .withValues(alpha: 0.5),
                                            blurRadius: 8,
                                          )
                                        ],
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              ],
            ),
            SizedBox(height: 40),
            Text(
              'Available Rewards',
              style: AppTypography.titleLarge
                  .copyWith(color: AppColors.of(context).onSurface),
            ),
            const SizedBox(height: 24),
            // Custom Empty State
            Center(
              child: Padding(
                padding: const EdgeInsets.symmetric(vertical: 40),
                child: Column(
                  children: [
                    Container(
                      width: 120,
                      height: 120,
                      decoration: BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: [
                          BoxShadow(
                            color: AppColors.slate400.withValues(alpha: 0.1),
                            blurRadius: 24,
                            spreadRadius: 8,
                          )
                        ],
                      ),
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Icon(Icons.card_giftcard_rounded,
                              size: 48,
                              color: AppColors.slate400.withValues(alpha: 0.5)),
                          Positioned(
                            bottom: 24,
                            right: 24,
                            child: Container(
                              padding: const EdgeInsets.all(6),
                              decoration: const BoxDecoration(
                                color: AppColors.accentPurple,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.lock_outline_rounded,
                                  size: 16, color: Colors.white),
                            ),
                          )
                        ],
                      ),
                    ),
                    SizedBox(height: 24),
                    Text(
                      'No rewards unlocked yet',
                      style: AppTypography.titleMedium
                          .copyWith(color: AppColors.of(context).onSurface),
                    ),
                    SizedBox(height: 8),
                    Text(
                      'Keep riding and completing milestones\nto unlock exclusive rewards.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        color: AppColors.of(context).onSurfaceVariant,
                        fontSize: 14,
                        height: 1.5,
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
