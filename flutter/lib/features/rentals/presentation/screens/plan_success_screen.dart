import 'package:flutter/material.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

class PlanSuccessScreen extends StatefulWidget {
  final VoidCallback onNext;

  const PlanSuccessScreen({super.key, required this.onNext});

  @override
  State<PlanSuccessScreen> createState() => _PlanSuccessScreenState();
}

class _PlanSuccessScreenState extends State<PlanSuccessScreen> {
  // AUDIT FIX (MEDIUM): converted from StatelessWidget. The old
  // build()-side `addPostFrameCallback(PostHogService.capture(...))`
  // re-fired the 'plan_purchased' event on EVERY rebuild, corrupting
  // revenue analytics. Captured exactly once here, mirroring
  // RentalDetailsScreen.initState.
  @override
  void initState() {
    super.initState();
    PostHogService.capture('plan_purchased');
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return PopScope(
      // AUDIT FIX (LOW): system back must not leave the post-purchase
      // surface back into plan selection. Verified: the router shell
      // already makes AuthState.planSuccess non-popable and no-ops
      // system back (lib/app/router.dart `_canPop` + `_handleSystemBack`
      // has no planSuccess case). This PopScope is defense-in-depth so
      // hosts outside the router shell (e.g. widget tests) can never
      // pop back past a completed purchase either.
      canPop: false,
      onPopInvokedWithResult: (didPop, result) {},
      child: Scaffold(
        backgroundColor: AppColors.success,
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(Spacing.xl),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Spacer(),
                // AUDIT FIX (LOW): success icon was silent to screen readers.
                Semantics(
                  label: 'Subscription confirmed',
                  child: Container(
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
                  onPressed: widget.onNext,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.success,
                    // AUDIT FIX (LOW): full-width CTA at >=48dp to match
                    // sibling screens' primary buttons.
                    minimumSize: const Size(double.infinity, 52),
                    padding: const EdgeInsets.symmetric(vertical: 18),
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppRadius.radiusModal),
                    ),
                  ),
                  // T-66: hardcoded English button label. Localised
                  // via the existing `onboarding_proceedToPickup`
                  // ARB key.
                  child: Text(l10n.onboarding_proceedToPickup),
                ),
                const SizedBox(height: 32),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
