import 'package:flutter/material.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

class PickupSuccessScreen extends StatefulWidget {
  final VoidCallback onFinish;

  const PickupSuccessScreen({super.key, required this.onFinish});

  @override
  State<PickupSuccessScreen> createState() => _PickupSuccessScreenState();
}

class _PickupSuccessScreenState extends State<PickupSuccessScreen> {
  @override
  void initState() {
    super.initState();
    PostHogService.capture('pickup_completed');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.primary,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Spacing.xl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              Container(
                width: 140,
                height: 140,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.electric_moped_rounded,
                  color: AppColors.primary,
                  size: 80,
                ),
              ),
              SizedBox(height: 48),
              Text(
                'You\'re Live!',
                textAlign: TextAlign.center,
                style: AppTypography.displayLarge
                    .copyWith(color: Colors.white, letterSpacing: -1),
              ),
              SizedBox(height: 16),
              Text(
                'Everything is synced. Your vehicle is ready and your dashboard is now live. Enjoy your ride!',
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 18,
                  color: Colors.white70,
                  height: 1.5,
                ),
              ),
              const Spacer(),
              ElevatedButton(
                onPressed: widget.onFinish,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.primary,
                ),
                // LANGUAGE-AUDIT (2026-08-16) T-66: hardcoded
                // English button label. Localised via the
                // existing `onboarding_goToDashboard` ARB key.
                child: Text(
                    AppLocalizations.of(context)!.onboarding_goToDashboard),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
