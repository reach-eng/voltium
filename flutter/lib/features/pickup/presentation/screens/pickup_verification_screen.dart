import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class PickupVerificationScreen extends ConsumerStatefulWidget {
  final VoidCallback onNext;
  final VoidCallback? onBack;
  final String hubId;
  final String vehicleId;
  final String emergencyContact;
  final String? teamLeader;
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
    try {
      final provider = ref.read(riderProvider);
      final riderId = ref.watch(riderProvider).riderId;
      if (riderId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please log in again.')),
          );
        }
        return;
      }

      await VoltiumApiService().syncPickup(
        vehicleId: widget.vehicleId,
        hubId: widget.hubId,
        bookingId: riderId,
        teamLeader: widget.teamLeader,
        emergencyContact: widget.emergencyContact,
        pickupPhotoFront: widget.pickupPhotoFront,
        pickupPhotoBack: widget.pickupPhotoBack,
        pickupPhotoLeft: widget.pickupPhotoLeft,
        pickupPhotoRight: widget.pickupPhotoRight,
        pickupPhotoWithVehicle: widget.pickupPhotoWithVehicle,
      );

      // If we reach here, the API call was successful
      await provider.refreshFromApi();
      widget.onNext();
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Failed to complete pickup. Please try again.'),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      appBar: AppBar(
        title: const Text('Final Verification'),
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
                'Ready to Roll?',
                style: AppTypography.headingLarge
                    .copyWith(color: AppColors.onSurface),
              ),
              SizedBox(height: 8),
              Text(
                'Please review the digital rental agreement before collecting your vehicle.',
                style: GoogleFonts.plusJakartaSans(
                    color: AppColors.onSurfaceVariant),
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
                        'Vehicle photos captured',
                        style: GoogleFonts.plusJakartaSans(
                            fontWeight: FontWeight.w500),
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
                      'I confirm that I have inspected the vehicle and accept responsibility for its care and traffic compliance.',
                      style: GoogleFonts.plusJakartaSans(
                          fontSize: 13, height: 1.4),
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
                    : const Text('Complete & Start Ride'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
