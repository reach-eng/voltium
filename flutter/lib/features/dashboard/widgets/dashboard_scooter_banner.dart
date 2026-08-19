import 'package:flutter/material.dart';
import '../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

import 'package:voltium_rider/gen/app_localizations.dart';

/// Scooter submission required banner widget.
class ScooterSubmissionBanner extends StatelessWidget {
  final String? submissionDate;
  final String? pickupHub;
  final String? returnIntent;

  const ScooterSubmissionBanner({
    super.key,
    this.submissionDate,
    this.pickupHub,
    this.returnIntent,
  });

  String _formatDate(DateTime date) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    const weekdays = [
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday',
      'Sunday',
    ];
    return '${weekdays[date.weekday - 1]}, ${months[date.month - 1]} ${date.day}, ${date.year}';
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final String formattedDate = submissionDate != null
        ? _formatDate(DateTime.parse(submissionDate!))
        : (l10n?.txtpendingReturnSubmission ?? 'Friday, Oct 27, 2023');

    final String hub =
        (pickupHub == null || pickupHub!.isEmpty || pickupHub == 'Not Assigned')
            ? (l10n != null ? l10n.txtdesignatedHub : 'New Delhi Central')
            : pickupHub!;

    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(color: AppColors.error, width: 1.5),
        boxShadow: [
          BoxShadow(
            color: AppColors.error.withValues(alpha: 0.05),
            blurRadius: 20,
            offset: const Offset(0, 4),
          ),
        ],
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        child: Stack(
          children: [
            const Positioned(
              right: -20,
              bottom: -20,
              child: Icon(
                Icons.insights,
                size: 120,
                color: AppColors.errorSurface,
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(Spacing.md),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.all(Spacing.sm),
                    decoration: BoxDecoration(
                      color: AppColors.errorSurface,
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                    ),
                    child: Container(
                      padding: Spacing.paddingXs,
                      decoration: const BoxDecoration(
                        color: AppColors.error,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.priority_high,
                        color: Colors.white,
                        size: 14,
                      ),
                    ),
                  ),
                  const SizedBox(width: 16),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          l10n?.txtscooterSubmissionRequired ??
                              'Scooter Submission\nRequired',
                          style: AppTypography.titleMedium
                              .copyWith(color: colors.onSurface, height: 1.3),
                        ),
                        const SizedBox(height: 12),
                        Text(
                          l10n != null
                              ? l10n.txtsubmissionDatePrefix(formattedDate)
                              : 'Submission Date: $formattedDate',
                          style: AppTypography.bodyMedium
                              .copyWith(fontSize: 13)
                              .copyWith(color: colors.onSurface),
                        ),
                        const SizedBox(height: 4),
                        Text(
                          l10n != null
                              ? l10n.txthubNamePrefix(hub)
                              : 'Hub Name: $hub',
                          style: AppTypography.bodyMedium
                              .copyWith(fontSize: 13)
                              .copyWith(color: colors.onSurface),
                        ),
                      ],
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
