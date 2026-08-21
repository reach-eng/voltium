import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/rider_model.dart';
import '../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

enum StepStatus { completed, pending, rejected, active }

class _StepData {
  final String label;
  final StepStatus status;
  final IconData icon;
  final String? subtitle;
  final VoidCallback? onTap;

  _StepData({
    required this.label,
    required this.status,
    required this.icon,
    this.subtitle,
    this.onTap,
  });

  bool get isDone => status == StepStatus.completed;
  bool get isRejected => status == StepStatus.rejected;
  bool get isActive => status == StepStatus.active;
}

class ApprovalMatrixWidget extends StatelessWidget {
  final RiderModel rider;
  final Function(String stepLabel)? onStepTap;

  const ApprovalMatrixWidget({
    super.key,
    required this.rider,
    this.onStepTap,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final isKycRejected = rider.kycStatus == KycStatus.rejected;
    final isPlanRejected = rider.planStatus == 'REJECTED';
    final isDepositRejected =
        rider.depositRecord?.status == DepositStatus.rejected;

    final List<_StepData> steps = [
      _StepData(
        label: 'Registration',
        status: _getStepStatus(
          rider.isRegistrationDone,
          !rider.isRegistrationDone,
          false,
        ),
        icon: Icons.person_add_outlined,
        onTap: onStepTap != null ? () => onStepTap!('Registration') : null,
      ),
      _StepData(
        label: 'Rental Plan',
        status: _getStepStatus(
          rider.isPlanDone,
          rider.isRegistrationDone && !rider.isPlanDone && !isPlanRejected,
          isPlanRejected,
        ),
        icon: Icons.event_repeat_outlined,
        subtitle: isPlanRejected ? 'Reselect Plan' : null,
        onTap: onStepTap != null ? () => onStepTap!('Rental Plan') : null,
      ),
      _StepData(
        label: 'Deposit',
        status: _getStepStatus(
          rider.isDepositDone,
          rider.isPlanDone && !rider.isDepositDone && !isDepositRejected,
          isDepositRejected,
        ),
        icon: Icons.account_balance_outlined,
        subtitle: isDepositRejected ? 'Re-upload Proof' : null,
        onTap: onStepTap != null ? () => onStepTap!('Deposit') : null,
      ),
      _StepData(
        label: 'KYC',
        status: _getStepStatus(
          rider.isKycApproved,
          rider.isDepositDone && !rider.isKycApproved && !isKycRejected,
          isKycRejected,
        ),
        icon: Icons.shield_outlined,
        subtitle: isKycRejected
            ? 'Update Documents'
            : (!rider.isKycApproved ? 'Under Review' : null),
        onTap: onStepTap != null ? () => onStepTap!('KYC') : null,
      ),
      _StepData(
        label: 'Pickup',
        status: _getStepStatus(
          rider.isPickupDone,
          rider.isKycApproved && !rider.isPickupDone,
          false,
        ),
        icon: Icons.electric_scooter_outlined,
        onTap: onStepTap != null ? () => onStepTap!('Pickup') : null,
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
    return InkWell(
      onTap: step.onTap,
      borderRadius: BorderRadius.circular(14),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: step.isDone
              ? colors.successLight
              : step.isRejected
                  ? colors.errorLight
                  : colors.surface,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: step.isDone
                ? colors.successLight
                : step.isRejected
                    ? colors.error.withValues(alpha: 0.3)
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
                    style: AppTypography.bodyMedium
                        .copyWith(fontSize: 13, fontWeight: FontWeight.w700)
                        .copyWith(
                          color: step.isDone
                              ? colors.onSurface
                              : step.isRejected
                                  ? AppColors.errorDark
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
              style: AppTypography.labelSmall.copyWith(fontSize: 9).copyWith(
                  letterSpacing: 0.8,
                  color: step.isDone
                      ? AppColors.success
                      : step.isRejected
                          ? AppColors.error
                          : colors.onSurfaceMuted),
            ),
            if (step.onTap != null) ...[
              const SizedBox(width: 6),
              Icon(Icons.chevron_right, size: 16, color: colors.onSurfaceMuted),
            ],
          ],
        ),
      ),
    );
  }
}
