import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/theme/app_theme.dart';

import 'package:voltium_rider/core/network/api_error_messages.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class PickupVerificationScreen extends ConsumerStatefulWidget {
  final VoidCallback onNext;
  final VoidCallback? onBack;
  final String hubId;
  final String vehicleId;
  final String emergencyContact;
  final String? teamLeader;

  // PR-PICKUP-OTP: the short-lived HMAC receipt issued by
  // /api/auth/verify-phone on successful emergency-contact OTP verification.
  // Forwarded with the final submit so the server can enforce the OTP gate
  // (signature + 15-min TTL + phone match) instead of trusting the client.
  final String? emergencyContactReceipt;

  final String? pickupPhotoFront;
  final String? pickupPhotoBack;
  final String? pickupPhotoLeft;
  final String? pickupPhotoRight;
  final String? pickupPhotoWithVehicle;

  const PickupVerificationScreen({
    super.key,
    required this.onNext,
    this.onBack,
    required this.hubId,
    required this.vehicleId,
    required this.emergencyContact,
    this.emergencyContactReceipt,
    this.teamLeader,
    this.pickupPhotoFront,
    this.pickupPhotoBack,
    this.pickupPhotoLeft,
    this.pickupPhotoRight,
    this.pickupPhotoWithVehicle,
  });

  @override
  ConsumerState<PickupVerificationScreen> createState() =>
      _PickupVerificationScreenState();
}

