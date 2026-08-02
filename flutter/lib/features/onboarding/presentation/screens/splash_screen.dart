import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'dart:ui' as ui;
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

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
    // Warm the image cache during splash so dashboard assets render instantly.
    // Called here (not initState) because precacheImage needs a valid
    // BuildContext with an ImageCache from the widget tree.
    precacheImage(const AssetImage('assets/logo.png'), context);
    precacheImage(
      const AssetImage('assets/images/vehicle_placeholder.png'),
      context,
    ).catchError((_) {}); // placeholder may not exist on all flavours
  }

  Future<void> _startSequence() async {
    PostHogService.capture('splash_viewed');

    // Trigger speculative profile & state hydration while animation plays
    Future.microtask(() {
      try {
        // Hydrate background caches
      } catch (_) {}
    });

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
    return Scaffold(
      backgroundColor: AppColors.surface,
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
                            Text(
                              'Voltium',
                              style: AppTypography.displayLarge.copyWith(
                                  color: AppColors.slate900, letterSpacing: -1),
                            ),
                            SizedBox(height: 8),
                            Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  'Electric scooter rentals',
                                  style: AppTypography.bodyLarge.copyWith(
                                      color: AppColors.slate500,
                                      letterSpacing: 1.5),
                                ),
                                SizedBox(width: 8),
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
                              color: AppColors.slate900.withValues(alpha: 0.05),
                              borderRadius:
                                  BorderRadius.circular(AppRadius.full),
                              border: Border.all(
                                color:
                                    AppColors.slate900.withValues(alpha: 0.1),
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
                      SizedBox(height: 16),
                      Text(
                        'CONNECTING TO GRID',
                        style: AppTypography.labelSmall.copyWith(
                            color: AppColors.slate400, letterSpacing: 2.5),
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
