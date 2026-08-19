import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class PlanHeaderCard extends StatelessWidget {
  final VoidCallback? onBack;

  const PlanHeaderCard({super.key, this.onBack});

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
          child: Row(
            children: [
              if (onBack != null) ...[
                InkWell(
                  onTap: onBack,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: AppColors.of(context).card,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      border: Border.all(
                        color: AppColors.of(context).outlineVariant,
                      ),
                    ),
                    child: Icon(
                      Icons.arrow_back_ios_new,
                      size: 18,
                      color: AppColors.of(context).onSurface,
                    ),
                  ),
                ),
                const SizedBox(width: 16),
              ],
              Expanded(
                child: Text(
                  'Select a new plan',
                  style: AppTypography.headingMedium.copyWith(
                    // DARK-MODE-AUDIT 2026-08-14 P0-7:
                    // same as above — read from the theme.
                    color: AppColors.of(context).onSurface,
                    letterSpacing: -0.5,
                  ),
                ),
              ),
            ],
          ),
        ),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20),
          child: Text(
            'Choose the rental duration that best fits your needs. You can change this at any time.',
            style: GoogleFonts.plusJakartaSans(
              fontSize: 14,
              color: AppColors.of(context).onSurfaceVariant,
              height: 1.5,
            ),
          ),
        ),
      ],
    );
  }
}
