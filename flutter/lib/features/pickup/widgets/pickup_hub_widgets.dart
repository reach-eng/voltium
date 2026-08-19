import 'package:universal_io/io.dart';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:voltium_rider/widgets/image_source_sheet.dart';

import '../../../models/hub_model.dart';
import '../../../widgets/dashed_border_painter.dart';
import '../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/gen/app_localizations.dart';

// Pickup Hub styling constants have been moved to dynamic AppColors.of(context)
// Note: AppColors.primary and AppColors.success are brand colors and remain static.

/// Input label helper — callers in this file always pass BuildContext via
/// a local `colors` variable captured in the build scope.
Widget buildInputLabel(BuildContext context, String text, {Color? color}) {
  final colors = AppColors.of(context);
  return Text(
    text,
    style: AppTypography.overline.copyWith(
      color: color ?? colors.onSurfaceMuted,
      letterSpacing: 1.0,
    ),
  );
}

/// Hub dropdown
Widget buildHubDropdown(
  BuildContext context,
  String? selectedHubId,
  List<HubModel> hubs,
  ValueChanged<String?> onChanged,
) {
  final colors = AppColors.of(context);
  return DropdownButtonFormField<String>(
    key: const Key('hubDropdown'),
    initialValue: selectedHubId,
    style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
    icon: Icon(Icons.keyboard_arrow_down, color: colors.onSurfaceMuted),
    decoration: InputDecoration(
      prefixIcon: const Icon(
        Icons.location_on_outlined,
        color: AppColors.primary,
        size: 20,
      ),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      filled: true,
      fillColor: colors.iconBackground,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      hintText: 'Select Hub',
      hintStyle: GoogleFonts.plusJakartaSans(
        color: colors.onSurfaceMuted.withValues(alpha: 0.7),
        fontSize: 14,
      ),
    ),
    items: hubs.map((hub) {
      return DropdownMenuItem<String>(
        value: hub.id,
        child: Text(hub.name, overflow: TextOverflow.ellipsis),
      );
    }).toList(),
    onChanged: onChanged,
  );
}

/// Fixed team-leader options shown in the pickup hub form. Shared with
/// [PickupHubScreen]'s draft-restore guard (a restored team leader that is
/// not in this list is dropped rather than crashing the dropdown).
const kPickupTeamLeaderOptions = [
  'Rajesh Kumar (TL-01)',
  'Not assigned',
  'Sanjay Singh (TL-03)',
];

/// Team Leader dropdown
Widget buildTeamLeaderDropdown(
  BuildContext context,
  String? selectedTeamLeader,
  ValueChanged<String?> onChanged, {
  List<String>? teamLeaderOptions,
}) {
  final colors = AppColors.of(context);
  final teamLeaders = teamLeaderOptions ?? kPickupTeamLeaderOptions;

  return DropdownButtonFormField<String>(
    key: const Key('teamLeaderDropdown'),
    initialValue: selectedTeamLeader,
    style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
    icon: Icon(Icons.keyboard_arrow_down, color: colors.onSurfaceMuted),
    decoration: InputDecoration(
      prefixIcon:
          const Icon(Icons.person_outline, color: AppColors.primary, size: 20),
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      filled: true,
      fillColor: colors.iconBackground,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: BorderSide.none,
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        borderSide: const BorderSide(color: AppColors.primary, width: 2),
      ),
      hintText: AppLocalizations.of(context)?.txtselectTeamLeader ??
          'Select Team Leader',
      hintStyle: GoogleFonts.plusJakartaSans(
        color: colors.onSurfaceMuted.withValues(alpha: 0.7),
        fontSize: 14,
      ),
    ),
    items: teamLeaders.map((tl) {
      return DropdownMenuItem<String>(
        value: tl,
        child: Text(tl),
      );
    }).toList(),
    onChanged: onChanged,
  );
}

