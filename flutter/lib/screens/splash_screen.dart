import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// Matches web SplashScreen.tsx exactly:
/// - bg #f7f9fb with ambient top glow
/// - White logo card 96x96 rounded-[28] with shadow, animated rotate+scale in
/// - "Welcome to Voltium!" title (28px bold, #191c1e)
/// - Subtitle (15px, #424653)
/// - 3px gradient loading bar at bottom (#0053c1 → #2f6dde)
/// - "Loading experience..." label (12px, #737785)
class SplashScreen extends StatefulWidget {
  final VoidCallback onComplete;

  const SplashScreen({super.key, required this.onComplete});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen>
    with TickerProviderStateMixin {
  // Logo: scale 0.7→1.0 + rotate -20°→0° (matches framer-motion initial)
  late final AnimationController _logoCtrl;
  late final Animation<double> _logoScale;
  late final Animation<double> _logoRotation;

  // Content: fade+slide up (opacity 0→1, y 20→0)
  late final AnimationController _contentCtrl;
  late final Animation<double> _contentOpacity;
  late final Animation<double> _contentSlide;

  // Subtitle delayed slightly
  late final AnimationController _subtitleCtrl;
  late final Animation<double> _subtitleOpacity;
  late final Animation<double> _subtitleSlide;

  // Loading bar: width 0→1.0 over 2s; appears after 1s delay
  late final AnimationController _barCtrl;
  late final Animation<double> _barWidth;
  late final Animation<double> _barOpacity;

  @override
  void initState() {
    super.initState();

    // Logo: 0.8s, delay 0.2s (matches web 0.7s + 0.2s delay)
    _logoCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _logoScale = Tween<double>(begin: 0.7, end: 1.0).animate(
      CurvedAnimation(parent: _logoCtrl, curve: Curves.easeOutCubic),
    );
    _logoRotation = Tween<double>(begin: -0.349, end: 0.0).animate(
      // -20° in radians
      CurvedAnimation(parent: _logoCtrl, curve: Curves.easeOutCubic),
    );

    // Title: 600ms, delay 0.5s
    _contentCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _contentOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _contentCtrl, curve: Curves.easeIn),
    );
    _contentSlide = Tween<double>(begin: 12.0, end: 0.0).animate(
      CurvedAnimation(parent: _contentCtrl, curve: Curves.easeOutCubic),
    );