class _PickupVerificationScreenState
    extends ConsumerState<PickupVerificationScreen> {
  bool _isLoading = false;
  bool _agreedToTerms = false;

  Future<void> _completePickup() async {
    if (!_agreedToTerms) {
      return;
    }

    setState(() => _isLoading = true);
    // ONBOARDING-AUDIT 2026-08-14 (fix #5a): capture the rider id via
    // `ref.read` BEFORE the await. The previous `ref.watch` inside an
    // async callback registered a dependency on the build that owns
    // this callback and re-triggered the whole method on every rider
    // change — a guaranteed double-POST under flaky connectivity.
    final provider = ref.read(riderProvider.notifier);
    final riderId = ref.read(riderProvider).riderId;

    // ONBOARDING-AUDIT 2026-08-14 (fix #5g): refuse to start a
    // multi-MB upload when the device is offline. The previous
    // behaviour was to let `syncPickup` fail mid-request with a
    // generic snackbar, forcing the rider to retry. Now we surface
    // the offline state up front so the rider doesn't waste a
    // document-upload's worth of network on a request we already
    // know will fail.
    if (!ref.read(connectivityProvider).isOnline) {
      if (mounted) {
        Toast.warning(
          context,
          "You're offline. Connect to the internet and try again.",
        );
        setState(() => _isLoading = false);
      }
      return;
    }

    if (riderId == null) {
      if (mounted) {
        Toast.error(
          context,
          AppLocalizations.of(context)?.txtpleaseLogInAgain ??
              'Please log in again',
        );
        setState(() => _isLoading = false);
      }
      return;
    }

    final onNext = widget.onNext;

    try {
      // PR-13: was a wrapper call to
      // `VoltiumApiService.syncPickup`, a 1-line pass-through to the
      // generated `postRiderSyncPickup({...})` with the same body shape.
      await ref.read(voltiumApiClientProvider).postRiderSyncPickup({
        'vehicleId': widget.vehicleId,
        'hubId': widget.hubId,
        'bookingId': riderId,
        if (widget.teamLeader != null) 'teamLeader': widget.teamLeader!,
        'emergencyContact': widget.emergencyContact,
        if (widget.emergencyContactReceipt != null)
          'emergencyContactReceipt': widget.emergencyContactReceipt!,
        if (widget.pickupPhotoFront != null)
          'pickupPhotoFront': widget.pickupPhotoFront!,
        if (widget.pickupPhotoBack != null)
          'pickupPhotoBack': widget.pickupPhotoBack!,
        if (widget.pickupPhotoLeft != null)
          'pickupPhotoLeft': widget.pickupPhotoLeft!,
        if (widget.pickupPhotoRight != null)
          'pickupPhotoRight': widget.pickupPhotoRight!,
        if (widget.pickupPhotoWithVehicle != null)
          'pickupPhotoWithVehicle': widget.pickupPhotoWithVehicle!,
      });

      // If we reach here, the API call was successful
      await provider.refreshFromApi();
      if (!mounted) return;
      onNext();
    } catch (e) {
      if (mounted) {
        Toast.error(context, safeErrorMessage(e, 'pickup'));
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        backgroundColor: colors.surface,
        foregroundColor: colors.onSurface,
        elevation: 0,
        // LANGUAGE-AUDIT (2026-08-16) #5: hardcoded English
        // AppBar title. Localised via `txtfinalVerification`.
        title: Text(AppLocalizations.of(context)?.txtfinalVerification ??
            'Final Verification'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => widget.onBack?.call(),
        ),
      ),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: Spacing.paddingLg,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                // AUDIT-FIX 2026-08-22: hardcoded English title; routed
                // through the pre-staged `txtreadyToRoll` ARB key.
                AppLocalizations.of(context)?.txtreadyToRoll ?? 'Ready to Roll?',
                style: AppTypography.headingLarge
                    .copyWith(color: colors.onSurface),
              ),
              SizedBox(height: 8),
              Text(
                AppLocalizations.of(context)
                        ?.txtpleaseReviewAndSignTheDigitalRentalAgreementBeforeCollectingYourVehicle ??
                    'Please review and sign the digital rental agreement before collecting your vehicle.',
                style:
                    GoogleFonts.plusJakartaSans(color: colors.onSurfaceVariant),
              ),
              const SizedBox(height: 32),

              // Photos status summary
              if (widget.pickupPhotoFront != null ||
                  widget.pickupPhotoBack != null ||
                  widget.pickupPhotoLeft != null ||
                  widget.pickupPhotoRight != null)
                Padding(
                  padding: const EdgeInsets.only(bottom: 24),
                  child: Row(
                    children: [
                      const Icon(Icons.check_circle,
                          color: AppColors.success, size: 20),
                      SizedBox(width: 8),
                      Text(
                        // AUDIT-FIX 2026-08-22: hardcoded English
                        // status text; routed through the new
                        // `txtvehiclePhotosCaptured` ARB key.
                        AppLocalizations.of(context)
                                ?.txtvehiclePhotosCaptured ??
                            'Vehicle photos captured',
                        style: GoogleFonts.plusJakartaSans(
                          fontWeight: FontWeight.w500,
                          color: colors.onSurface,
                        ),
                      ),
                    ],
                  ),
                ),

              // Agreement
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Checkbox(
                    key: const Key('rentalAgreementCheckbox'),
                    value: _agreedToTerms,
                    onChanged: (val) =>
                        setState(() => _agreedToTerms = val ?? false),
                    activeColor: AppColors.primary,
                  ),
                  Expanded(
                    child: Text(
                      // AUDIT-FIX 2026-08-22: hardcoded English
                      // agreement copy; routed through the pre-
                      // staged `txtiConfirmThatIHave...` ARB key.
                      AppLocalizations.of(context)
                              ?.txtiConfirmThatIHaveInspectedTheVehicleAndAcceptResponsibilityForItsCareAndTrafficCompliance ??
                          'I confirm that I have inspected the vehicle and accept responsibility for its care and traffic compliance.',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 13,
                        height: 1.4,
                        color: colors.onSurface,
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 48),

              ElevatedButton(
                key: const Key('completePickupButton'),
                onPressed:
                    _agreedToTerms && !_isLoading ? _completePickup : null,
                child: _isLoading
                    ? const SizedBox(
                        width: 24,
                        height: 24,
                        child: CircularProgressIndicator(
                          color: Colors.white,
                          strokeWidth: 2,
                        ),
                      )
                    // LANGUAGE-AUDIT (2026-08-16) #5: hardcoded
                    // English button label. The closest ARB key
                    // is `onboarding_completeStart` ("Complete &
                    // Start Riding") — close in spirit (the
                    // pickup step IS the onboarding complete step)
                    // so we use it rather than add a new key for
                    // a one-screen variation.
                    : Text(AppLocalizations.of(context)
                            ?.onboarding_completeStart ??
                        'Complete & Start Riding'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
