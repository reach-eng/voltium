import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:intl/intl.dart';
import '../../../../theme/app_theme.dart';
import '../../../../utils/app_constants.dart';
import 'end_rental_screen.dart';
import 'choose_plan_screen.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';

class RentalDetailsScreen extends ConsumerWidget {
  const RentalDetailsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rider = ref.watch(appProvider).rider;
    final plan = rider?.currentPlan ?? 'No Active Plan';
    final price = rider?.activeRentalPlanPrice ?? 0.0;
    final status = rider?.rentalStatus ?? 'NONE';
    final vehicle = rider?.assignedVehicle ?? 'Not Assigned';
    final hub = rider?.pickupHub ?? 'Not Assigned';
    final tl = rider?.teamLeader ?? 'Not Assigned';
    final startDate = rider?.planStartDate;
    // Calculate end date from plan start + duration if planEndDate is missing
    final endDate = rider?.planEndDate ??
        _calculateEndDate(rider?.planStartDate, rider?.currentPlan);
    final streak = rider?.paymentStreak ?? 0;
    final wallet = rider?.walletBalance ?? 0.0;
    final deposit = rider?.securityDeposit ?? 0.0;

    final dateFormat = DateFormat('MMM dd, yyyy');

    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      appBar: AppBar(
        backgroundColor: AppColors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        title: const Text('Rental Details',
            style: TextStyle(
                fontWeight: FontWeight.bold, color: Color(0xFF1E293B))),
        leadingWidth: 68,
        leading: Padding(
          padding: const EdgeInsets.only(left: 20),
          child: UnconstrainedBox(
            child: GestureDetector(
              onTap: () {
                if (Navigator.canPop(context)) {
                  Navigator.pop(context);
                }
              },
              child: Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: Colors.white,
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                        color: Colors.black.withValues(alpha: 0.05),
                        blurRadius: 10,
                        offset: const Offset(0, 4))
                  ],
                ),
                child: const Icon(Icons.arrow_back,
                    color: Color(0xFF1E293B), size: 20),
              ),
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [AppColors.primary, Color(0xFF142B5B)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(24),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.3),
                    blurRadius: 20,
                    offset: const Offset(0, 10),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text(
                        'CURRENT PLAN',
                        style: TextStyle(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          letterSpacing: 1.2,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 4),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Text(
                          status.toUpperCase(),
                          style: const TextStyle(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text(
                    plan,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 24,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    '₹${price.toStringAsFixed(0)} / cycle',
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),
            const Text(
              'Rental Information',
              style: TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: Colors.grey.withValues(alpha: 0.1)),
              ),
              child: Column(
                children: [
                  _buildDetailRow(Icons.calendar_today, 'Start Date',
                      startDate != null ? dateFormat.format(startDate) : 'N/A'),
                  const Divider(height: 1),
                  _buildDetailRow(Icons.event_busy, 'End Date',
                      endDate != null ? dateFormat.format(endDate) : 'N/A'),
                  const Divider(height: 1),
                  if (endDate != null) ...[
                    _buildDetailRow(Icons.timer_outlined, 'Days Remaining',
                        '${endDate.difference(DateTime.now()).inDays.clamp(0, 999)} Days',
                        valueColor:
                            endDate.difference(DateTime.now()).inDays <= 3
                                ? AppColors.error
                                : AppColors.primary),
                    const Divider(height: 1),
                  ],
                  _buildDetailRow(
                      Icons.electric_moped, 'Assigned Vehicle', vehicle),
                  const Divider(height: 1),
                  _buildDetailRow(
                      Icons.store_mall_directory_outlined, 'Pickup Hub', hub),
                  const Divider(height: 1),
                  _buildDetailRow(Icons.person_outline, 'Team Leader', tl),
                  const Divider(height: 1),
                  _buildDetailRow(Icons.account_balance_wallet_outlined,
                      'Wallet Balance', '₹${wallet.toStringAsFixed(0)}',
                      valueColor: AppColors.success),
                  const Divider(height: 1),
                  _buildDetailRow(Icons.shield_outlined, 'Security Deposit',
                      '₹${deposit.toStringAsFixed(0)}'),
                  const Divider(height: 1),
                  _buildDetailRow(Icons.local_fire_department, 'Payment Streak',
                      '$streak Days',
                      valueColor: AppColors.primary),
                ],
              ),
            ),
            const SizedBox(height: 24),
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ChoosePlanScreen(
                              onNext: () => Navigator.pop(context)),
                        ),
                      );
                    },
                    icon: const Icon(Icons.swap_horiz, size: 18),
                    label: const Text('Change Plan'),
                    style: OutlinedButton.styleFrom(
                      foregroundColor: AppColors.primary,
                      side: const BorderSide(color: AppColors.primary),
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const EndRentalScreen(),
                        ),
                      );
                    },
                    icon:
                        const Icon(Icons.assignment_return_outlined, size: 18),
                    label: const Text('End Rental'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 0,
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value,
      {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        children: [
          Icon(icon, color: AppColors.slate400, size: 20),
          const SizedBox(width: 12),
          Text(
            label,
            style: const TextStyle(
              color: AppColors.slate500,
              fontSize: 14,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: TextStyle(
              color: valueColor ?? const Color(0xFF1E293B),
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }

  /// Calculates the plan end date from start date + plan duration.
  DateTime? _calculateEndDate(DateTime? startDate, String? plan) {
    if (startDate == null) return null;
    return startDate
        .add(Duration(days: AppConstants.getPlanDurationDays(plan)));
  }
}
