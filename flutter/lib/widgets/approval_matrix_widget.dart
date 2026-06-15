import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../models/rider_model.dart';
import '../providers/app_provider.dart';

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
    final appProvider = context.watch<AppProvider>();
    final walletMinTopup = appProvider.walletMinTopup;

    final kycStatus = _kycStepStatus();
    final kycSubtitle = _kycSubtitle();

    final List<_StepData> steps = [
      _StepData(
        label: 'Registration',
        status: _getStepStatus(
          rider.registrationDone ||
              rider.name.isNotEmpty ||
              (rider.lifecycleStatus.isNotEmpty && _lifecycleRank(rider) >= 2),
          !(rider.registrationDone ||
              rider.name.isNotEmpty ||
              (rider.lifecycleStatus.isNotEmpty && _lifecycleRank(rider) >= 2)),
          false,
        ),
        icon: Icons.person_add_outlined,
      ),
      _StepData(
        label: 'Deposit',
        status: _getStepStatus(
          rider.depositDone ||
              (rider.lifecycleStatus.isNotEmpty && _lifecycleRank(rider) >= 8),
          (rider.registrationDone ||
                      rider.name.isNotEmpty ||
                      (rider.lifecycleStatus.isNotEmpty &&
                          _lifecycleRank(rider) >= 2)) &&
                  !rider.depositDone &&
                  !(rider.lifecycleStatus.isNotEmpty &&
                      _lifecycleRank(rider) >= 8),
          false,
        ),
        icon: Icons.account_balance_outlined,
      ),
      _StepData(
        label: 'KYC',
        status: _getStepStatus(
          kycStatus == StepStatus.completed,
          (rider.depositDone ||
                  (rider.lifecycleStatus.isNotEmpty &&
                      _lifecycleRank(rider) >= 8)) &&
              kycStatus != StepStatus.completed &&
              kycStatus != StepStatus.rejected,
          kycStatus == StepStatus.rejected,
        ),
        icon: Icons.shield_outlined,
        subtitle: kycSubtitle,
      ),
              _StepData(
          label: 'Rental Plan',
          status: _getStepStatus(
            rider.planDone ||
                (rider.lifecycleStatus.isNotEmpty && _lifecycleRank(rider) >= 9),
            kycStatus == StepStatus.completed &&
                (rider.depositDone ||
                    (rider.lifecycleStatus.isNotEmpty &&
                        _lifecycleRank(rider) >= 8)) &&
                !(rider.planDone ||
                    (rider.lifecycleStatus.isNotEmpty &&
                        _lifecycleRank(rider) >= 9)),
            false,
          ),
          icon: Icons.event_repeat_outlined,
        ),
      _StepData(
        label: 'Pickup',
        status: _getStepStatus(
          rider.pickupDone ||
              (rider.lifecycleStatus.isNotEmpty && _lifecycleRank(rider) >= 10),
          (rider.planDone ||
                  (rider.lifecycleStatus.isNotEmpty &&
                      _lifecycleRank(rider) >= 9)) &&
              kycStatus == StepStatus.completed &&
              (rider.depositDone ||
                  (rider.lifecycleStatus.isNotEmpty &&
                      _lifecycleRank(rider) >= 8)) &&
              !(rider.pickupDone ||
                  (rider.lifecycleStatus.isNotEmpty &&
                      _lifecycleRank(rider) >= 10)),
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
            const Text(
              'Approval Matrix',
              style: TextStyle(
                fontSize: 15,
                fontWeight: FontWeight.w700,
                color: Color(0xFF1E293B),
              ),
            ),
            Text(
              '$completedCount/${steps.length} Done',
              style: const TextStyle(
                fontSize: 10,
                fontWeight: FontWeight.w800,
                color: Color(0xFF64748B),
                letterSpacing: 0.5,
              ),
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
            return _buildStepItem(step);
          },
        ),
      ],
    );
  }

  StepStatus _kycStepStatus() {
    if (rider.kycStatus == KycStatus.VERIFIED) return StepStatus.completed;
    if (rider.kycStatus == KycStatus.REJECTED) return StepStatus.rejected;
    if (rider.kycDone ||
        (rider.lifecycleStatus.isNotEmpty && _lifecycleRank(rider) >= 4)) {
      return StepStatus.completed;
    }
    return StepStatus.pending;
  }

  String? _kycSubtitle() {
    if (rider.kycStatus == KycStatus.SUBMITTED) return 'Under Review';
    if (rider.kycStatus == KycStatus.REJECTED) return 'Update Documents';
    return null;
  }

  StepStatus _getStepStatus(bool isCompleted, bool isNext, bool isRejected) {
    if (isRejected) return StepStatus.rejected;
    if (isCompleted) return StepStatus.completed;
    if (isNext) return StepStatus.active;
    return StepStatus.pending;
  }

  Widget _buildStepItem(_StepData step) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: step.isDone
            ? const Color(0xFFF0FDF4)
            : step.isRejected
                ? const Color(0xFFFEF2F2)
                : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: step.isDone
              ? const Color(0xFFDCFCE7)
              : step.isRejected
                  ? const Color(0xFFFECACA)
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
                  ? const Color(0xFF10B981)
                  : step.isRejected
                      ? const Color(0xFFEF4444)
                      : const Color(0xFFE2E8F0),
            ),
            child: Center(
              child: step.isDone
                  ? const Icon(Icons.check, color: Colors.white, size: 18)
                  : step.isRejected
                      ? const Icon(Icons.close, color: Colors.white, size: 18)
                      : Icon(step.icon,
                          size: 16, color: const Color(0xFF94A3B8)),
            ),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  step.label,
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: step.isDone
                        ? const Color(0xFF065F46)
                        : step.isRejected
                            ? const Color(0xFF991B1B)
                            : const Color(0xFF1E293B),
                  ),
                ),
                if (step.subtitle != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    step.subtitle!,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w700,
                      color: step.isRejected
                          ? const Color(0xFFEF4444)
                          : const Color(0xFF64748B),
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
            style: TextStyle(
              fontSize: 9,
              fontWeight: FontWeight.w900,
              letterSpacing: 0.8,
              color: step.isDone
                  ? const Color(0xFF10B981)
                  : step.isRejected
                      ? const Color(0xFFEF4444)
                      : const Color(0xFF94A3B8),
            ),
          ),
        ],
      ),
    );
  }
}

int _lifecycleRank(RiderModel rider) {
  const rank = <String, int>{
    'NEW': 0, 'PHONE_VERIFIED': 1, 'PROFILE_SUBMITTED': 2,
    'KYC_SUBMITTED': 3, 'KYC_APPROVED': 4, 'GUARANTOR_SUBMITTED': 5,
    'GUARANTOR_APPROVED': 6, 'DEPOSIT_PENDING': 7, 'DEPOSIT_APPROVED': 8,
    'PLAN_SELECTED': 9, 'PICKUP_SCHEDULED': 10, 'ACTIVE': 11,
    'SUSPENDED': 12, 'RETURN_PENDING': 13, 'CLOSED': 14,
  };
  return rank[rider.lifecycleStatus] ?? 0;
}