/// Vehicle dropdown (tap to open search sheet)
Widget buildVehicleDropdown({
  required BuildContext context,
  required bool hubSelected,
  required bool isLoadingVehicles,
  required bool vehicleSelected,
  String? selectedVehicleLabel,
  required int vehicleCount,
  required VoidCallback? onTap,
}) {
  final colors = AppColors.of(context);
  return GestureDetector(
    onTap: hubSelected && !isLoadingVehicles ? onTap : null,
    child: Container(
      key: const Key('vehicleDropdown'),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: hubSelected ? colors.card : colors.iconBackground,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(
          color: vehicleSelected ? AppColors.primary : colors.outlineVariant,
          width: vehicleSelected ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.electric_moped_outlined,
            color: hubSelected ? AppColors.primary : colors.onSurfaceMuted,
            size: 20,
          ),
          SizedBox(width: 12),
          Expanded(
            child: isLoadingVehicles
                ? Row(
                    children: [
                      const SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: AppColors.primary,
                        ),
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Loading vehicles…',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 14,
                          color: colors.onSurfaceMuted,
                        ),
                      ),
                    ],
                  )
                : Text(
                    selectedVehicleLabel ??
                        (!hubSelected
                            ? 'Select a hub first'
                            : vehicleCount == 0
                                ? 'No vehicles available'
                                : 'Select Vehicle'),
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      fontWeight:
                          vehicleSelected ? FontWeight.w600 : FontWeight.w400,
                      color: vehicleSelected
                          ? colors.onSurface
                          : colors.onSurfaceMuted.withValues(alpha: 0.7),
                    ),
                  ),
          ),
          if (vehicleSelected)
            const Icon(Icons.check_circle, color: AppColors.success, size: 18)
          else
            Icon(
              Icons.keyboard_arrow_down,
              color: colors.onSurfaceMuted,
              size: 20,
            ),
        ],
      ),
    ),
  );
}

/// Emergency contact text field
class EmergencyContactField extends StatelessWidget {
  final TextEditingController controller;
  final bool isOtpVerified;
  final bool isOtpSent;
  final bool isSendingOtp;
  final VoidCallback onSendOtp;
  final ValueChanged<String>? onChanged;

  const EmergencyContactField({
    super.key,
    required this.controller,
    required this.isOtpVerified,
    required this.isOtpSent,
    required this.isSendingOtp,
    required this.onSendOtp,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return TextFormField(
      key: const Key('emergencyContactField'),
      controller: controller,
      keyboardType: TextInputType.phone,
      enabled: !isOtpVerified,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(10),
      ],
      style: AppTypography.bodyMedium.copyWith(color: colors.onSurface),
      decoration: InputDecoration(
        prefixIcon: const Icon(Icons.phone_outlined,
            color: AppColors.primary, size: 20),
        suffixIcon: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Padding(
              padding: const EdgeInsets.only(right: 8),
              child: isSendingOtp
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(
                        color: AppColors.primary,
                        strokeWidth: 2,
                      ),
                    )
                  : TextButton(
                      onPressed: isOtpVerified ? null : onSendOtp,
                      style: TextButton.styleFrom(
                        backgroundColor: isOtpVerified
                            ? Colors.transparent
                            : AppColors.primary.withValues(alpha: 0.1),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(AppRadius.lg),
                        ),
                      ),
                      child: Text(
                        isOtpVerified
                            ? 'VERIFIED'
                            : isOtpSent
                                ? 'RESEND'
                                : 'SEND OTP',
                        style: AppTypography.overline.copyWith(
                            color: isOtpVerified
                                ? AppColors.success
                                : AppColors.primary,
                            letterSpacing: 0.5),
                      ),
                    ),
            ),
          ],
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        filled: true,
        fillColor: colors.iconBackground,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide.none,
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: BorderSide.none,
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.lg),
          borderSide: const BorderSide(color: AppColors.primary, width: 2),
        ),
        hintText: '10-digit number',
        hintStyle: GoogleFonts.plusJakartaSans(
          color: colors.onSurfaceMuted.withValues(alpha: 0.5),
          fontSize: 14,
        ),
      ),
      onChanged: (val) {
        onChanged?.call(val);
      },
    );
  }
}

/// OTP grid for the 6-digit code.
///
/// ONBOARDING-AUDIT 2026-08-14 P0-3: the previous version wrapped the
/// TextFormField in `Opacity(0.0)`, which broke the IME on this
/// device (same root cause as the C2 / P0-2 fix in
/// `UnderlineOtpInput` and `phone_entry_widget`). We now render a
/// real TextFormField with a transparent text color so the digits
/// are visually hidden behind the slot row above, but the IME
/// connection initialises normally. We also accept an `onCompleted`
/// callback so the parent can auto-submit when all 6 digits are
/// filled — the previous version had no such callback and the rider
/// had to tap Verify by hand even after typing the full code.
class OtpGrid extends StatelessWidget {
  final TextEditingController controller;
  final ValueChanged<String>? onCompleted;

