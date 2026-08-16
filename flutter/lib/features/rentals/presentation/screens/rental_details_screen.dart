import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import '../../../../theme/app_theme.dart';
import '../../../../utils/app_constants.dart';
import 'end_rental_screen.dart';
import 'choose_plan_screen.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class RentalDetailsScreen extends ConsumerWidget {
  const RentalDetailsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final rider = ref.watch(riderProvider).rider;
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
      backgroundColor: AppColors.of(context).iconBackground, // Subtle light background
      appBar: AppBar(
        backgroundColor: AppColors.of(context).iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: Text('Rental Details',
            style: AppTypography.titleMedium.copyWith(
                // DARK-MODE-AUDIT 2026-08-14 P0-7: same issue.
                color: AppColors.of(context).onSurface)),
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
              child: Builder(builder: (context) {
                final colors = AppColors.of(context);
                return Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: colors.card,
                    shape: BoxShape.circle,
                    boxShadow: [
                      BoxShadow(
                          color: Colors.black.withValues(alpha: 0.05),
                          blurRadius: 10,
                          offset: const Offset(0, 4))
                    ],
                  ),
                  child: Icon(Icons.arrow_back,
                      color: colors.onSurface, size: 20),
                );
              }),
            ),
          ),
        ),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(Spacing.md),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              padding: Spacing.paddingLg,
              decoration: BoxDecoration(
                gradient: AppGradients.primary,
                borderRadius: BorderRadius.circular(AppRadius.radiusModal),
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
                        style: AppTypography.labelMedium.copyWith(
                            color: Colors.white70, letterSpacing: 1.2),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.white.withValues(alpha: 0.2),
                          borderRadius: BorderRadius.circular(AppRadius.lg),
                        ),
                        child: Text(
                          status.toUpperCase(),
                          style: AppTypography.labelMedium.copyWith(
                              color: Colors.white, letterSpacing: 1.0),
                        ),
                      ),
                    ],
                  ),
                  SizedBox(height: 12),
                  Text(
                    plan,
                    style: AppTypography.headingLarge
                        .copyWith(color: Colors.white, letterSpacing: -0.5),
                  ),
                  SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        '₹${price.toStringAsFixed(0)}',
                        style: GoogleFonts.plusJakartaSans(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        ' / cycle',
                        style: AppTypography.bodyMedium
                            .copyWith(color: Colors.white70),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            SizedBox(height: 32),
            Text(
              'Rental Information',
              style: AppTypography.titleMedium.copyWith(
                  // DARK-MODE-AUDIT 2026-08-14 P0-7: same.
                  color: AppColors.of(context).onSurface),
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(AppRadius.lg),
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
                  _buildDetailRow(context, Icons.calendar_today_rounded,
                      'Start Date',
                      startDate != null ? dateFormat.format(startDate) : 'N/A'),
                  Divider(height: 1, color: AppColors.of(context).iconBackground),
                  _buildDetailRow(context, Icons.event_busy_rounded,
                      'End Date',
                      endDate != null ? dateFormat.format(endDate) : 'N/A'),
                  Divider(height: 1, color: AppColors.of(context).iconBackground),
                  if (endDate != null) ...[
                    Builder(builder: (context) {
                      final daysRemaining =
                          endDate.difference(DateTime.now()).inDays;
                      final String remainingText = daysRemaining < 0
                          ? 'Expired'
                          : (daysRemaining == 0
                              ? 'Expires Today'
                              : '$daysRemaining Days');
                      final Color remainingColor = daysRemaining <= 3
                          ? AppColors.error
                          : AppColors.primary;
                      return _buildDetailRow(
                        context,
                        Icons.timer_outlined,
                        'Days Remaining',
                        remainingText,
                        valueColor: remainingColor,
                      );
                    }),
                    Divider(height: 1, color: AppColors.of(context).iconBackground),
                  ],
                  _buildDetailRow(context, Icons.electric_moped_rounded,
                      'Assigned Vehicle', vehicle),
                  Divider(height: 1, color: AppColors.of(context).iconBackground),
                  _buildDetailRow(
                      context, Icons.store_mall_directory_rounded, 'Pickup Hub', hub),
                  Divider(height: 1, color: AppColors.of(context).iconBackground),
                  _buildDetailRow(context, Icons.person_rounded, 'Team Leader', tl),
                  Divider(height: 1, color: AppColors.of(context).iconBackground),
                  _buildDetailRow(context, Icons.account_balance_wallet_rounded,
                      'Wallet Balance', '₹${wallet.toStringAsFixed(0)}',
                      valueColor: AppColors.success),
                  Divider(height: 1, color: AppColors.of(context).iconBackground),
                  _buildDetailRow(context, Icons.shield_rounded, 'Security Deposit',
                      '₹${deposit.toStringAsFixed(0)}'),
                  Divider(height: 1, color: AppColors.of(context).iconBackground),
                  _buildDetailRow(context, Icons.local_fire_department_rounded,
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
                      // DARK-MODE-AUDIT 2026-08-14 P0-7: same.
                      foregroundColor: AppColors.of(context).onSurface,
                      side: const BorderSide(
                          color: AppColors.outlineVariant, width: 1.5),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.swap_horiz_rounded, size: 20),
                        SizedBox(width: 8),
                        Text('Change Plan',
                            style: AppTypography.bodyMedium
                                .copyWith(fontWeight: FontWeight.w600)),
                      ],
                    ),
                  ),
                ),
                SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () async {
                      // PR-13 (RENTAL P0-4): after a successful return we must
                      // refresh the rider data so the details screen reflects
                      // the new rental status (e.g. status: 'RETURNED' or
                      // 'PENDING'). Previously the EndRentalScreen popped
                      // optimistically without refetching, leaving the rider
                      // looking like they still had an active rental until
                      // the next app restart.
                      final returned = await Navigator.push<bool>(
                        context,
                        MaterialPageRoute(
                          builder: (_) => EndRentalScreen(
                            onSuccess: () => Navigator.of(context).pop(true),
                            onBack: () => Navigator.of(context).pop(false),
                          ),
                        ),
                      );
                      if (returned == true && context.mounted) {
                        // Pull the latest rider state (lease status, plan
                        // status, etc.) — without this the screen shows
                        // stale "Active" data after a successful end.
                        await ref.read(riderProvider.notifier).refreshFromApi();
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppColors.error,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                      elevation: 0,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.assignment_return_rounded, size: 20),
                        SizedBox(width: 8),
                        Text('End Rental',
                            style: AppTypography.bodyMedium
                                .copyWith(fontWeight: FontWeight.w600)),
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

  Widget _buildDetailRow(BuildContext context, IconData icon,
      String label, String value, {Color? valueColor}) {
    // DARK-MODE-AUDIT 2026-08-14 P0-7: helper method — needs
    // a BuildContext to read brightness-aware tokens. The
    // public call sites are inside the build method, so we
    // accept a context parameter and read via the theme
    // extension.
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          Container(
            padding: Spacing.paddingSm,
            decoration: BoxDecoration(
              color: AppColors.of(context).iconBackground,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: AppColors.of(context).onSurfaceVariant, size: 20),
          ),
          SizedBox(width: 16),
          Text(
            label,
            style: AppTypography.bodyMedium.copyWith(color: AppColors.of(context).onSurfaceVariant),
          ),
          const Spacer(),
          Text(
            value,
            style: AppTypography.labelLarge
                .copyWith(fontWeight: FontWeight.w700)
                .copyWith(
                    color: valueColor ??
                        // DARK-MODE-AUDIT 2026-08-14 P0-7: same.
                        AppColors.of(context).onSurface),
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
