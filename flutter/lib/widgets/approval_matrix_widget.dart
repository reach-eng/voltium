import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/rider_model.dart';
import '../theme/app_theme.dart';
import '../utils/lifecycle_rank.dart';
import 'package:voltium_rider/theme/app_typography.dart';

enum StepStatus { completed, pending, rejected, active }

class _StepData {
  final String label;
  final StepStatus status;
  final IconData icon;
  final String? subtitle;

  _StepData({
    required this.label,
    required this.status,
    required this.icon,
    this.subtitle,
  });

  bool get isDone => status == StepStatus.completed;
  bool get isRejected => status == StepStatus.rejected;
  bool get isActive => status == StepStatus.active;
}

class ApprovalMatrixWidget extends StatelessWidget {
  final RiderModel rider;

  const ApprovalMatrixWidget({super.key, required this.rider});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final rank = lifecycleRank(rider);
    final isKycRejected = rider.kycStatus == KycStatus.rejected;
    final isPlanRejected = rider.planStatus == 'REJECTED';
    final isDepositRejected =
        rider.depositRecord?.status == DepositStatus.rejected;

    final List<_StepData> steps = [
      _StepData(
        label: 'Registration',
        status: _getStepStatus(
          rank >= 3,
          rank < 3,
          false,
        ),
        icon: Icons.person_add_outlined,
      ),
      _StepData(
        label: 'Rental Plan',
        status: _getStepStatus(
          rank >= 4 && !isPlanRejected,
          rank >= 3 && rank < 4,
          isPlanRejected,
        ),
        icon: Icons.event_repeat_outlined,
        subtitle: isPlanRejected ? 'Reselect Plan' : null,
      ),
      _StepData(
        label: 'Deposit',
        status: _getStepStatus(
          rank >= 6 && !isDepositRejected,
          rank >= 4 && rank < 6,
          isDepositRejected,
        ),
        icon: Icons.account_balance_outlined,
        subtitle: isDepositRejected ? 'Re-upload Proof' : null,
      ),
      _StepData(
        label: 'KYC',
        status: _getStepStatus(
          rank >= 8,
          rank >= 6 && rank < 8 && !isKycRejected,
          isKycRejected,
        ),
        icon: Icons.shield_outlined,
        subtitle: isKycRejected
            ? 'Update Documents'
            : (rank >= 2 && rank < 8 && !isKycRejected ? 'Under Review' : null),
      ),
      _StepData(
        label: 'Pickup',
        status: _getStepStatus(
          rank >= 9,
          rank >= 8 && rank < 9,
          false,
        ),
        icon: Icons.electric_scooter_outlined,
      ),
    ];

    final completedCount = steps.where((s) => s.isDone).length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Approval Matrix',
              style: AppTypography.titleSmall.copyWith(color: colors.onSurface),
            ),
            Text(
              '$completedCount/${steps.length} Done',
              style: AppTypography.overline
                  .copyWith(color: colors.onSurfaceVariant, letterSpacing: 0.5),
            ),
          ],
        ),
        const SizedBox(height: 16),
        ListView.separated(
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          itemCount: steps.length,
          separatorBuilder: (_, __) => const SizedBox(height: 12),
          itemBuilder: (context, index) {
            final step = steps[index];
            return _buildStepItem(context, colors, step);
          },
        ),
      ],
    );
  }

  StepStatus _getStepStatus(bool isCompleted, bool isNext, bool isRejected) {
    if (isRejected) return StepStatus.rejected;
    if (isCompleted) return StepStatus.completed;
    if (isNext) return StepStatus.active;
    return StepStatus.pending;
  }

  Widget _buildStepItem(
      BuildContext context, ThemeColors colors, _StepData step) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: step.isDone
            ? AppColors.successSurfaceLight
            : step.isRejected
                ? AppColors.errorSurface
                : AppColors.surfaceBright,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: step.isDone
              ? AppColors.successSurface
              : step.isRejected
                  ? AppColors.errorBorder
                  : Colors.transparent,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: step.isDone
                  ? AppColors.success
                  : step.isRejected
                      ? AppColors.error
                      : colors.outlineVariant,
            ),
            child: Center(
              child: step.isDone
                  ? const Icon(Icons.check, color: Colors.white, size: 18)
                  : step.isRejected
                      ? const Icon(Icons.close, color: Colors.white, size: 18)
                      : Icon(
                          step.icon,
                          size: 16,
                          color: colors.onSurfaceMuted,
                        ),
            ),
          ),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.label,
                  style: AppTypography.bodyCompactStrong.copyWith(
                    color: step.isDone
                        ? AppColors.successText
                        : step.isRejected
                            ? AppColors.dangerText
                            : colors.onSurface,
                  ),
                ),
                if (step.subtitle != null) ...[
                  SizedBox(height: 2),
                  Text(
                    step.subtitle!,
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: step.isRejected
                          ? AppColors.error
                          : colors.onSurfaceVariant,
                    ),
                  ),
                ],
              ],
            ),
          ),
          Text(
            step.isDone
                ? 'COMPLETED'
                : step.isRejected
                    ? 'REJECTED'
                    : 'PENDING',
            style: AppTypography.microBadge.copyWith(
                letterSpacing: 0.8,
                color: step.isDone
                    ? AppColors.success
                    : step.isRejected
                        ? AppColors.error
                        : colors.onSurfaceMuted),
          ),
        ],
      ),
    );
  }
}
