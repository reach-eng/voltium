import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../gen/app_localizations.dart';

class PickupVerificationScreen extends StatefulWidget {
  final VoidCallback onNext;

  const PickupVerificationScreen({super.key, required this.onNext});

  @override
  State<PickupVerificationScreen> createState() => _PickupVerificationScreenState();
}

class _PickupVerificationScreenState extends State<PickupVerificationScreen> {
  bool _isLoading = false;
  bool _agreedToTerms = false;
  String? _pickupPhotoUrl;
  File? _selectedImage;
  final ImagePicker _picker = ImagePicker();

  Future<void> _pickImage() async {
    try {
      final XFile? image = await _picker.pickImage(
        source: ImageSource.camera,
        imageQuality: 70,
      );
      if (image != null) {
        setState(() {
          _selectedImage = File(image.path);
          _isLoading = true;
        });

        // Upload immediately to get URL
        final url = await ApiService().uploadFile(_selectedImage!, 'pickup_verification');
        setState(() {
          _pickupPhotoUrl = url;
          _isLoading = false;
        });
      }
    } catch (e) {
      setState(() => _isLoading = false);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Failed to capture photo. Please try again.')),
        );
      }
    }
  }

  Future<void> _completePickup() async {
    if (!_agreedToTerms || _pickupPhotoUrl == null) {
      if (_pickupPhotoUrl == null) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Please capture a pickup photo first.')),
        );
      }
      return;
    }

    setState(() => _isLoading = true);
    try {
      final provider = context.read<AppProvider>();
      final riderId = provider.rider!.id!;
      
      final response = await ApiService().syncPickup(
        riderId: riderId,
        vehicleId: 'VF-PREVIEW-01',
        hubId: 'HUB-DEL-01',
        pickupPhoto: _pickupPhotoUrl!,
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
          const SnackBar(content: Text('Failed to complete pickup. Please try again.')),
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

              // Pickup Photo Section
              const Text(
                'Capture Pickup Photo',
                style: TextStyle(fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 12),
              GestureDetector(
                key: const Key('uploadPhotoArea'),
                onTap: _isLoading ? null : _pickImage,
                child: Container(
                  height: 200,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: AppColors.outlineVariant.withOpacity(0.3),
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    image: _selectedImage != null
                        ? DecorationImage(
                            image: FileImage(_selectedImage!),
                            fit: BoxFit.cover,
                          )
                        : null,
                  ),
                  child: _selectedImage == null
                      ? const Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.camera_alt_outlined, size: 48, color: AppColors.onSurfaceMuted),
                              SizedBox(height: 8),
                              Text('Tap to take photo with vehicle', style: TextStyle(color: AppColors.onSurfaceMuted)),
                            ],
                          ),
                        )
                      : null,
                ),
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
                    style: TextStyle(fontStyle: FontStyle.italic, color: AppColors.onSurfaceMuted),
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
                    onChanged: (val) => setState(() => _agreedToTerms = val ?? false),
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
                onPressed: _agreedToTerms && !_isLoading && _pickupPhotoUrl != null ? _completePickup : null,
                child: _isLoading 
                  ? const SizedBox(
                      width: 24,
                      height: 24,
                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2),
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
