import 'package:flutter/material.dart';
import 'package:voltium_rider/data/troubleshooter_tree.dart';

const vfBlue = Color(0xFF0053C1);
const vfBlueLight = Color(0xFFE8F0FE);

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
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Card(
        elevation: 0,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(14),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: color.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
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
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                              fontWeight: FontWeight.w600,
                              color: const Color(0xFF1A1A2E),
                            ),
                      ),
                      if (description != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          description!,
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                                color: const Color(0xFF6B7280),
                              ),
                        ),
                      ],
                    ],
                  ),
                ),
                Icon(
                  Icons.chevron_right,
                  color: const Color(0xFF9CA3AF),
                ),
              ],
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
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          children: [
            Container(
              width: 64,
              height: 64,
              decoration: BoxDecoration(
                color: categoryColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(18),
              ),
              child: Icon(icon, color: categoryColor, size: 32),
            ),
            const SizedBox(height: 20),
            Text(
              question,
              textAlign: TextAlign.center,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                fontSize: 17,
                color: const Color(0xFF1A1A2E),
                height: 1.4,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Answer honestly for the most accurate diagnosis.',
              textAlign: TextAlign.center,
              style: theme.textTheme.bodySmall?.copyWith(
                color: const Color(0xFF9CA3AF),
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
                backgroundColor: Colors.green,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: const Icon(Icons.check_circle_outline, size: 20),
              label: const Text(
                'Yes',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
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
                backgroundColor: Colors.red.shade600,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(14),
                ),
              ),
              icon: const Icon(Icons.cancel_outlined, size: 20),
              label: const Text(
                'No',
                style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
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
    final theme = Theme.of(context);
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      color: Colors.white,
      child: Theme(
        data: theme.copyWith(dividerColor: Colors.transparent),
        child: ExpansionTile(
          tilePadding: const EdgeInsets.symmetric(horizontal: 16),
          childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 12),
          leading: const Icon(Icons.history, size: 18, color: Color(0xFF9CA3AF)),
          title: Text(
            'Your answers (${path.length})',
            style: theme.textTheme.titleSmall?.copyWith(
              fontWeight: FontWeight.w600,
              color: const Color(0xFF6B7280),
            ),
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
                            ? Colors.green.withOpacity(0.15)
                            : Colors.red.withOpacity(0.15),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Icon(
                        answer.answer ? Icons.check : Icons.close,
                        size: 12,
                        color: answer.answer ? Colors.green : Colors.red,
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        answer.question,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: const Color(0xFF4B5563),
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
  final String resolutionType;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final (title, titleColor) = switch (resolutionType) {
      'SUCCESS' => ('Issue Resolved', Colors.green),
      'FAILED' => ('Troubleshooting Tip', Colors.orange),
      'NEEDS_SUPPORT' => ('Support Required', vfBlue),
      'DANGER' => ('Safety Warning', Colors.red),
      _ => ('Result', Colors.grey),
    };

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: titleColor.withOpacity(0.3)),
      ),
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          children: [
            Text(
              title,
              style: theme.textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w700,
                color: titleColor,
              ),
            ),
            const SizedBox(height: 12),
            Text(
              resolution,
              textAlign: TextAlign.center,
              style: theme.textTheme.bodyMedium?.copyWith(
                color: const Color(0xFF1A1A2E),
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
    final theme = Theme.of(context);

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
                  ? Colors.green.withOpacity(0.15)
                  : Colors.red.withOpacity(0.15),
              shape: BoxShape.circle,
            ),
            alignment: Alignment.center,
            child: Text(
              '$stepNumber',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: answer.answer ? Colors.green : Colors.red,
              ),
            ),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  answer.question,
                  style: theme.textTheme.bodySmall?.copyWith(
                    color: const Color(0xFF4B5563),
                  ),
                ),
                const SizedBox(height: 2),
                Row(
                  children: [
                    Icon(
                      answer.answer ? Icons.check : Icons.close,
                      size: 14,
                      color: answer.answer
                          ? Colors.green.shade700
                          : Colors.red.shade700,
                    ),
                    const SizedBox(width: 4),
                    Text(
                      answer.answer ? 'Yes' : 'No',
                      style: theme.textTheme.labelSmall?.copyWith(
                        fontWeight: FontWeight.w700,
                        color: answer.answer
                            ? Colors.green.shade700
                            : Colors.red.shade700,
                      ),
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
          color: vfBlueLight,
          borderRadius: BorderRadius.circular(24),
        ),
        child: const Icon(
          Icons.build_circle_rounded,
          color: vfBlue,
          size: 44,
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
        color: vfBlueLight,
        borderRadius: BorderRadius.circular(20),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.timeline, size: 16, color: vfBlue),
          const SizedBox(width: 6),
          Text(
            'Step $currentStep of $totalSteps',
            style: const TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.w600,
              color: vfBlue,
            ),
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

  final String resolutionType;

  @override
  Widget build(BuildContext context) {
    final (icon, color, bgColor) = switch (resolutionType) {
      'SUCCESS' => (
          Icons.check_circle_rounded,
          Colors.green,
          Colors.green.withOpacity(0.12),
        ),
      'FAILED' => (
          Icons.error_outline,
          Colors.orange,
          Colors.orange.withOpacity(0.12),
        ),
      'NEEDS_SUPPORT' => (
          Icons.support_agent_rounded,
          vfBlue,
          vfBlueLight,
        ),
      'DANGER' => (
          Icons.warning_rounded,
          Colors.red,
          Colors.red.withOpacity(0.12),
        ),
      _ => (
          Icons.info_outline,
          Colors.grey,
          Colors.grey.withOpacity(0.12),
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
    final theme = Theme.of(context);

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                const Icon(Icons.route, size: 18, color: Color(0xFF6B7280)),
                const SizedBox(width: 8),
                Text(
                  'Diagnostic path taken',
                  style: theme.textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF1A1A2E),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 12),
            const Divider(height: 1),
            const SizedBox(height: 8),
            for (int i = 0; i < path.length; i++) ...[
              PathStep(stepNumber: i + 1, answer: path[i]),
              if (i < path.length - 1) ...[
                const Padding(
                  padding: EdgeInsets.only(left: 13),
                  child: SizedBox(
                    height: 16,
                    child: VerticalDivider(
                      width: 2,
                      thickness: 1.5,
                      color: Color(0xFFE5E7EB),
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
          disabledBackgroundColor: vfBlue.withOpacity(0.5),
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
                  color: Colors.white.withOpacity(0.8),
                ),
              )
            : const Icon(Icons.send_rounded, size: 18),
        label: Text(
          isSubmitting ? 'Submitting...' : 'Create Support Ticket',
          style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 15),
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
          backgroundColor: Colors.red,
          foregroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
        icon: const Icon(Icons.warning_amber_rounded, size: 22),
        label: const Text(
          'Emergency SOS',
          style: TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
        ),
      ),
    );
  }
}

