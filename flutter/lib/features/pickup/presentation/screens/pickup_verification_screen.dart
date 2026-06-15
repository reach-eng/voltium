import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/services/api_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

class PickupVerificationScreen extends StatefulWidget {
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
  State<PickupVerificationScreen> createState() =>
      _PickupVerificationScreenState();
}

class _PickupVerificationScreenState extends State<PickupVerificationScreen> {
  bool _isLoading = false;
  bool _agreedToTerms = false;

  Future<void> _completePickup() async {
    if (!_agreedToTerms) {
      return;
    }

    setState(() => _isLoading = true);
    try {
      final provider = context.read<AppProvider>();
      final riderId = provider.rider?.id;
      if (riderId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please log in again.')),
          );
        }
        return;
      }

      final response = await ApiService().syncPickup(
        riderId: riderId,
        vehicleId: widget.vehicleId,
        hubId: widget.hubId,
        teamLeader: widget.teamLeader,
        emergencyContact: widget.emergencyContact,
        pickupPhoto: widget.pickupPhotoFront ?? '',
        pickupPhotoFront: widget.pickupPhotoFront,
        pickupPhotoBack: widget.pickupPhotoBack,
        pickupPhotoLeft: widget.pickupPhotoLeft,
        pickupPhotoRight: widget.pickupPhotoRight,
        pickupPhotoWithVehicle: widget.pickupPhotoWithVehicle,
      );

      if (response['success'] == true) {
        await provider.refreshFromApi();
        widget.onNext();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['message'] ?? 'Sync failed')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to complete pickup. Please try again.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;

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
          padding: const EdgeInsets.all(Spacing.lg),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Ready to Roll?',
                style: TextStyle(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: AppColors.onSurface,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Please review and sign the digital rental agreement before collecting your vehicle.',
                style: TextStyle(color: AppColors.onSurfaceVariant),
              ),
              const SizedBox(height: 32),

              // Mock Signature Pad
              const Text(
                'Digital Signature',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              Container(
                height: 100,
                width: double.infinity,
                decoration: BoxDecoration(
                  color: AppColors.outlineVariant.withOpacity(0.3),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                ),
                child: const Center(
                  child: Text(
                    'Draw your signature here',
                    style: TextStyle(
                        fontStyle: FontStyle.italic,
                        color: AppColors.onSurfaceMuted),
                  ),
                ),
              ),
              const SizedBox(height: 32),

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
                  const Expanded(
                    child: Text(
                      'I confirm that I have inspected the vehicle and accept responsibility for its care and traffic compliance.',
                      style: TextStyle(fontSize: 13, height: 1.4),
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
                            color: Colors.white, strokeWidth: 2),
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
