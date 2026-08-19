import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

class PlanSuccessScreen extends StatelessWidget {
  final VoidCallback onNext;

  const PlanSuccessScreen({super.key, required this.onNext});

  @override
  Widget build(BuildContext context) {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      PostHogService.capture('plan_purchased');
    });
    return Scaffold(
      backgroundColor: AppColors.success,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(Spacing.xl),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Spacer(),
              Container(
                width: 120,
                height: 120,
                decoration: const BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.check_rounded,
                  color: AppColors.success,
                  size: 80,
                ),
              ),
              SizedBox(height: 40),
              Text(
                'Subscription Confirmed!',
                textAlign: TextAlign.center,
                style: AppTypography.headingMedium
                    .copyWith(color: Colors.white, letterSpacing: -1),
              ),
              SizedBox(height: 16),
              Text(
                'Your plan is now active. You can now proceed to the nearest hub to pick up your vehicle.',
                textAlign: TextAlign.center,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 18,
                  color: Colors.white,
                  height: 1.5,
                ),
              ),
              const Spacer(),
              ElevatedButton(
                onPressed: onNext,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.white,
                  foregroundColor: AppColors.success,
                ),
                // T-66: hardcoded English button label. Localised
                // via the existing `onboarding_proceedToPickup`
                // ARB key.
                child: Text(
                    AppLocalizations.of(context)!.onboarding_proceedToPickup),
              ),
              const SizedBox(height: 32),
            ],
          ),
        ),
      ),
    );
  }
}
