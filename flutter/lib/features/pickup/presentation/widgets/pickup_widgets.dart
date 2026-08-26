import 'package:flutter/material.dart';

import 'package:voltium_rider/models/hub_model.dart';
import 'package:voltium_rider/widgets/pickup_hub_widgets.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Mutable entry for a single photo upload slot.
class PhotoUploadEntry {
  String? imagePath;
  String? photoUrl;
  bool isUploading;

  PhotoUploadEntry({this.imagePath, this.photoUrl, this.isUploading = false});
}

/// Card displaying hub, vehicle, team‑leader and emergency‑contact fields.
class AssignmentDetailsCard extends StatelessWidget {
  final String? selectedHubId;
  final List<HubModel> hubs;
  final ValueChanged<String?> onHubChanged;

  final String? selectedTeamLeader;
  final ValueChanged<String?> onTeamLeaderChanged;

  final bool isHubSelected;
  final String? selectedVehicleId;
  final String? selectedVehicleLabel;
  final bool isLoadingVehicles;
  final int vehicleCount;
  final VoidCallback onVehicleTap;

  final TextEditingController emergencyContactController;
  final bool isOtpSent;
  final bool isOtpVerified;
  final bool isSendingOtp;
  final VoidCallback onSendOtp;
  final ValueChanged<String>? onEmergencyContactChanged;

  final TextEditingController otpController;
  final bool isVerifyingOtp;
  final VoidCallback onVerifyOtp;