    // Subtitle: 600ms, delay 0.7s
    _subtitleCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _subtitleOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _subtitleCtrl, curve: Curves.easeIn),
    );
    _subtitleSlide = Tween<double>(begin: 8.0, end: 0.0).animate(
      CurvedAnimation(parent: _subtitleCtrl, curve: Curves.easeOutCubic),
    );

    // Bar: 2s fill, starts at delay 1.0s; opacity fades in at 1.2s
    _barCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    );
    _barWidth = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _barCtrl, curve: Curves.linear),
    );
    _barOpacity = Tween<double>(begin: 0.0, end: 1.0).animate(
      CurvedAnimation(parent: _barCtrl, curve: const Interval(0.0, 0.3, curve: Curves.easeIn)),
    );

    _startSequence();
  }

  Future<void> _startSequence() async {
    await Future.delayed(const Duration(milliseconds: 200));
    if (!mounted) return;
    _logoCtrl.forward();

    await Future.delayed(const Duration(milliseconds: 500));
    if (!mounted) return;
    _contentCtrl.forward();

    await Future.delayed(const Duration(milliseconds: 200));
    if (!mounted) return;
    _subtitleCtrl.forward();

    await Future.delayed(const Duration(milliseconds: 300));
    if (!mounted) return;
    _barCtrl.forward();

    // Total: ~2.5s before navigation
    await Future.delayed(const Duration(milliseconds: 1300));
    if (mounted) widget.onComplete();
  }

  @override
  void dispose() {
    _logoCtrl.dispose();
    _contentCtrl.dispose();
    _subtitleCtrl.dispose();
    _barCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface, // #f7f9fb
      body: Stack(
        children: [
          // Ambient glow — top-center blue haze (matches web)
          Positioned(
            top: -80,
            left: -100,
            right: -100,
            height: 400,
            child: Container(
              decoration: BoxDecoration(
                gradient: RadialGradient(
                  colors: [
                    AppColors.primary.withOpacity(0.06),
                    Colors.transparent,
                  ],
                  radius: 0.7,
                  center: const Alignment(0.0, -0.2),
                ),
              ),
            ),
          ),

          // Main content
          SafeArea(
            child: Column(
              children: [
                const Spacer(flex: 3),

                // Logo + title + subtitle
                AnimatedBuilder(
                  animation: Listenable.merge([_logoCtrl, _contentCtrl, _subtitleCtrl]),
                  builder: (context, _) {
                    return Column(
                      children: [
                        // Logo card — white, 96x96, rounded-28, shadow
                        Transform.scale(
                          scale: _logoScale.value,
                          child: Transform.rotate(
                            angle: _logoRotation.value,
                            child: Container(
                              width: 96,
                              height: 96,
                              decoration: BoxDecoration(
                                color: Colors.white,
                                borderRadius: BorderRadius.circular(28),
                                boxShadow: AppShadows.logoContainer,
                              ),
                              child: Center(
                                child: Image.asset(
                                  'assets/logo.png',
                                  width: 64,
                                  height: 64,
                                  color: AppColors.primary,
                                  colorBlendMode: BlendMode.srcIn,
                                  errorBuilder: (_, __, ___) => const Icon(
                                    Icons.bolt,
                                    color: AppColors.primary,
                                    size: 48,
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 24),

                        // Title: "Welcome to Voltium!"
                        Opacity(
                          opacity: _contentOpacity.value,
                          child: Transform.translate(
                            offset: Offset(0, _contentSlide.value),
                            child: Text(
                              'Welcome to Voltium!',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.inter(
                                fontSize: 28,
                                fontWeight: FontWeight.w700,
                                color: AppColors.onSurfaceAlt, // #191c1e
                                letterSpacing: -0.5,
                                height: 1.2,
                              ),
                            ),
                          ),
                        ),

                        const SizedBox(height: 12),

                        // Subtitle
                        Opacity(
                          opacity: _subtitleOpacity.value,
                          child: Transform.translate(
                            offset: Offset(0, _subtitleSlide.value),
                            child: SizedBox(
                              width: 280,
                              child: Text(
                                'Voltium — Ride smart, ride green.',
                                textAlign: TextAlign.center,
                                style: GoogleFonts.inter(
                                  fontSize: 15,
                                  fontWeight: FontWeight.w400,
                                  color: AppColors.onSurfaceVariant, // #424653
                                  height: 1.6,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ],
                    );
                  },
                ),

                const Spacer(flex: 3),

                // Loading bar + label — bottom of screen
                AnimatedBuilder(
                  animation: _barCtrl,
                  builder: (context, _) {
                    return Opacity(
                      opacity: _barOpacity.value,
                      child: Padding(
                        padding: const EdgeInsets.only(bottom: 64),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            // 3px progress bar, 200px wide
                            SizedBox(
                              width: 200,
                              height: 3,
                              child: ClipRRect(
                                borderRadius: BorderRadius.circular(9999),
                                child: Stack(
                                  children: [
                                    // Track
                                    Container(color: AppColors.divider),
                                    // Fill
                                    FractionallySizedBox(
                                      alignment: Alignment.centerLeft,
                                      widthFactor: _barWidth.value,
                                      child: Container(
                                        decoration: const BoxDecoration(
                                          gradient: AppGradients.loadingBar,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 12),
                            Text(
                              'Loading experience...',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: AppColors.onSurfaceMuted, // #737785
                                fontWeight: FontWeight.w400,
                                letterSpacing: 0.3,
                              ),
                            ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
