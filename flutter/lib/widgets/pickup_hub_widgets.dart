import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';

import '../models/hub_model.dart';
import '../widgets/dashed_border_painter.dart';

/// Pickup Hub styling constants
const Color kPrimaryColor = Color(0xFF0053C1);
const Color kSurfaceColor = Color(0xFFF9F9FF);
const Color kSurfaceContainer = Color(0xFFFFFFFF);
const Color kOnSurfaceColor = Color(0xFF141B2B);
const Color kOutlineColor = Color(0xFF737785);
const Color kOutlineVariantColor = Color(0xFFC2C6D6);
const Color kSuccessColor = Color(0xFF10B981);

/// Input label helper
Widget buildInputLabel(String text) {
  return Text(
    text,
    style: GoogleFonts.inter(
      fontSize: 10,
      fontWeight: FontWeight.w800,
      color: kOutlineColor,
      letterSpacing: 1.0,
    ),
  );
}

/// Hub dropdown
Widget buildHubDropdown(
  String? selectedHubId,
  List<HubModel> hubs,
  ValueChanged<String?> onChanged,
) {
  return DropdownButtonFormField<String>(
    key: const Key('hubDropdown'),
    value: selectedHubId,
    style: GoogleFonts.inter(
      color: kOnSurfaceColor,
      fontSize: 14,
      fontWeight: FontWeight.w500,
    ),
    icon: const Icon(Icons.keyboard_arrow_down, color: kOutlineColor),
    decoration: InputDecoration(
      prefixIcon:
          const Icon(Icons.location_on_outlined, color: kPrimaryColor, size: 20),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: kPrimaryColor, width: 1.5),
      ),
      hintText: 'Select Hub',
      hintStyle: GoogleFonts.inter(
        color: kOutlineColor.withOpacity(0.7),
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

/// Team Leader dropdown
Widget buildTeamLeaderDropdown(
  String? selectedTeamLeader,
  ValueChanged<String?> onChanged,
) {
  const teamLeaders = [
    'Rajesh Kumar (TL-01)',
    'Amit Sharma (TL-02)',
    'Sanjay Singh (TL-03)',
  ];

  return DropdownButtonFormField<String>(
    key: const Key('teamLeaderDropdown'),
    value: selectedTeamLeader,
    style: GoogleFonts.inter(
      color: kOnSurfaceColor,
      fontSize: 14,
      fontWeight: FontWeight.w500,
    ),
    icon: const Icon(Icons.keyboard_arrow_down, color: kOutlineColor),
    decoration: InputDecoration(
      prefixIcon:
          const Icon(Icons.person_outline, color: kPrimaryColor, size: 20),
      contentPadding:
          const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      filled: true,
      fillColor: Colors.white,
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
      ),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: kPrimaryColor, width: 1.5),
      ),
      hintText: 'Select Team Leader',
      hintStyle: GoogleFonts.inter(
        color: kOutlineColor.withOpacity(0.7),
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
  required bool hubSelected,
  required bool isLoadingVehicles,
  required bool vehicleSelected,
  String? selectedVehicleLabel,
  required int vehicleCount,
  required VoidCallback? onTap,
}) {
  return GestureDetector(
    onTap: hubSelected && !isLoadingVehicles ? onTap : null,
    child: Container(
      key: const Key('vehicleDropdown'),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: hubSelected ? Colors.white : const Color(0xFFF1F5F9),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: vehicleSelected ? kPrimaryColor : kOutlineVariantColor,
          width: vehicleSelected ? 1.5 : 1,
        ),
      ),
      child: Row(
        children: [
          Icon(
            Icons.electric_moped_outlined,
            color: hubSelected ? kPrimaryColor : kOutlineColor,
            size: 20,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: isLoadingVehicles
                ? Row(
                    children: [
                      SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                            strokeWidth: 2, color: kPrimaryColor),
                      ),
                      const SizedBox(width: 8),
                      Text('Loading vehicles…',
                          style: GoogleFonts.inter(
                              fontSize: 14, color: kOutlineColor)),
                    ],
                  )
                : Text(
                    selectedVehicleLabel ??
                        (!hubSelected
                            ? 'Select a hub first'
                            : vehicleCount == 0
                                ? 'No vehicles available'
                                : 'Select Vehicle'),
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight:
                          vehicleSelected ? FontWeight.w600 : FontWeight.w400,
                      color: vehicleSelected
                          ? kOnSurfaceColor
                          : kOutlineColor.withOpacity(0.7),
                    ),
                  ),
          ),
          if (vehicleSelected)
            const Icon(Icons.check_circle, color: kSuccessColor, size: 18)
          else
            const Icon(Icons.keyboard_arrow_down,
                color: kOutlineColor, size: 20),
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
    return TextFormField(
      key: const Key('emergencyContactField'),
      controller: controller,
      keyboardType: TextInputType.phone,
      enabled: !isOtpVerified,
      inputFormatters: [
        FilteringTextInputFormatter.digitsOnly,
        LengthLimitingTextInputFormatter(10)
      ],
      style: GoogleFonts.inter(
        color: kOnSurfaceColor,
        fontSize: 14,
        fontWeight: FontWeight.w500,
      ),
      decoration: InputDecoration(
        prefixIcon:
            const Icon(Icons.phone_outlined, color: kPrimaryColor, size: 20),
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
                          color: kPrimaryColor, strokeWidth: 2),
                    )
                  : TextButton(
                      onPressed: isOtpVerified ? null : onSendOtp,
                      style: TextButton.styleFrom(
                        backgroundColor: isOtpVerified
                            ? Colors.transparent
                            : kPrimaryColor.withOpacity(0.1),
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(20),
                        ),
                      ),
                      child: Text(
                        isOtpVerified
                            ? 'VERIFIED'
                            : isOtpSent
                                ? 'RESEND'
                                : 'SEND OTP',
                        style: GoogleFonts.inter(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: isOtpVerified ? kSuccessColor : kPrimaryColor,
                          letterSpacing: 0.5,
                        ),
                      ),
                    ),
            ),
          ],
        ),
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        filled: true,
        fillColor: Colors.white,
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kOutlineVariantColor, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(12),
          borderSide: const BorderSide(color: kPrimaryColor, width: 1.5),
        ),
        hintText: '10-digit number',
        hintStyle: GoogleFonts.inter(
          color: kOutlineColor.withOpacity(0.5),
          fontSize: 14,
        ),
      ),
      onChanged: (val) {
        onChanged?.call(val);
      },
    );
  }
}

