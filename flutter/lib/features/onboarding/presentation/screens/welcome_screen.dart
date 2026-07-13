import 'package:flutter/material.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class WelcomeScreen extends StatefulWidget {
  final VoidCallback onContinue;

  const WelcomeScreen({super.key, required this.onContinue});

  @override
  State<WelcomeScreen> createState() => _WelcomeScreenState();
}

class _WelcomeScreenState extends State<WelcomeScreen> {
  bool _agreedToTerms = false;

  Future<void> _requestPermissionsAndContinue() async {
    // Request critical permissions silently before moving to login
    await [
      Permission.location,
      Permission.camera,
    ].request();

    widget.onContinue();
  }

  void _showConsentBottomSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => StatefulBuilder(
        builder: (BuildContext context, StateSetter setModalState) {
          return Container(
            decoration: const BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
            ),
            padding: const EdgeInsets.all(24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  'Before we start',
                  style: AppTypography.headingMedium
                      .copyWith(color: AppColors.onSurface),
                ),
                SizedBox(height: 16),
                Text(
                  'To provide you with the best experience, Voltium needs access to your Location (to find nearby hubs) and Camera (for document uploads).',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 16,
                    color: AppColors.onSurfaceVariant,
                    height: 1.5,
                  ),
                ),
                const SizedBox(height: 24),
                Semantics(
                  label: 'Agree to Terms of Service and Privacy Policy',
                  checked: _agreedToTerms,
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SizedBox(
                        height: 24,
                        width: 24,
                        child: Checkbox(
                          key: const Key('acceptCheckbox'),
                          value: _agreedToTerms,
                          activeColor: AppColors.primary,
                          onChanged: (val) {
                            setModalState(() {
                              _agreedToTerms = val ?? false;
                            });
                          },
                        ),
                      ),
                      SizedBox(width: 12),
                      Expanded(
                        child: GestureDetector(
                          onTap: () {
                            setModalState(() {
                              _agreedToTerms = !_agreedToTerms;
                            });
                          },
                          child: ExcludeSemantics(
                            child: Text.rich(
                              TextSpan(
                                text: 'I agree to the ',
                                style: GoogleFonts.plusJakartaSans(
                                    color: AppColors.onSurfaceVariant,
                                    fontSize: 14),
                                children: [
                                  TextSpan(
                                    text: 'Terms of Service',
                                    style: GoogleFonts.plusJakartaSans(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.bold,
                                    ),
                                  ),
                                  TextSpan(text: ' and '),
                                  TextSpan(
                                    text: 'Privacy Policy',
                                    style: GoogleFonts.plusJakartaSans(
                                      color: AppColors.primary,
                                      fontWeight: FontWeight.bold,
                                    ),
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
                SizedBox(height: 32),
                ElevatedButton(
                  key: const Key('continuePermissionsButton'),
                  onPressed: _agreedToTerms
                      ? () {
                          Navigator.pop(ctx);
                          _requestPermissionsAndContinue();
                        }
                      : null,
                  style: ElevatedButton.styleFrom(
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor:
                        AppColors.onSurface.withValues(alpha: 0.12),
                  ),
                  child: Text(
                    'Continue',
                    style:
                        AppTypography.titleSmall.copyWith(color: Colors.white),
                  ),
                ),
                const SizedBox(height: 16),
              ],
            ),
          );
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Stack(
        children: [
          // Background Gradient or Image
          Container(
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.primaryCyan, AppColors.primaryGradientEnd],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
            ),
          ),
          SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.end,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const Icon(
                    Icons.bolt,
                    color: Colors.white,
                    size: 64,
                  ),
                  SizedBox(height: 24),
                  Text(
                    'Welcome to Voltium',
                    style: AppTypography.displayLarge.copyWith(
                        color: Colors.white, height: 1.1, letterSpacing: -1),
                  ),
                  SizedBox(height: 16),
                  Text(
                    'Your smart electric mobility companion. Ride greener, ride smarter.',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 18,
                      color: Colors.white70,
                      height: 1.4,
                    ),
                  ),
                  SizedBox(height: 48),
                  ElevatedButton(
                    key: const Key('getStartedButton'),
                    onPressed: () => _showConsentBottomSheet(context),
                    style: ElevatedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 18),
                      backgroundColor: Colors.white,
                      foregroundColor: AppColors.primary,
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 8,
                      shadowColor: Colors.black.withValues(alpha: 0.3),
                    ),
                    child: Text(
                      'Get Started',
                      style: AppTypography.titleMedium,
                    ),
                  ),
                  const SizedBox(height: 24),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
