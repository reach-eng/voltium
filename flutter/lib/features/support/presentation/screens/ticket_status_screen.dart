import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../../models/support_model.dart';
import '../../../../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class TicketStatusScreen extends StatelessWidget {
  final IssueModel ticket;

  const TicketStatusScreen({
    super.key,
    required this.ticket,
  });

  @override
  Widget build(BuildContext context) {
    final status = ticket.status.toUpperCase();
    final isCreated = true; // Always true
    final isAssigned = status == 'ASSIGNED' ||
        status == 'IN_PROGRESS' ||
        status == 'RESOLVED' ||
        status == 'CLOSED';
    final isInProgress =
        status == 'IN_PROGRESS' || status == 'RESOLVED' || status == 'CLOSED';
    final isResolved = status == 'RESOLVED' || status == 'CLOSED';

    final steps = [
      _TimelineStep(
        title: 'Ticket Created',
        description: 'Your ticket has been logged and queued for review.',
        time:
            '${ticket.createdAt.day}/${ticket.createdAt.month}/${ticket.createdAt.year}',
        isCompleted: isCreated,
        isActive: status == 'OPEN',
      ),
      _TimelineStep(
        title: 'Assigned to Agent',
        description:
            'A support representative has been assigned to investigate your issue.',
        time: isAssigned ? 'Completed' : 'Pending',
        isCompleted: isAssigned,
        isActive: status == 'ASSIGNED',
      ),
      _TimelineStep(
        title: 'In Progress',
        description: 'Our team is working on resolving the issue.',
        time: isInProgress ? 'Completed' : 'Pending',
        isCompleted: isInProgress,
        isActive: status == 'IN_PROGRESS',
      ),
      _TimelineStep(
        title: 'Resolved',
        description:
            'The issue has been resolved. Let us know if you need anything else!',
        time: isResolved ? 'Resolved' : 'Pending',
        isCompleted: isResolved,
        isActive: status == 'RESOLVED' || status == 'CLOSED',
      ),
    ];

    return Scaffold(
      backgroundColor: AppColors.surfaceAlt,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Row(
                children: [
                  GestureDetector(
                    key: const Key('backButton'),
                    onTap: () => Navigator.pop(context),
                    child: Container(
                      width: 40,
                      height: 40,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                        boxShadow: AppShadows.glass,
                      ),
                      child: const Icon(
                        Icons.arrow_back,
                        size: 20,
                        color: AppColors.onSurface,
                      ),
                    ),
                  ),
                  SizedBox(width: 16),
                  Text(
                    'Ticket Status',
                    style: AppTypography.titleSmall
                        .copyWith(color: AppColors.onSurface),
                  ),
                ],
              ),
            ),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.all(24),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Ticket info card
                    Container(
                      width: double.infinity,
                      padding: const EdgeInsets.all(20),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withValues(alpha: 0.02),
                            blurRadius: 15,
                            offset: const Offset(0, 4),
                          )
                        ],
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'TICKET ID',
                                style: AppTypography.microOverline.copyWith(
                                    color: AppColors.primary,
                                    letterSpacing: 1.2),
                              ),
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: (isResolved
                                          ? AppColors.success
                                          : AppColors.primary)
                                      .withValues(alpha: 0.1),
                                  borderRadius: BorderRadius.circular(12),
                                ),
                                child: Text(
                                  ticket.status.replaceAll('_', ' '),
                                  style: AppTypography.microOverline.copyWith(
                                      color: isResolved
                                          ? AppColors.success
                                          : AppColors.primary),
                                ),
                              ),
                            ],
                          ),
                          SizedBox(height: 6),
                          Text(
                            ticket.ticketId,
                            style: AppTypography.titleSmall
                                .copyWith(color: AppColors.onSurface),
                          ),
                          const Divider(height: 24),
                          Text(
                            'SUBJECT',
                            style: AppTypography.microBadge.copyWith(
                                color: AppColors.onSurfaceVariant,
                                letterSpacing: 1),
                          ),
                          SizedBox(height: 4),
                          Text(
                            ticket.subject,
                            style: AppTypography.labelLarge
                                .copyWith(color: AppColors.onSurface),
                          ),
                          SizedBox(height: 12),
                          Text(
                            'MESSAGE',
                            style: AppTypography.microBadge.copyWith(
                                color: AppColors.onSurfaceVariant,
                                letterSpacing: 1),
                          ),
                          SizedBox(height: 4),
                          Text(
                            ticket.message,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              color: AppColors.onSurface,
                              height: 1.4,
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 32),

                    Text(
                      'PROGRESS TIMELINE',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontWeight: FontWeight.w900,
                        color: AppColors.onSurfaceVariant,
                        letterSpacing: 1.2,
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Timeline Widget Implementation
                    ListView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      itemCount: steps.length,
                      itemBuilder: (context, index) {
                        final step = steps[index];
                        final isLast = index == steps.length - 1;
                        return IntrinsicHeight(
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              SizedBox(
                                width: 48,
                                child: Column(
                                  children: [
                                    AnimatedContainer(
                                      duration:
                                          const Duration(milliseconds: 300),
                                      width: 24,
                                      height: 24,
                                      decoration: BoxDecoration(
                                        color: step.isCompleted
                                            ? AppColors.primary
                                            : step.isActive
                                                ? AppColors.primary
                                                    .withValues(alpha: 0.2)
                                                : Colors.grey.shade200,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: step.isCompleted
                                              ? AppColors.primary
                                              : step.isActive
                                                  ? AppColors.primary
                                                  : Colors.grey.shade300,
                                          width: 2,
                                        ),
                                      ),
                                      child: step.isCompleted
                                          ? const Icon(
                                              Icons.check,
                                              size: 14,
                                              color: Colors.white,
                                            )
                                          : null,
                                    ),
                                    if (!isLast)
                                      Expanded(
                                        child: AnimatedContainer(
                                          duration:
                                              const Duration(milliseconds: 300),
                                          width: 3,
                                          color: step.isCompleted
                                              ? AppColors.primary
                                              : Colors.grey.shade300,
                                        ),
                                      ),
                                  ],
                                ),
                              ),
                              Expanded(
                                child: Padding(
                                  padding: const EdgeInsets.only(bottom: 24),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.start,
                                    children: [
                                      Row(
                                        mainAxisAlignment:
                                            MainAxisAlignment.spaceBetween,
                                        children: [
                                          Text(
                                            step.title,
                                            style: AppTypography
                                                .bodyMediumStrong
                                                .copyWith(
                                                    color: step.isCompleted ||
                                                            step.isActive
                                                        ? AppColors.onSurface
                                                        : AppColors
                                                            .onSurfaceVariant),
                                          ),
                                          Text(
                                            step.time,
                                            style: AppTypography.microLabel
                                                .copyWith(
                                                    color: step.isCompleted
                                                        ? AppColors.primary
                                                        : AppColors
                                                            .onSurfaceVariant),
                                          ),
                                        ],
                                      ),
                                      SizedBox(height: 4),
                                      Text(
                                        step.description,
                                        style: GoogleFonts.plusJakartaSans(
                                          fontSize: 12,
                                          color: AppColors.onSurfaceVariant,
                                          height: 1.4,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ],
                          ),
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TimelineStep {
  final String title;
  final String description;
  final String time;
  final bool isCompleted;
  final bool isActive;

  _TimelineStep({
    required this.title,
    required this.description,
    required this.time,
    required this.isCompleted,
    required this.isActive,
  });
}