  const AssignmentDetailsCard({
    super.key,
    this.selectedHubId,
    required this.hubs,
    required this.onHubChanged,
    this.selectedTeamLeader,
    required this.onTeamLeaderChanged,
    required this.isHubSelected,
    this.selectedVehicleId,
    this.selectedVehicleLabel,
    required this.isLoadingVehicles,
    required this.vehicleCount,
    required this.onVehicleTap,
    required this.emergencyContactController,
    required this.isOtpSent,
    required this.isOtpVerified,
    required this.isSendingOtp,
    required this.onSendOtp,
    this.onEmergencyContactChanged,
    required this.otpController,
    required this.isVerifyingOtp,
    required this.onVerifyOtp,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: [
          BoxShadow(
            color: colors.onSurface.withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: colors.surface, width: 1),
      ),
      padding: Spacing.paddingLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'ASSIGNMENT DETAILS',
            style: AppTypography.bodySmall
                .copyWith(fontWeight: FontWeight.w800)
                .copyWith(color: colors.onSurfaceMuted, letterSpacing: 1.5),
          ),
          const SizedBox(height: 24),
          buildInputLabel(context, 'SELECT HUB'),
          const SizedBox(height: 8),
          buildHubDropdown(context, selectedHubId, hubs, onHubChanged),
          const SizedBox(height: 20),
          buildInputLabel(context, 'TEAM LEADER'),
          const SizedBox(height: 8),
          buildTeamLeaderDropdown(
              context, selectedTeamLeader, onTeamLeaderChanged),
          const SizedBox(height: 20),
          buildInputLabel(context, 'VEHICLE NUMBER'),
          const SizedBox(height: 8),
          buildVehicleDropdown(
            context: context,
            hubSelected: isHubSelected,
            isLoadingVehicles: isLoadingVehicles,
            vehicleSelected: selectedVehicleId != null,
            selectedVehicleLabel: selectedVehicleLabel,
            vehicleCount: vehicleCount,
            onTap: onVehicleTap,
          ),
          const SizedBox(height: 20),
          buildInputLabel(context, 'EMERGENCY CONTACT'),
          const SizedBox(height: 8),
          EmergencyContactField(
            controller: emergencyContactController,
            isOtpVerified: isOtpVerified,
            isOtpSent: isOtpSent,
            isSendingOtp: isSendingOtp,
            onSendOtp: onSendOtp,
            onChanged: onEmergencyContactChanged,
          ),
          if (isOtpSent && !isOtpVerified) ...[
            const SizedBox(height: 20),
            buildInputLabel(context, 'ENTER 6-DIGIT OTP'),
            const SizedBox(height: 8),
            OtpGrid(controller: otpController),
            const SizedBox(height: 16),
            buildVerifyOtpButton(
              isVerifying: isVerifyingOtp,
              onPressed: onVerifyOtp,
            ),
          ],
          if (isOtpVerified) ...[
            SizedBox(height: 12),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: AppColors.success.withValues(alpha: 0.08),
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(
                    Icons.check_circle,
                    color: AppColors.success,
                    size: 16,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Emergency contact verified successfully',
                    style: AppTypography.bodySmall
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(color: AppColors.success),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

/// Card displaying vehicle‑condition photo upload slots.
class VehicleConditionCard extends StatelessWidget {
  final String? frontImagePath;
  final String? frontPhotoUrl;
  final bool isUploadingFront;
  final String? backImagePath;
  final String? backPhotoUrl;
  final bool isUploadingBack;
  final String? leftImagePath;
  final String? leftPhotoUrl;
  final bool isUploadingLeft;
  final String? rightImagePath;
  final String? rightPhotoUrl;
  final bool isUploadingRight;
  final String? withVehicleImagePath;
  final String? withVehiclePhotoUrl;
  final bool isUploadingWithVehicle;
  final void Function(String type, bool useCamera) onUploadImage;

  const VehicleConditionCard({
    super.key,
    this.frontImagePath,
    this.frontPhotoUrl,
    this.isUploadingFront = false,
    this.backImagePath,
    this.backPhotoUrl,
    this.isUploadingBack = false,
    this.leftImagePath,
    this.leftPhotoUrl,
    this.isUploadingLeft = false,
    this.rightImagePath,
    this.rightPhotoUrl,
    this.isUploadingRight = false,
    this.withVehicleImagePath,
    this.withVehiclePhotoUrl,
    this.isUploadingWithVehicle = false,
    required this.onUploadImage,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: [
          BoxShadow(
            color: colors.onSurface.withValues(alpha: 0.04),
            blurRadius: 24,
            offset: const Offset(0, 8),
          ),
        ],
        border: Border.all(color: colors.surface, width: 1),
      ),
      padding: Spacing.paddingLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                children: [
                  const Icon(
                    Icons.camera_alt_outlined,
                    color: AppColors.primary,
                    size: 20,
                  ),
                  SizedBox(width: 8),
                  Text(
                    'Vehicle Condition',
                    style: AppTypography.titleSmall
                        .copyWith(color: colors.onSurface),
                  ),
                ],
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: AppColors.errorLight,
                  borderRadius: BorderRadius.circular(6),
                ),
                child: Text(
                  'MANDATORY',
                  style: AppTypography.bodySmall
                      .copyWith(fontWeight: FontWeight.w800)
                      .copyWith(color: AppColors.error, letterSpacing: 0.5),
                ),
              ),
            ],
          ),
          SizedBox(height: 6),
          Text(
            'Upload high-quality pictures from the requested angles',
            style:
                AppTypography.bodySmall.copyWith(color: colors.onSurfaceMuted),
          ),
          const SizedBox(height: 24),
          Column(
            children: [
              Row(
                children: [
                  Expanded(
                    child: PhotoUploadCard(
                      type: 'front',
                      label: 'Front Profile',
                      imagePath: frontImagePath,
                      photoUrl: frontPhotoUrl,
                      isUploading: isUploadingFront,
                      onTap: () => showImageSourceDialog(
                        context,
                        'front',
                        onUploadImage,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: PhotoUploadCard(
                      type: 'back',
                      label: 'Back Profile',
                      imagePath: backImagePath,
                      photoUrl: backPhotoUrl,
                      isUploading: isUploadingBack,
                      onTap: () =>
                          showImageSourceDialog(context, 'back', onUploadImage),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Row(
                children: [
                  Expanded(
                    child: PhotoUploadCard(
                      type: 'left',
                      label: 'Left Profile',
                      imagePath: leftImagePath,
                      photoUrl: leftPhotoUrl,
                      isUploading: isUploadingLeft,
                      onTap: () =>
                          showImageSourceDialog(context, 'left', onUploadImage),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: PhotoUploadCard(
                      type: 'right',
                      label: 'Right Profile',
                      imagePath: rightImagePath,
                      photoUrl: rightPhotoUrl,
                      isUploading: isUploadingRight,
                      onTap: () => showImageSourceDialog(
                        context,
                        'right',
                        onUploadImage,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
          SizedBox(height: 20),
          Text(
            'Photo with Vehicle',
            style: AppTypography.bodyMedium
                .copyWith(fontSize: 13, fontWeight: FontWeight.w600)
                .copyWith(color: colors.onSurface),
          ),
          SizedBox(height: 4),
          Text(
            'Take a selfie next to the vehicle before riding',
            style:
                AppTypography.bodySmall.copyWith(color: colors.onSurfaceMuted),
          ),
          const SizedBox(height: 8),
          PhotoUploadCard(
            type: 'with_vehicle',
            label: 'Photo with Vehicle',
            imagePath: withVehicleImagePath,
            photoUrl: withVehiclePhotoUrl,
            isUploading: isUploadingWithVehicle,
            onTap: () =>
                showImageSourceDialog(context, 'with_vehicle', onUploadImage),
          ),
        ],
      ),
    );
  }
}
