import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';

class GuarantorOnboardingProgressSection extends StatelessWidget {
  const GuarantorOnboardingProgressSection({super.key});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      color: colors.card,
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.xs),
            child: Container(
              height: 8,
              color: AppColors.success,
            ),
          ),
          SizedBox(height: 24),
          Text(
            'One more step',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 24, fontWeight: FontWeight.w700),
          ),
          SizedBox(height: 8),
          Text(
            'We need a few more details to set up your fleet profile securely.',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 14, color: colors.onSurfaceMuted),
          ),
        ],
      ),
    );
  }
}
