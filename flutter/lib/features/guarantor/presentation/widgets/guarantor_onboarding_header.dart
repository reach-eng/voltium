import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class GuarantorOnboardingHeader extends StatelessWidget {
  final VoidCallback? onBack;

  const GuarantorOnboardingHeader({super.key, this.onBack});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      height: 56,
      decoration: BoxDecoration(
        color: colors.card,
        border:
            Border(bottom: BorderSide(color: colors.outlineVariant, width: 1)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
        child: Row(
          children: [
            IconButton(
              icon: const Icon(Icons.arrow_back),
              onPressed: onBack,
            ),
            Expanded(
              child: Text(
                'Guarantor\'s Onboarding',
                textAlign: TextAlign.center,
                style: AppTypography.titleMedium,
              ),
            ),
            Padding(
              padding: EdgeInsets.only(right: 8),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'Step',
                    style: GoogleFonts.plusJakartaSans(
                        fontSize: 12, color: colors.onSurfaceMuted),
                  ),
                  Text(
                    '2/2',
                    style: AppTypography.bodySmall
                        .copyWith(fontWeight: FontWeight.w600),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}
