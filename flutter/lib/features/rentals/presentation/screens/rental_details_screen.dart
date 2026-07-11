import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
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
    final endDate = rider?.planEndDate ??
        _calculateEndDate(rider?.planStartDate, rider?.currentPlan);
    final streak = rider?.paymentStreak ?? 0;
    final wallet = rider?.walletBalance ?? 0.0;
    final deposit = rider?.securityDeposit ?? 0.0;

    final dateFormat = DateFormat('MMM dd, yyyy');

    return Scaffold(
      backgroundColor: AppColors.iconBackground, // Subtle light background
      appBar: AppBar(
        backgroundColor: AppColors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: Text('Rental Details',
            style: GoogleFonts.plusJakartaSans(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF1E293B))),
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
              padding: const EdgeInsets.all(24),
              decoration: BoxDecoration(
                gradient: AppGradients.primary,
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
                      Text(
                        'CURRENT PLAN',
                        style: GoogleFonts.inter(
                          color: Colors.white70,
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          letterSpacing: 1.2,
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(20),
                        ),
                        child: Text(
                          status.toUpperCase(),
                          style: GoogleFonts.inter(
                            color: Colors.white,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                            letterSpacing: 1.0,
                          ),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Text(
                    plan,
                    style: GoogleFonts.plusJakartaSans(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.bold,
                      letterSpacing: -0.5,
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '₹${price.toStringAsFixed(0)}',
                        style: GoogleFonts.inter(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        ' / cycle',
                        style: GoogleFonts.inter(
                          color: Colors.white70,
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            Text(
              'Rental Information',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 18,
                fontWeight: FontWeight.bold,
                color: const Color(0xFF1E293B),
              ),
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  )
                ],
              ),
              child: Column(
                children: [
                  _buildDetailRow(Icons.calendar_today_rounded, 'Start Date',
                      startDate != null ? dateFormat.format(startDate) : 'N/A'),
                  const Divider(height: 1, color: AppColors.iconBackground),
                  _buildDetailRow(Icons.event_busy_rounded, 'End Date',
                      endDate != null ? dateFormat.format(endDate) : 'N/A'),
                  const Divider(height: 1, color: AppColors.iconBackground),
                  if (endDate != null) ...[
                    _buildDetailRow(Icons.timer_outlined, 'Days Remaining',
                        '${endDate.difference(DateTime.now()).inDays.clamp(0, 999)} Days',
                        valueColor:
                            endDate.difference(DateTime.now()).inDays <= 3
                                ? AppColors.error
                                : AppColors.primary),
                    const Divider(height: 1, color: AppColors.iconBackground),
                  ],
                  _buildDetailRow(Icons.electric_moped_rounded,
                      'Assigned Vehicle', vehicle),
                  const Divider(height: 1, color: AppColors.iconBackground),
                  _buildDetailRow(
                      Icons.store_mall_directory_rounded, 'Pickup Hub', hub),
                  const Divider(height: 1, color: AppColors.iconBackground),
                  _buildDetailRow(Icons.person_rounded, 'Team Leader', tl),
                  const Divider(height: 1, color: AppColors.iconBackground),
                  _buildDetailRow(Icons.account_balance_wallet_rounded,
                      'Wallet Balance', '₹${wallet.toStringAsFixed(0)}',
                      valueColor: AppColors.success),
                  const Divider(height: 1, color: AppColors.iconBackground),
                  _buildDetailRow(Icons.shield_rounded, 'Security Deposit',
                      '₹${deposit.toStringAsFixed(0)}'),
                  const Divider(height: 1, color: AppColors.iconBackground),
                  _buildDetailRow(Icons.local_fire_department_rounded,
                      'Payment Streak', '$streak Days',
                      valueColor: AppColors.primary),
                ],
              ),
            ),
            const SizedBox(height: 32),
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ChoosePlanScreen(
                              onNext: () => Navigator.pop(context)),
                        ),
                      );
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: const Color(0xFF1E293B),
                      side: const BorderSide(
                          color: Color(0xFFE2E8F0), width: 1.5),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.swap_horiz_rounded, size: 20),
                        const SizedBox(width: 8),
                        Text('Change Plan',
                            style: GoogleFonts.inter(
                                fontWeight: FontWeight.bold, fontSize: 14)),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () {
                      Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => const EndRentalScreen(),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.error,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                      elevation: 0,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.assignment_return_rounded, size: 20),
                        const SizedBox(width: 8),
                        Text('End Rental',
                            style: GoogleFonts.inter(
                                fontWeight: FontWeight.bold, fontSize: 14)),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20), // Bottom padding
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(IconData icon, String label, String value,
      {Color? valueColor}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: AppColors.iconBackground,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.slate500, size: 20),
          ),
          const SizedBox(width: 16),
          Text(
            label,
            style: GoogleFonts.inter(
              color: AppColors.slate500,
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const Spacer(),
          Text(
            value,
            style: GoogleFonts.inter(
              color: valueColor ?? const Color(0xFF1E293B),
              fontSize: 15,
              fontWeight: FontWeight.bold,
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