  const OtpGrid({super.key, required this.controller, this.onCompleted});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        SizedBox(
          height: 50,
          child: TextFormField(
            key: const Key('otpInputField'),
            controller: controller,
            autofocus: true,
            keyboardType: TextInputType.number,
            inputFormatters: [
              FilteringTextInputFormatter.digitsOnly,
              LengthLimitingTextInputFormatter(6),
            ],
            onChanged: (val) {
              if (val.length == 6) onCompleted?.call(val);
            },
            // The digits are visually hidden by a transparent text
            // color; the slot row above renders them. A real
            // TextFormField (no Opacity wrapper) keeps the IME happy.
            style: const TextStyle(color: Colors.transparent),
            cursorColor: Colors.transparent,
            decoration: const InputDecoration(
              counterText: '',
              border: InputBorder.none,
              enabledBorder: InputBorder.none,
              focusedBorder: InputBorder.none,
              filled: true,
              fillColor: Colors.transparent,
              contentPadding: EdgeInsets.zero,
            ),
          ),
        ),
        IgnorePointer(
          child: AnimatedBuilder(
            animation: controller,
            builder: (context, child) {
              final innerColors = AppColors.of(context);
              return Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: List.generate(6, (index) {
                  final text = controller.text;
                  final char = text.length > index ? text[index] : '';
                  final isFocused = text.length == index;

                  return Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: innerColors.card,
                      borderRadius: BorderRadius.circular(AppRadius.sm),
                      border: Border.all(
                        color: isFocused
                            ? AppColors.primary
                            : innerColors.outlineVariant,
                        width: isFocused ? 2.0 : 1.0,
                      ),
                    ),
                    alignment: Alignment.center,
                    child: Text(
                      char,
                      style: AppTypography.titleSmall
                          .copyWith(color: innerColors.onSurface),
                    ),
                  );
                }),
              );
            },
          ),
        ),
      ],
    );
  }
}

/// Verify OTP button
Widget buildVerifyOtpButton({
  required bool isVerifying,
  required VoidCallback? onPressed,
}) {
  // Use constant colors for this primary action button.
  return SizedBox(
    width: double.infinity,
    height: 48,
    child: ElevatedButton(
      key: const Key('verifyOtpButton'),
      onPressed: isVerifying ? null : onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: AppColors.primary,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
        ),
      ),
      child: isVerifying
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                color: Colors.white,
                strokeWidth: 2,
              ),
            )
          : Text(
              'Verify',
              style: AppTypography.bodyMedium
                  .copyWith(fontWeight: FontWeight.w800)
                  .copyWith(letterSpacing: 0.5),
            ),
    ),
  );
}

/// Photo upload card with dashed border, preview, and status indicators
class PhotoUploadCard extends StatelessWidget {
  final String type;
  final String label;
  final String? imagePath;
  final String? photoUrl;
  final bool isUploading;
  final VoidCallback? onTap;

