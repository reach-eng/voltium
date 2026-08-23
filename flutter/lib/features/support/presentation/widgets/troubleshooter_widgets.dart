import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/data/troubleshooter_tree.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

const vfBlue = AppColors.primary;
// NOTE: previously a `const vfBlueLight` here, removed because
// `AppColors.of(context).primarySurface` is not a const expression.
// Call sites that previously used `vfBlueLight` now read
// `AppColors.of(context).primarySurface` directly so they are
// brightness-aware in dark mode.

IconData tsIconData(String name) {
  return switch (name) {
    'speed' => Icons.speed_rounded,
    'display_settings' => Icons.display_settings_rounded,
    'battery_charging_full' => Icons.battery_charging_full_rounded,
    'hearing' => Icons.hearing_rounded,
    'lock_open' => Icons.lock_open_rounded,
    'gps_off' => Icons.gps_off_rounded,
    'tire_repair' => Icons.tire_repair_rounded,
    _ => Icons.help_outline_rounded,
  };
}

class CategoryCard extends StatelessWidget {
  const CategoryCard({
    super.key,
    required this.icon,
    required this.color,
    required this.title,
    this.description,
    required this.onTap,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String? description;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Container(
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.glass,
          border: Border.all(
            color: colors.outlineVariant.withValues(alpha: 0.5),
            width: 1,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
              child: Row(
                children: [
                  Container(
                    width: 44,
                    height: 44,
                    decoration: BoxDecoration(
                      color: color.withValues(alpha: 0.12),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Icon(icon, color: color, size: 22),
                  ),
                  const SizedBox(width: 14),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          title,
                          style: AppTypography.titleSmall
                              .copyWith(color: colors.onSurface),
                        ),
                        if (description != null) ...[
                          const SizedBox(height: 4),
                          Text(
                            description!,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              color: colors.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ],
                    ),
                  ),
                  Icon(
                    Icons.chevron_right,
                    color: colors.onSurfaceMuted,
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class QuestionCard extends StatelessWidget {
  const QuestionCard({
    super.key,
    required this.question,
    required this.icon,
    required this.categoryColor,
  });

  final String question;
  final IconData icon;
  final Color categoryColor;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.glass,
        border: Border.all(
          color: colors.outlineVariant.withValues(alpha: 0.5),
          width: 1,
        ),
      ),
      child: Padding(
        padding: Spacing.paddingLg,
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: categoryColor.withValues(alpha: 0.12),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(icon, color: categoryColor, size: 32),
            ),
            const SizedBox(height: 20),
            Text(
              question,
              textAlign: TextAlign.center,
              style: AppTypography.titleMedium
                  .copyWith(color: colors.onSurface, height: 1.4),
            ),
            const SizedBox(height: 12),
            Text(
              'Answer honestly for the most accurate diagnosis.',
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                color: colors.onSurfaceVariant,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class ActionButtons extends StatelessWidget {
  const ActionButtons({
    super.key,
    required this.onYes,
    required this.onNo,
  });

  final VoidCallback onYes;
  final VoidCallback onNo;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: SizedBox(
            height: 52,
            child: FilledButton.icon(
              onPressed: onYes,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.success,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: const Icon(Icons.check_circle_outline, size: 20),
              label: Text(
                'Yes',
                style: AppTypography.titleSmall,
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: SizedBox(
            height: 52,
            child: FilledButton.icon(
              onPressed: onNo,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.errorDark,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: const Icon(Icons.cancel_outlined, size: 20),
              label: Text(
                'No',
                style: AppTypography.titleSmall,
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class PathSummary extends StatelessWidget {
  const PathSummary({
    super.key,
    required this.path,
  });

  final List<TroubleshooterAnswer> path;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.glass,
        border: Border.all(
          color: colors.outlineVariant.withValues(alpha: 0.5),
          width: 1,
        ),
      ),
      child: Theme(
        data: Theme.of(context).copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          leading: Icon(Icons.history, size: 18, color: colors.onSurfaceMuted),
          title: Text(
            'Your answers (${path.length})',
            style: AppTypography.bodyMedium
                .copyWith(fontWeight: FontWeight.w600)
                .copyWith(color: colors.onSurfaceVariant),
          ),
          children: [
            for (final answer in path)
              Padding(
                padding: const EdgeInsets.only(bottom: 6),
                child: Row(
                  children: [
                    Container(
                      width: 20,
                      height: 20,
                      decoration: BoxDecoration(
                        color: answer.answer
                            ? AppColors.success.withValues(alpha: 0.15)
                            : AppColors.error.withValues(alpha: 0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Icon(
                        answer.answer ? Icons.check : Icons.close,
                        size: 12,
                        color:
                            answer.answer ? AppColors.success : AppColors.error,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        answer.question,
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 13,
                          color: colors.onSurface,
                        ),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
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

class ResolutionCard extends StatelessWidget {
  const ResolutionCard({
    super.key,
    required this.resolution,
    required this.resolutionType,
  });

  final String resolution;
  // PR-7 (F-066): typed enum instead of String.
  final TroubleshooterResolutionType resolutionType;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    // PR-7 (F-066): exhaustive enum switch (the `_` default is
    // removed because the compiler now guarantees the switch
    // covers every `TroubleshooterResolutionType` value).
    final (title, titleColor) = switch (resolutionType) {
      TroubleshooterResolutionType.success => (
          'Issue Resolved',
          AppColors.success
        ),
      TroubleshooterResolutionType.needsSupport => ('Support Required', vfBlue),
      TroubleshooterResolutionType.danger => (
          'Safety Warning',
          AppColors.error
        ),
    };

    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.glass,
        border: Border.all(
          color: titleColor.withValues(alpha: 0.3),
          width: 1.5,
        ),
      ),
      child: Padding(
        padding: Spacing.paddingLg,
        child: Column(
          children: [
            Text(
              title,
              style: AppTypography.titleMedium.copyWith(color: titleColor),
            ),
            const SizedBox(height: 12),
            Text(
              resolution,
              textAlign: TextAlign.center,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 15,
                color: colors.onSurface,
                height: 1.5,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class PathStep extends StatelessWidget {
  const PathStep({
    super.key,
    required this.stepNumber,
    required this.answer,
  });

  final int stepNumber;
  final TroubleshooterAnswer answer;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 28,
            height: 28,
            decoration: BoxDecoration(
              color: answer.answer
                  ? AppColors.success.withValues(alpha: 0.15)
                  : AppColors.error.withValues(alpha: 0.15),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              '$stepNumber',
              style: AppTypography.labelMedium.copyWith(
                  color: answer.answer ? AppColors.success : AppColors.error),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  answer.question,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    color: colors.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(
                      answer.answer ? Icons.check : Icons.close,
                      size: 14,
                      color: answer.answer
                          ? AppColors.successDark
                          : AppColors.errorDark,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      answer.answer ? 'Yes' : 'No',
                      style: AppTypography.labelMedium.copyWith(
                          color: answer.answer
                              ? AppColors.successDark
                              : AppColors.errorDark),
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class TroubleshooterHeaderIcon extends StatelessWidget {
  const TroubleshooterHeaderIcon({super.key});

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Container(
        width: 80,
        height: 80,
        decoration: BoxDecoration(
          color: AppColors.of(context).primarySurface,
          borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        ),
        child: const Icon(
          Icons.build_circle_outlined,
          color: AppColors.primary,
          size: 40,
        ),
      ),
    );
  }
}

class TroubleshooterStepCounter extends StatelessWidget {
  const TroubleshooterStepCounter({
    super.key,
    required this.currentStep,
    required this.totalSteps,
  });

  final int currentStep;
  final int totalSteps;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.of(context).primarySurface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.timeline, size: 16, color: vfBlue),
          SizedBox(width: 6),
          Text(
            'Step $currentStep of $totalSteps',
            style: AppTypography.bodyMedium
                .copyWith(fontSize: 13, fontWeight: FontWeight.w700)
                .copyWith(color: vfBlue),
          ),
        ],
      ),
    );
  }
}

class TroubleshooterResultIcon extends StatelessWidget {
  const TroubleshooterResultIcon({
    super.key,
    required this.resolutionType,
  });

  // PR-7 (F-066): typed enum instead of String.
  final TroubleshooterResolutionType resolutionType;

  @override
  Widget build(BuildContext context) {
    // PR-7 (F-066): exhaustive enum switch.
    final (icon, color, bgColor) = switch (resolutionType) {
      TroubleshooterResolutionType.success => (
          Icons.check_circle_rounded,
          AppColors.success,
          AppColors.success.withValues(alpha: 0.12),
        ),
      TroubleshooterResolutionType.needsSupport => (
          Icons.support_agent_rounded,
          vfBlue,
          AppColors.of(context).primarySurface,
        ),
      TroubleshooterResolutionType.danger => (
          Icons.warning_rounded,
          AppColors.error,
          AppColors.error.withValues(alpha: 0.12),
        ),
    };

    return Container(
      width: 88,
      height: 88,
      decoration: BoxDecoration(
        color: bgColor,
        shape: BoxShape.circle,
      ),
      child: Icon(icon, color: color, size: 48),
    );
  }
}

class TroubleshooterPathTakenCard extends StatelessWidget {
  const TroubleshooterPathTakenCard({
    super.key,
    required this.path,
  });

  final List<TroubleshooterAnswer> path;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.glass,
        border: Border.all(
          color: colors.outlineVariant.withValues(alpha: 0.5),
          width: 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.route, size: 18, color: colors.onSurfaceMuted),
                const SizedBox(width: 8),
                Text(
                  'Diagnostic path taken',
                  style: AppTypography.labelLarge
                      .copyWith(color: colors.onSurface),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 12),
            for (int i = 0; i < path.length; i++) ...[
              PathStep(stepNumber: i + 1, answer: path[i]),
              if (i < path.length - 1) ...[
                Padding(
                  padding: const EdgeInsets.only(left: 13),
                  child: SizedBox(
                    height: 16,
                    child: VerticalDivider(
                      width: 2,
                      thickness: 1.5,
                      color: colors.borderSubtle,
                    ),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}

class TroubleshooterSupportTicketButton extends StatelessWidget {
  const TroubleshooterSupportTicketButton({
    super.key,
    required this.onPressed,
    required this.isSubmitting,
  });

  final VoidCallback? onPressed;
  final bool isSubmitting;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: vfBlue,
          foregroundColor: Colors.white,
          disabledBackgroundColor: vfBlue.withValues(alpha: 0.5),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
        icon: isSubmitting
            ? SizedBox(
                width: 18,
                height: 18,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white.withValues(alpha: 0.8),
                ),
              )
            : const Icon(Icons.send_rounded, size: 18),
        label: Text(
          isSubmitting ? 'Submitting...' : 'Create Support Ticket',
          style: AppTypography.labelLarge.copyWith(fontWeight: FontWeight.w700),
        ),
      ),
    );
  }
}

class TroubleshooterSosButton extends StatelessWidget {
  const TroubleshooterSosButton({
    super.key,
    required this.onPressed,
  });

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      child: FilledButton.icon(
        onPressed: onPressed,
        style: FilledButton.styleFrom(
          backgroundColor: AppColors.error,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
        icon: const Icon(Icons.warning_amber_rounded, size: 22),
        label: Text(
          'Emergency SOS',
          style: AppTypography.titleSmall,
        ),
      ),
    );
  }
}
