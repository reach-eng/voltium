import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:ui' as ui;
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';
import 'package:voltium_rider/utils/app_constants.dart';

class SplashScreen extends StatefulWidget {
  final VoidCallback onComplete;

  const SplashScreen({super.key, required this.onComplete});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  late final AnimationController _logoCtrl;
  late final Animation<double> _logoScale;
  late final Animation<double> _logoOpacity;

  late final AnimationController _textCtrl;
  late final Animation<double> _textOpacity;
  late final Animation<double> _textSlide;

  late final AnimationController _barCtrl;
  late final Animation<double> _barWidth;

  @override
  void initState() {
    super.initState();

    _logoCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _logoScale = Tween<double>(begin: 0.5, end: 1.0).animate(
      CurvedAnimation(parent: _logoCtrl, curve: Curves.easeOutCubic),
    );
    _logoOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(
        parent: _logoCtrl,
        curve: const Interval(0.0, 0.5, curve: Curves.easeIn),
      ),
    );

    _textCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _textOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _textCtrl, curve: Curves.easeIn),
    );
    _textSlide = Tween<double>(begin: 20.0, end: 0.0).animate(
      CurvedAnimation(parent: _textCtrl, curve: Curves.easeOutCubic),
    );

    _barCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1500),
    );
    _barWidth = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _barCtrl, curve: Curves.easeInOut),
    );

    _startSequence();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!AppConstants.isTestMode) {
      // PR-47 removed assets/images/* from the bundle — the placeholder image
      // no longer exists, so only the real logo is precached.
      precacheImage(const AssetImage('assets/logo.png'), context)
          .catchError((_) {});
    }
  }

  Future<void> _startSequence() async {
    PostHogService.capture('splash_viewed');

    // PR-VER-2026-08-07 (SPLASH P0): returning riders with a valid session
    // skip the ~3s showcase animation — a 300ms beat is enough to avoid a
    // jarring cut. New / logged-out riders still get the full sequence.
    // SecureStorage throws MissingPluginException in widget tests, so the
    // check is best-effort and defaults to the full animation.
    var hasSession = false;
    try {
      hasSession = await SecureStorageService().isLoggedIn();
    } catch (_) {
      hasSession = false;
    }
    if (hasSession) {
      // ONBOARDING-AUDIT 2026-08-14 P2-12: the previous 300ms
      // fast-path was too short to be useful (rider saw a flash of
      // empty screen on stale-JWT before the 401 hit) and too short
      // to feel intentional. Bumped to 1000ms — a returning rider
      // with a valid session gets routed forward fast, a rider with
      // a stale JWT gets a clear 401 → "session expired" path (see
      // P0-4 in rider_provider.dart). The longer wait is acceptable
      // because the splash animation is part of the brand.
      await Future.delayed(const Duration(milliseconds: 1000));
      if (mounted) widget.onComplete();
      return;
    }

    // ONBOARDING-AUDIT 2026-08-14 P3-3: the previous implementation
    // had an empty `Future.microtask` with a try/catch that did
    // nothing — the comment said "Hydrate background caches" but the
    // body was empty. Deleted; the actual hydration is triggered by
    // the router's `ref.read(riderProvider.notifier).init()` call on
    // the splash `onComplete` callback (router.dart initState).

    await Future.delayed(const Duration(milliseconds: 200));
    if (!mounted) return;
    _logoCtrl.forward();

    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    _textCtrl.forward();

    await Future.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    _barCtrl.forward();

    await Future.delayed(const Duration(milliseconds: 2000));
    if (mounted) widget.onComplete();
  }

  @override
  void dispose() {
    _logoCtrl.dispose();
    _textCtrl.dispose();
    _barCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // DARK-MODE-AUDIT 2026-08-14 P0-1: the previous version of this
    // build method used static `AppColors.surface` /
    // `AppColors.slate900` / `AppColors.of(context).onSurfaceVariant` for the scaffold
    // and the wordmark. In dark mode:
    //   - `AppColors.surface` (#F7F9FB) is the LIGHT surface — the
    //     splash stayed light even when the rest of the app went
    //     dark, which contradicted the user's theme choice.
    //   - `AppColors.slate900` (#0F172A) is identical to
    //     `ThemeColors.dark.surface` — the wordmark and the
    //     loading-bar track were invisible against the dark bg
    //     (1.00:1 contrast).
    // Every color now reads from the brightness-aware theme
    // extension via `AppColors.of(context)`.
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      body: SizedBox(
        width: MediaQuery.of(context).size.width,
        height: MediaQuery.of(context).size.height,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Spacer(flex: 2),
            Column(
              children: [
                AnimatedBuilder(
                  animation: _logoCtrl,
                  builder: (context, _) {
                    return Opacity(
                      opacity: _logoOpacity.value,
                      child: Transform.scale(
                        scale: _logoScale.value,
                        child: Container(
                          width: 128,
                          height: 128,
                          decoration: BoxDecoration(
                            borderRadius: BorderRadius.circular(
                                AppRadius.radiusBottomSheet),
                            boxShadow: [
                              BoxShadow(
                                color: AppColors.primaryLight
                                    .withValues(alpha: 0.15),
                                blurRadius: 40,
                                offset: const Offset(0, 15),
                              ),
                              BoxShadow(
                                color:
                                    AppColors.primary.withValues(alpha: 0.25),
                                blurRadius: 30,
                                spreadRadius: 2,
                                offset: const Offset(0, 8),
                              ),
                            ],
                          ),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(
                                AppRadius.radiusBottomSheet),
                            child: Image.asset(
                              'assets/logo.png',
                              width: 128,
                              height: 128,
                              fit: BoxFit.cover,
                            ),
                          ),
                        ),
                      ),
                    );
                  },
                ),
                SizedBox(height: 32),
                AnimatedBuilder(
                  animation: _textCtrl,
                  builder: (context, _) {
                    return Opacity(
                      opacity: _textOpacity.value,
                      child: Transform.translate(
                        offset: Offset(0, _textSlide.value),
                        child: Column(
                          children: [
                            // LANGUAGE-AUDIT (2026-08-16) #5: brand name
                            // stays as "Voltium" in every locale (it's a
                            // proper noun, not a translation). The
                            // tagline below it is localised via l10n.
                            Text(
                              'Voltium',
                              style: AppTypography.displayLarge.copyWith(
                                  color: colors.onSurface, letterSpacing: -1),
                            ),
                            SizedBox(height: 8),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  AppLocalizations.of(context)
                                          ?.txtsplashTagline ??
                                      'Electric scooter rentals',
                                  style: AppTypography.bodyLarge.copyWith(
                                      color: colors.onSurfaceVariant,
                                      letterSpacing: 1.5),
                                ),
                                const SizedBox(width: 8),
                                Text('⚡',
                                    style: GoogleFonts.plusJakartaSans(
                                        fontSize: 16)),
                              ],
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
            const Spacer(flex: 3),
            AnimatedBuilder(
              animation: _barCtrl,
              builder: (context, _) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 80),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      ClipRRect(
                        borderRadius: BorderRadius.circular(AppRadius.full),
                        child: BackdropFilter(
                          filter: ui.ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                          child: Container(
                            width: 160,
                            height: 6,
                            decoration: BoxDecoration(
                              // DARK-MODE-AUDIT 2026-08-14 P0-2:
                              // the previous version used
                              // `AppColors.slate900.withValues(alpha:
                              // 0.05)` — slate-900 IS the dark
                              // surface, so the track was
                              // invisible in dark mode.
                              // Brightness-aware outline keeps the
                              // pill readable in both modes.
                              color: colors.outline.withValues(alpha: 0.25),
                              borderRadius:
                                  BorderRadius.circular(AppRadius.full),
                              border: Border.all(
                                color: colors.outline,
                                width: 0.5,
                              ),
                            ),
                            child: Stack(
                              children: [
                                FractionallySizedBox(
                                  alignment: Alignment.centerLeft,
                                  widthFactor: _barWidth.value,
                                  child: Container(
                                    decoration: BoxDecoration(
                                      gradient: const LinearGradient(
                                        colors: [
                                          AppColors.primaryLight,
                                          AppColors.accentPurple,
                                        ],
                                      ),
                                      borderRadius:
                                          BorderRadius.circular(AppRadius.full),
                                      boxShadow: [
                                        BoxShadow(
                                          color: AppColors.primaryLight
                                              .withValues(alpha: 0.3),
                                          blurRadius: 8,
                                          offset: const Offset(0, 0),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ),
                      ),
                      const SizedBox(height: 16),
                      // LANGUAGE-AUDIT (2026-08-16) #5: was a hardcoded
                      // English "CONNECTING TO GRID" string. Now
                      // localisable via the existing `txtconnectingToGrid`
                      // ARB key (one of the 475 keys this audit unblocks).
                      Text(
                        AppLocalizations.of(context)?.txtconnectingToGrid ??
                            'CONNECTING TO GRID',
                        style: AppTypography.labelSmall.copyWith(
                            color: colors.onSurfaceMuted, letterSpacing: 2.5),
                      ),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }
}