  const PhotoUploadCard({
    super.key,
    required this.type,
    required this.label,
    this.imagePath,
    this.photoUrl,
    this.isUploading = false,
    this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final hasImage = imagePath != null;
    final isDone = photoUrl != null;

    return GestureDetector(
      key: Key('photoSlot_$type'),
      onTap: isUploading ? null : onTap,
      child: Container(
        height: 120,
        decoration: BoxDecoration(
          color: colors.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Stack(
          children: [
            if (!hasImage)
              CustomPaint(
                painter: DashedBorderPainter(
                  color: colors.outlineVariant,
                  borderRadius: 16,
                ),
                child: Container(),
              ),
            if (hasImage)
              ClipRRect(
                borderRadius: BorderRadius.circular(AppRadius.lg),
                child: Image.file(
                  File(imagePath!),
                  width: double.infinity,
                  height: double.infinity,
                  fit: BoxFit.cover,
                ),
              ),
            if (!hasImage && !isUploading)
              Center(
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: colors.card,
                      ),
                      child: const Icon(
                        Icons.camera_alt_outlined,
                        size: 18,
                        color: AppColors.primary,
                      ),
                    ),
                    SizedBox(height: 8),
                    Text(
                      label,
                      style: AppTypography.bodySmall
                          .copyWith(fontWeight: FontWeight.w600)
                          .copyWith(color: colors.onSurface),
                    ),
                  ],
                ),
              ),
            if (isUploading)
              Center(
                child: Container(
                  padding: const EdgeInsets.all(Spacing.sm),
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: colors.card,
                  ),
                  child: const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: AppColors.primary,
                      strokeWidth: 2,
                    ),
                  ),
                ),
              ),
            if (isDone)
              Positioned(
                top: 8,
                right: 8,
                child: Container(
                  padding: Spacing.paddingXs,
                  decoration: const BoxDecoration(
                    color: AppColors.success,
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.check,
                    color: Colors.white,
                    size: 12,
                  ),
                ),
              ),
            if (hasImage && !isUploading)
              Positioned(
                bottom: 0,
                left: 0,
                right: 0,
                child: Container(
                  decoration: BoxDecoration(
                    gradient: LinearGradient(
                      colors: [
                        Colors.black.withValues(alpha: 0.8),
                        Colors.transparent,
                      ],
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                    ),
                    borderRadius: const BorderRadius.vertical(
                      bottom: Radius.circular(16),
                    ),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: AppTypography.labelSmall
                        .copyWith(fontSize: 10)
                        .copyWith(color: Colors.white),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

/// Curtain header for pickup hub screen
Widget buildCurtainHeader({
  required BuildContext context,
  required String title,
  required String subtitle,
  VoidCallback? onBack,
}) {
  return Container(
    width: double.infinity,
    decoration: const BoxDecoration(
      color: AppColors.primary,
    ),
    padding: const EdgeInsets.only(top: 60, bottom: 80, left: 24, right: 24),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            GestureDetector(
              onTap: onBack,
              child: Container(
                width: 40,
                height: 40,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.15),
                ),
                child: const Icon(
                  Icons.arrow_back,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ),
          ],
        ),
        SizedBox(height: 24),
        Text(
          title,
          style: AppTypography.headingMedium
              .copyWith(color: Colors.white, letterSpacing: -0.5),
        ),
        SizedBox(height: 8),
        Text(
          subtitle,
          // Pre-existing #22 cleanup: the first `.copyWith(color:
          // AppColors.of(context).onSurfaceMuted)` was dead — the
          // second `.copyWith` overwrote it, AND this is a free
          // function with no `context` in scope. Use the second
          // colour directly (a translucent white on the primary
          // brand colour background) and drop the bogus first call.
          style: AppTypography.bodyMedium.copyWith(
            color: Colors.white.withValues(alpha: 0.8),
          ),
        ),
      ],
    ),
  );
}

/// Sticky bottom bar with confirm button
Widget buildStickyBottomBar({
  required bool isFormValid,
  required VoidCallback? onSubmit,
  String buttonText = 'Confirm & Proceed',
  required BuildContext context,
}) {
  final colors = AppColors.of(context);
  return Container(
    decoration: BoxDecoration(
      color: colors.card,
      border: Border(
        top: BorderSide(color: colors.surface, width: 1),
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withValues(alpha: 0.04),
          blurRadius: 10,
          offset: const Offset(0, -4),
        ),
      ],
    ),
    padding: const EdgeInsets.only(
      left: 24,
      right: 24,
      top: 16,
      bottom: 24,
    ),
    child: Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        SizedBox(
          width: double.infinity,
          height: 48,
          child: ElevatedButton(
            key: const Key('confirmHubButton'),
            onPressed: isFormValid ? onSubmit : null,
            style: ElevatedButton.styleFrom(
              backgroundColor: AppColors.primary,
              foregroundColor: Colors.white,
              disabledBackgroundColor: colors.outlineVariant,
              disabledForegroundColor: colors.onSurfaceMuted,
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(AppRadius.md),
              ),
            ),
            child: Text(
              buttonText,
              style: AppTypography.labelLarge
                  .copyWith(fontWeight: FontWeight.w700),
            ),
          ),
        ),
        SizedBox(height: 12),
        Text(
          'ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING',
          textAlign: TextAlign.center,
          style: AppTypography.labelSmall.copyWith(fontSize: 9).copyWith(
                color: colors.onSurfaceMuted.withValues(alpha: 0.7),
                letterSpacing: 1.0,
              ),
        ),
      ],
    ),
  );
}

/// Photo source dialog
Future<void> showImageSourceDialog(
  BuildContext context,
  String type,
  Function(String, bool) onUpload,
) async {
  final source = await ImageSourceBottomSheet.show(context: context);
  if (source != null) {
    onUpload(type, source == ImageSource.camera);
  }
}
