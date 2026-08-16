import 'package:flutter/material.dart';
import '../core/platform/platform_info.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class WebPlatformBanner extends StatelessWidget {
  const WebPlatformBanner({super.key});

  @override
  Widget build(BuildContext context) {
    if (!PlatformInfo.isWeb) return const SizedBox.shrink();

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      color: AppColors.of(context).warningLight,
      child: Row(
        children: [
          const Icon(Icons.info_outline,
              size: 16, color: AppColors.warningDark),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              'Web mode — device admin, background location, and push notifications are not available.',
              style: GoogleFonts.plusJakartaSans(
                  fontSize: 11, color: AppColors.onSurface),
            ),
          ),
        ],
      ),
    );
  }
}