/// OTP grid for the 6-digit code
class OtpGrid extends StatelessWidget {
  final TextEditingController controller;

  const OtpGrid({super.key, required this.controller});

  @override
  Widget build(BuildContext context) {
    return Stack(
      children: [
        Opacity(
          opacity: 0.0,
          child: SizedBox(
            height: 50,
            child: TextFormField(
              key: const Key('otpInputField'),
              controller: controller,
              keyboardType: TextInputType.number,
              inputFormatters: [
                FilteringTextInputFormatter.digitsOnly,
                LengthLimitingTextInputFormatter(6)
              ],
            ),
          ),
        ),
        IgnorePointer(
          child: Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(6, (index) {
              final text = controller.text;
              final char = text.length > index ? text[index] : '';
              final isFocused = text.length == index;

              return Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color:
                        isFocused ? kPrimaryColor : kOutlineVariantColor,
                    width: isFocused ? 2.0 : 1.0,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  char,
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: kOnSurfaceColor,
                  ),
                ),
              );
            }),
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
  return SizedBox(
    width: double.infinity,
    height: 48,
    child: ElevatedButton(
      key: const Key('verifyOtpButton'),
      onPressed: isVerifying ? null : onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: kPrimaryColor,
        foregroundColor: Colors.white,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
        ),
      ),
      child: isVerifying
          ? const SizedBox(
              width: 20,
              height: 20,
              child: CircularProgressIndicator(
                  color: Colors.white, strokeWidth: 2),
            )
          : Text(
              'VERIFY',
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                letterSpacing: 0.5,
              ),
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
    final hasImage = imagePath != null;
    final isDone = photoUrl != null;

    return GestureDetector(
      key: Key('photoSlot_$type'),
      onTap: isUploading ? null : onTap,
      child: Container(
        height: 120,
        decoration: BoxDecoration(
          color: const Color(0xFFF9F9FF),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Stack(
          children: [
            if (!hasImage)
              CustomPaint(
                painter: DashedBorderPainter(
                  color: kOutlineVariantColor,
                  borderRadius: 16,
                ),
                child: Container(),
              ),
            if (hasImage)
              ClipRRect(
                borderRadius: BorderRadius.circular(16),
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
                      decoration: const BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white,
                      ),
                      child: const Icon(
                        Icons.camera_alt_outlined,
                        size: 18,
                        color: kPrimaryColor,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      label,
                      style: GoogleFonts.inter(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        color: kOnSurfaceColor,
                      ),
                    ),
                  ],
                ),
              ),
            if (isUploading)
              Center(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: const BoxDecoration(
                    shape: BoxShape.circle,
                    color: Colors.white,
                  ),
                  child: const SizedBox(
                    width: 20,
                    height: 20,
                    child: CircularProgressIndicator(
                      color: kPrimaryColor,
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
                  padding: const EdgeInsets.all(4),
                  decoration: const BoxDecoration(
                    color: kSuccessColor,
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
                        Colors.black.withOpacity(0.8),
                        Colors.transparent
                      ],
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                    ),
                    borderRadius: const BorderRadius.vertical(
                        bottom: Radius.circular(16)),
                  ),
                  padding: const EdgeInsets.symmetric(vertical: 6),
                  child: Text(
                    label,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      color: Colors.white,
                      fontWeight: FontWeight.w600,
                    ),
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
Widget buildCurtainHeader({VoidCallback? onBack}) {
  return Container(
    width: double.infinity,
    decoration: const BoxDecoration(
      color: kPrimaryColor,
    ),
    padding:
        const EdgeInsets.only(top: 60, bottom: 80, left: 24, right: 24),
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
                  color: Colors.white.withOpacity(0.15),
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
        const SizedBox(height: 24),
        Text(
          'Pickup Verification',
          style: GoogleFonts.inter(
            fontSize: 28,
            fontWeight: FontWeight.w800,
            color: Colors.white,
            letterSpacing: -0.5,
          ),
        ),
        const SizedBox(height: 8),
        Text(
          'Complete the verification steps to assign and pick up your vehicle',
          style: GoogleFonts.inter(
            fontSize: 14,
            fontWeight: FontWeight.w400,
            color: Colors.white.withOpacity(0.8),
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
}) {
  return Container(
    decoration: BoxDecoration(
      color: Colors.white,
      border: const Border(
        top: BorderSide(color: Color(0xFFF3F4F6), width: 1),
      ),
      boxShadow: [
        BoxShadow(
          color: Colors.black.withOpacity(0.04),
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
              backgroundColor: kPrimaryColor,
              foregroundColor: Colors.white,
              disabledBackgroundColor: const Color(0xFFE2E8F0),
              disabledForegroundColor: const Color(0xFF94A3B8),
              elevation: 0,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(12),
              ),
            ),
            child: Text(
              'Next: Final Confirmation',
              style: GoogleFonts.inter(
                fontSize: 15,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ),
        const SizedBox(height: 12),
        Text(
          'ENSURE ALL DETAILS ARE ACCURATE BEFORE PROCEEDING',
          textAlign: TextAlign.center,
          style: GoogleFonts.inter(
            fontSize: 9,
            fontWeight: FontWeight.w800,
            color: kOutlineColor.withOpacity(0.7),
            letterSpacing: 1.0,
          ),
        ),
      ],
    ),
  );
}

/// Photo source dialog
void showImageSourceDialog(BuildContext context, String type,
    Function(String, bool) onUpload) {
  showModalBottomSheet(
    context: context,
    shape: const RoundedRectangleBorder(
      borderRadius: BorderRadius.vertical(top: Radius.circular(16)),
    ),
    builder: (context) {
      return SafeArea(
        child: Wrap(
          children: [
            ListTile(
              leading: const Icon(Icons.camera_alt, color: kPrimaryColor),
              title: const Text('Take a Photo'),
              onTap: () {
                Navigator.pop(context);
                onUpload(type, true);
              },
            ),
            ListTile(
              leading: const Icon(Icons.photo_library, color: kPrimaryColor),
              title: const Text('Choose from Gallery'),
              onTap: () {
                Navigator.pop(context);
                onUpload(type, false);
              },
            ),
          ],
        ),
      );
    },
  );
}
