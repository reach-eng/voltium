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
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'package:voltium_rider/utils/money_format.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

class RentalDetailsScreen extends ConsumerStatefulWidget {
  final VoidCallback? onBack;
  const RentalDetailsScreen({super.key, this.onBack});

  @override
  ConsumerState<RentalDetailsScreen> createState() =>
      _RentalDetailsScreenState();
}

class _RentalDetailsScreenState extends ConsumerState<RentalDetailsScreen> {
  @override
  void initState() {
    super.initState();
    PostHogService.capture('rental_details_viewed');
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final rider = ref.watch(riderProvider).rider;
    final plan =
        rider?.currentPlan ?? (l10n?.txtnoActivePlan ?? 'No Active Plan');
    final price = rider?.activeRentalPlanPrice ?? 0.0;
    final status = rider?.rentalStatus ?? 'NONE';
    final vehicle = (rider?.assignedVehicle == null ||
            rider!.assignedVehicle!.isEmpty ||
            rider.assignedVehicle == 'Not Assigned')
        ? (l10n?.txtvehiclePendingAssignment ?? 'Vehicle Pending Assignment')
        : (rider.vehicleModel != null && rider.vehicleModel!.isNotEmpty
            ? '${rider.assignedVehicle!} · ${rider.vehicleModel!}'
            : rider.assignedVehicle!);
    final hub = (rider?.pickupHub == null ||
            rider!.pickupHub!.isEmpty ||
            rider.pickupHub == 'Not Assigned')
        ? (l10n?.txtdesignatedHub ?? 'Designated Hub')
        : rider.pickupHub!;
    final tl = (rider?.teamLeader == null ||
            rider!.teamLeader!.isEmpty ||
            rider.teamLeader == 'Not Assigned')
        ? (l10n?.txtnotAssigned ?? 'Not assigned')
        : rider.teamLeader!;
    final startDate = rider?.planStartDate;
    final endDate = rider?.planEndDate ??
        _calculateEndDate(rider?.planStartDate, rider?.currentPlan);
    final streak = rider?.paymentStreak ?? 0;
    final wallet = rider?.walletBalance ?? 0.0;
    final deposit =
        (rider?.securityDeposit != null && rider!.securityDeposit > 0)
            ? rider.securityDeposit
            : (rider?.currentPlanSecurityDepositInRupees ?? 0.0);

    final dateFormat = DateFormat('MMM dd, yyyy');

    return Scaffold(
      backgroundColor: colors.surface,
      appBar: AppBar(
        backgroundColor: colors.surface,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        centerTitle: true,
        title: Text(
          l10n?.txtrentalDetailsTitle ?? 'Rental Details',
          style: AppTypography.titleMedium.copyWith(color: colors.onSurface),
        ),
        leading: IconButton(
          icon: Icon(Icons.arrow_back, color: colors.onSurface, size: 20),
          tooltip: l10n?.txtback ?? 'Back',
          onPressed: () {
            HapticService.light();
            if (widget.onBack != null) {
              widget.onBack!();
            } else if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          },
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
                        l10n?.txtcurrentPlanSection ?? 'CURRENT PLAN',
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
                  const SizedBox(height: 12),
                  Text(
                    plan,
                    style: AppTypography.headingLarge
                        .copyWith(color: Colors.white, letterSpacing: -0.5),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.baseline,
                    textBaseline: TextBaseline.alphabetic,
                    children: [
                      Text(
                        // AUDIT FIX (LOW): unified money formatting — the
                        // old `toStringAsFixed(0)` truncated instead of
                        // rounding and had no digit grouping.
                        MoneyFormat.rupees(price),
                        style: GoogleFonts.plusJakartaSans(
                          color: Colors.white,
                          fontSize: 24,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      Text(
                        l10n?.txtperCycle ?? ' / cycle',
                        style: AppTypography.bodyMedium
                            .copyWith(color: Colors.white70),
                      ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            Text(
              l10n?.txtrentalInformation ?? 'Rental Information',
              style:
                  AppTypography.titleMedium.copyWith(color: colors.onSurface),
            ),
            const SizedBox(height: 16),
            Container(
              decoration: BoxDecoration(
                color: colors.card,
                borderRadius: BorderRadius.circular(AppRadius.lg),
                border: Border.all(color: colors.outlineVariant),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withValues(alpha: 0.03),
                    blurRadius: 15,
                    offset: const Offset(0, 5),
                  ),
                ],
              ),
              child: Column(
                children: [
                  _buildDetailRow(
                      context,
                      Icons.calendar_today_rounded,
                      l10n?.txtstartDate ?? 'Start Date',
                      startDate != null ? dateFormat.format(startDate) : 'N/A'),
                  Divider(height: 1, color: colors.outlineVariant),
                  _buildDetailRow(
                      context,
                      Icons.event_busy_rounded,
                      l10n?.txtendDate ?? 'End Date',
                      endDate != null ? dateFormat.format(endDate) : 'N/A'),
                  Divider(height: 1, color: colors.outlineVariant),
                  if (endDate != null) ...[
                    Builder(builder: (context) {
                      // AUDIT FIX (LOW): date-only difference. The old
                      // `endDate.difference(DateTime.now()).inDays` counted
                      // time-of-day, producing off-by-one day counts for
                      // rentals ending later in the day.
                      final now = DateTime.now();
                      final today = DateTime(now.year, now.month, now.day);
                      final endDay =
                          DateTime(endDate.year, endDate.month, endDate.day);
                      final daysRemaining = endDay.difference(today).inDays;
                      final String remainingText = daysRemaining < 0
                          ? (l10n?.txtexpired ?? 'Expired')
                          : (daysRemaining == 0
                              ? (l10n?.txtexpiresToday ?? 'Expires Today')
                              : (l10n?.txtdaysCount(daysRemaining) ??
                                  '$daysRemaining Days'));
                      final Color remainingColor =
                          daysRemaining <= 3 ? colors.error : AppColors.primary;
                      return _buildDetailRow(
                        context,
                        Icons.timer_outlined,
                        l10n?.txttimeRemaining ?? 'Days Remaining',
                        remainingText,
                        valueColor: remainingColor,
                      );
                    }),
                    Divider(height: 1, color: colors.outlineVariant),
                  ],
                  _buildDetailRow(
                    context,
                    Icons.electric_moped_rounded,
                    l10n?.txtassignedVehicle ?? 'Assigned Vehicle',
                    vehicle,
                  ),
                  Divider(height: 1, color: colors.outlineVariant),
                  _buildDetailRow(
                    context,
                    Icons.store_mall_directory_rounded,
                    l10n?.txtpickupHub ?? 'Pickup Hub',
                    hub,
                  ),
                  Divider(height: 1, color: colors.outlineVariant),
                  _buildDetailRow(
                    context,
                    Icons.person_rounded,
                    l10n?.txtteamLeader ?? 'Team Leader',
                    tl,
                  ),
                  Divider(height: 1, color: colors.outlineVariant),
                  _buildDetailRow(
                    context,
                    Icons.account_balance_wallet_rounded,
                    l10n?.txtwalletBalance ?? 'Wallet Balance',
                    // AUDIT FIX (LOW): unified money formatting.
                    MoneyFormat.rupees(wallet),
                    valueColor: AppColors.success,
                  ),
                  Divider(height: 1, color: colors.outlineVariant),
                  _buildDetailRow(
                    context,
                    Icons.shield_rounded,
                    l10n?.txtsecurityDeposit ?? 'Security Deposit',
                    // AUDIT FIX (LOW): unified money formatting.
                    MoneyFormat.rupees(deposit),
                  ),
                  Divider(height: 1, color: colors.outlineVariant),
                  _buildDetailRow(
                    context,
                    Icons.local_fire_department_rounded,
                    l10n?.txtpaymentStreak ?? 'Payment Streak',
                    l10n?.txtdaysCount(streak) ?? '$streak Days',
                    valueColor: AppColors.primary,
                  ),
                ],
              ),
            ),
            const SizedBox(height: 32),
            // Action buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    onPressed: () async {
                      HapticService.light();
                      await Navigator.push(
                        context,
                        MaterialPageRoute(
                          builder: (_) => ChoosePlanScreen(
                              onNext: () => Navigator.pop(context)),
                        ),
                      );
                      if (context.mounted) {
                        await ref.read(riderProvider.notifier).refreshFromApi();
                      }
                    },
                    style: OutlinedButton.styleFrom(
                      foregroundColor: colors.onSurface,
                      side:
                          BorderSide(color: colors.outlineVariant, width: 1.5),
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        const Icon(Icons.swap_horiz_rounded, size: 20),
                        const SizedBox(width: 8),
                        Text(
                          l10n?.txtchangePlan ?? 'Change Plan',
                          style: AppTypography.bodyMedium
                              .copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ),
                const SizedBox(width: 16),
                Expanded(
                  child: ElevatedButton(
                    onPressed: () async {
                      HapticService.light();
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
                        const SizedBox(width: 8),
                        Text(
                          l10n?.txtendRentalButton ?? 'End Rental',
                          style: AppTypography.bodyMedium
                              .copyWith(fontWeight: FontWeight.w600),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  Widget _buildDetailRow(
      BuildContext context, IconData icon, String label, String value,
      {Color? valueColor}) {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      child: Row(
        children: [
          Container(
            padding: Spacing.paddingSm,
            decoration: BoxDecoration(
              color: colors.surfaceBright,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: colors.onSurfaceVariant, size: 20),
          ),
          const SizedBox(width: 16),
          Text(
            label,
            style: AppTypography.bodyMedium
                .copyWith(color: colors.onSurfaceVariant),
          ),
          const Spacer(),
          Text(
            value,
            style: AppTypography.labelLarge
                .copyWith(fontWeight: FontWeight.w700)
                .copyWith(color: valueColor ?? colors.onSurface),
          ),
        ],
      ),
    );
  }

  /// AUDIT FIX (LOW): prefers an explicit plan-record `durationDays` when
  /// one is available (e.g. a fetched PlanModel); the plan-NAME map in
  /// AppConstants is kept only as the last-resort fallback. Today
  /// RiderModel carries no plan record / duration field, so callers have
  /// nothing richer to pass — the optional parameter keeps the correct
  /// precedence encoded for when a record source lands.
  DateTime? _calculateEndDate(DateTime? startDate, String? planName,
      {int? planDurationDays}) {
    if (startDate == null) return null;
    final days = planDurationDays ?? AppConstants.getPlanDurationDays(planName);
    return startDate.add(Duration(days: days));
  }
}
