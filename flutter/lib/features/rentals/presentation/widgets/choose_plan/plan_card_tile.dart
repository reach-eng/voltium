import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/models/plan_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class PlanCardTile extends StatelessWidget {
  final PlanModel plan;
  final bool isSelected;
  final bool isCurrentPlan;
  final bool isBestValue;
  final List<String> features;
  final VoidCallback onTap;

  const PlanCardTile({
    super.key,
    required this.plan,
    required this.isSelected,
    required this.isCurrentPlan,
    required this.isBestValue,
    required this.features,
    required this.onTap,
  });

  String _formatPrice(double price) {
    if (price == price.toInt()) {
      return '₹${price.toInt()}.00';
    }
    return '₹${price.toStringAsFixed(2)}';
  }

  String _formatCycle(int days) {
    if (days == 1) return 'day';
    if (days == 7) return 'week';
    if (days == 30) return 'month';
    return '$days days';
  }

  IconData _getFeatureIcon(String feature) {
    final f = feature.toLowerCase();
    if (f.contains('charge') || f.contains('charging') || f.contains('power')) {
      return Icons.bolt_rounded;
    } else if (f.contains('insurance') ||
        f.contains('liability') ||
        f.contains('coverage') ||
        f.contains('secure')) {
      return Icons.shield_outlined;
    } else if (f.contains('support') ||
        f.contains('24/7') ||
        f.contains('help')) {
      return Icons.headset_mic_outlined;
    } else if (f.contains('airport') ||
        f.contains('concierge') ||
        f.contains('star')) {
      return Icons.star_rounded;
    } else if (f.contains('wash') ||
        f.contains('clean') ||
        f.contains('water')) {
      return Icons.local_car_wash_rounded;
    }
    return Icons.check_circle_outline_rounded;
  }

  Widget _buildBestValueBadge({required bool isSelected}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isSelected
            ? Colors.white.withValues(alpha: 0.2)
            : AppColors.accentPurpleSurface,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        'BEST VALUE',
        style: AppTypography.bodySmall
            .copyWith(fontWeight: FontWeight.w800)
            .copyWith(
              color: isSelected ? Colors.white : AppColors.accentPurple,
              letterSpacing: 0.5,
            ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: GestureDetector(
        onTap: onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeInOut,
          margin: const EdgeInsets.only(bottom: 16),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : Colors.white,
            borderRadius: BorderRadius.circular(AppRadius.radiusModal),
            border: Border.all(
              color: isSelected ? Colors.transparent : AppColors.outlineVariant,
              width: 1.5,
            ),
            boxShadow: [
              BoxShadow(
                color: isSelected
                    ? AppColors.primary.withValues(alpha: 0.2)
                    : Colors.black.withValues(alpha: 0.02),
                blurRadius: 16,
                offset: const Offset(0, 8),
              ),
            ],
          ),
          child: Padding(
            padding: Spacing.paddingLg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Expanded(
                      child: isSelected
                          ? Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  isCurrentPlan
                                      ? 'CURRENT PLAN'
                                      : 'SELECTED PLAN',
                                  style: AppTypography.bodySmall
                                      .copyWith(fontWeight: FontWeight.w800)
                                      .copyWith(
                                        color:
                                            Colors.white.withValues(alpha: 0.8),
                                        letterSpacing: 0.5,
                                      ),
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  children: [
                                    if (isBestValue) ...[
                                      _buildBestValueBadge(isSelected: true),
                                      const SizedBox(width: 8),
                                    ],
                                    Expanded(
                                      child: Text(
                                        plan.name,
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 18,
                                          fontWeight: FontWeight.bold,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            )
                          : Row(
                              children: [
                                if (isBestValue) ...[
                                  _buildBestValueBadge(isSelected: false),
                                  const SizedBox(width: 8),
                                ],
                                Expanded(
                                  child: Text(
                                    plan.name,
                                    style: GoogleFonts.plusJakartaSans(
                                      fontSize: 16,
                                      fontWeight: FontWeight.bold,
                                      color: const Color(0xFF0F172A),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                    ),
                    Container(
                      width: 24,
                      height: 24,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: isSelected ? Colors.white : Colors.transparent,
                        border: Border.all(
                          color: isSelected
                              ? Colors.white
                              : AppColors.borderMedium,
                          width: 2,
                        ),
                      ),
                      child: isSelected
                          ? const Icon(
                              Icons.check,
                              size: 14,
                              color: AppColors.primary,
                            )
                          : null,
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                Row(
                  crossAxisAlignment: CrossAxisAlignment.baseline,
                  textBaseline: TextBaseline.alphabetic,
                  children: [
                    Text(
                      _formatPrice(plan.price),
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 28,
                        fontWeight: FontWeight.w800,
                        color: isSelected ? Colors.white : AppColors.slate900,
                        letterSpacing: -1,
                      ),
                    ),
                    const SizedBox(width: 4),
                    Text(
                      '/${_formatCycle(plan.durationDays)}',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                        color: isSelected
                            ? Colors.white.withValues(alpha: 0.8)
                            : AppColors.slate500,
                      ),
                    ),
                  ],
                ),
                if (features.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  Divider(
                    color: isSelected
                        ? Colors.white.withValues(alpha: 0.15)
                        : AppColors.iconBackground,
                  ),
                  const SizedBox(height: 12),
                  ...features.map(
                    (feature) => Padding(
                      padding: const EdgeInsets.only(bottom: 8.0),
                      child: Row(
                        children: [
                          Icon(
                            _getFeatureIcon(feature),
                            size: 16,
                            color:
                                isSelected ? Colors.white : AppColors.primary,
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Text(
                              feature,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: isSelected
                                    ? Colors.white.withValues(alpha: 0.9)
                                    : AppColors.slate600,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
