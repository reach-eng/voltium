import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import 'package:share_plus/share_plus.dart';

import '../gen/app_localizations.dart';
import '../models/rider_model.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';
import '../utils/app_constants.dart';
import '../utils/app_navigator.dart';
import 'rewards_screen.dart';
import 'troubleshooter_screen.dart';
import '../widgets/skeleton_loader.dart';
import '../widgets/fade_up_widget.dart';

/// Active Dashboard screen for the VoltFleet Rider App.
///
/// Displays the rider's status, subscription details, performance metrics,
/// assigned vehicle, and referral widget. Supports pull-to-refresh via
/// [RefreshIndicator] and reacts to [AppProvider] state changes through
/// [Consumer].
class ActiveDashboardScreen extends StatelessWidget {
  const ActiveDashboardScreen({super.key});

  // ── Status helpers ────────────────────────────────────────────────────────

  Color _statusColor(AccountStatus status) {
    switch (status) {
      case AccountStatus.ACTIVE:
        return Colors.green;
      case AccountStatus.SUSPENDED:
        return Colors.red;
      case AccountStatus.PRE_ACTIVE:
        return Colors.amber;
      case AccountStatus.TERMINATED:
        return Colors.grey;
    }
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceContainer,
      body: Consumer<AppProvider>(
        builder: (context, provider, child) {
          final l10n = AppLocalizations.of(context)!;
          final rider = provider.rider;
          final isCache = provider.dataState == DataState.fromCache;

          if (isCache && provider.isRefreshing && rider == null) {
            return const DashboardSkeleton();
          }

          if (rider == null) {
            if (provider.dataState == DataState.error) {
              return Center(
                child: Padding(
                  padding: const EdgeInsets.all(24.0),
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(Icons.error_outline,
                          color: Colors.red, size: 48),
                      const SizedBox(height: 16),
                      Text(
                        'Unable to connect to backend: ${provider.errorMessage}\nPlease ensure the local server is running.',
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 16),
                      FilledButton(
                        onPressed: () => provider.refresh(),
                        child: Text(l10n.common_retry),
                      ),
                    ],
                  ),
                ),
              );
            }

            // If we are refreshing OR in the initial state (no data yet), show skeleton.
            if (provider.isRefreshing ||
                provider.dataState == DataState.initial) {
              return const DashboardSkeleton();
            }

            // Only show "No Data" if we explicitly finished a refresh and still have no rider.
            return Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(
                    l10n.common_noData,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Try refreshing or check your connection.',
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 16),
                  TextButton.icon(
                    onPressed: () => provider.refresh(),
                    icon: const Icon(Icons.refresh),
                    label: const Text('Refresh'),
                  ),
                ],
              ),
            );
          }

          return RefreshIndicator(
            color: AppColors.primary,
            onRefresh: () => provider.refresh(),
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                // ── Header ──────────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 48, 20, 16),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text(
                            'Voltium',
                            style: TextStyle(
                              fontSize: 20,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF1A1A2E), // vf-on-surface
                            ),
                          ),
                          Text(
                            l10n.dashboard_subtitle,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF6B7280), // vf-on-surface-variant
                            ),
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          _buildStreakBadge(rider.paymentStreak),
                          const SizedBox(width: 12),
                          _buildPointsBadge(context, 0), // Default 0 pts
                          const SizedBox(width: 12),
                          InkWell(
                            key: const Key('notificationBell'),
                            onTap: () {},
                            borderRadius: BorderRadius.circular(20),
                            child: Container(
                              padding: const EdgeInsets.all(10),
                              decoration: const BoxDecoration(
                                color: Colors.white,
                                shape: BoxShape.circle,
                                boxShadow: [
                                  BoxShadow(
                                    color: Color(0x0A0F172A),
                                    blurRadius: 4,
                                    offset: Offset(0, 2),
                                  ),
                                ],
                              ),
                              child: Stack(
                                clipBehavior: Clip.none,
                                children: [
                                  const Icon(Icons.notifications_none,
                                      size: 20, color: Color(0xFF1A1A2E)),
                                  Positioned(
                                    right: -2,
                                    top: -2,
                                    child: Container(
                                      width: 8,
                                      height: 8,
                                      decoration: BoxDecoration(
                                        color: Colors.red,
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                            color: Colors.white, width: 1.5),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                ),

                // ── Body content ────────────────────────────────────────
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 20),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Cache indicator.
                      if (isCache) _buildCacheIndicator(l10n),

                      // Action Banner
                      if (rider.returnPending) _buildReturnPendingCard(context),
                      if (!rider.returnPending)
                        _buildActionRequiredBanner(rider),
                      const SizedBox(height: 16),

                      // Status Badge centered
                      FadeUpWidget(
                        delay: 0,
                        child: Center(child: _buildStatusBadge(context, rider, l10n)),
                      ),
                      const SizedBox(height: 16),

                      // Profile Box
                      FadeUpWidget(
                        delay: 100,
                        child: _buildProfileBox(context, rider, l10n),
                      ),
                      const SizedBox(height: 16),

                      // KPI Grid
                      FadeUpWidget(
                        delay: 200,
                        child: _buildKPIGrid(context, rider, l10n),
                      ),
                      const SizedBox(height: 12),

                      // Subscription card.
                      FadeUpWidget(
                        delay: 300,
                        child: _buildSubscriptionCard(context, rider, provider, l10n),
                      ),
                      const SizedBox(height: 12),

                      // Bento grid: Hub + Team Leader.
                      FadeUpWidget(
                        delay: 400,
                        child: _buildBentoGrid(context, rider, l10n),
                      ),
                      const SizedBox(height: 12),

                      // Performance Grid
                      FadeUpWidget(
                        delay: 500,
                        child: _buildPerformanceGrid(context, rider, l10n),
                      ),
                      const SizedBox(height: 16),

                      // Referral widget.
                      FadeUpWidget(
                        delay: 600,
                        child: _buildReferralWidget(context, l10n),
                      ),
                      const SizedBox(height: 16),

                      // Assigned vehicle card.
                      FadeUpWidget(
                        delay: 700,
                        child: _buildVehicleCard(context, rider, l10n),
                      ),

                      const SizedBox(height: 32),
                    ],
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildPointsBadge(BuildContext context, int points) {
    return InkWell(
      key: const Key('pointsBadge'),
      onTap: () {
        AppNavigator.push(context, const RewardsScreen());
      },
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFFFFBEB), // amber-50
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFFFDE68A)), // amber-200
        ),
        child: Row(
          children: [
            const Icon(Icons.bolt, color: Color(0xFFD97706), size: 16),
            const SizedBox(width: 4),
            Text(
              '$points pts',
              style: const TextStyle(
                fontSize: 13,
                fontWeight: FontWeight.bold,
                color: Color(0xFFD97706),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStreakBadge(int streak) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4), // green-50
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFDCFCE7)), // green-200
      ),
      child: Row(
        children: [
          const Icon(Icons.flash_on, color: Color(0xFF16A34A), size: 14),
          const SizedBox(width: 4),
          Text(
            '$streak',
            style: const TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Color(0xFF16A34A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildKPIGrid(BuildContext context, RiderModel rider, AppLocalizations l10n) {
    final daysLeft = rider.planEndDate != null
        ? rider.planEndDate!.difference(DateTime.now()).inDays
        : 0;

    return GridView.count(
      crossAxisCount: 2,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: 12,
      crossAxisSpacing: 12,
      childAspectRatio: 1.6,
      children: [
        _buildKPITile(
          label: 'Wallet',
          value: '₹${rider.walletBalance.toInt()}',
          icon: Icons.account_balance_wallet,
          color: const Color(0xFF0053C1),
          bg: const Color(0xFFEFF6FF),
        ),
        _buildKPITile(
          label: 'Days Left',
          value: '${daysLeft}d',
          icon: Icons.calendar_today,
          color: daysLeft < 3 ? Colors.red : const Color(0xFFD97706),
          bg: daysLeft < 3 ? const Color(0xFFFEF2F2) : const Color(0xFFFFFBEB),
        ),
        _buildKPITile(
          label: 'Speed',
          value: '${rider.currentSpeed.toInt()} km/h',
          icon: Icons.speed,
          color: const Color(0xFF7C3AED),
          bg: const Color(0xFFF5F3FF),
        ),
        _buildKPITile(
          label: 'Battery',
          value: '${rider.batteryPercent.toInt()}%',
          icon: Icons.battery_charging_full,
          color: const Color(0xFF059669),
          bg: const Color(0xFFECFDF5),
        ),
      ],
    );
  }

  Widget _buildKPITile({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
    required Color bg,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(icon, color: color, size: 20),
          const SizedBox(height: 8),
          Text(
            label,
            style: TextStyle(fontSize: 10, color: color.withOpacity(0.7), fontWeight: FontWeight.bold),
          ),
          Text(
            value,
            style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: color),
          ),
        ],
      ),
    );
  }

  Widget _buildPerformanceGrid(BuildContext context, RiderModel rider, AppLocalizations l10n) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Text(
          'YOUR PERFORMANCE',
          style: TextStyle(
            fontSize: 10,
            fontWeight: FontWeight.w800,
            color: Color(0xFF64748B),
            letterSpacing: 1.2,
          ),
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: _buildPerformanceTile(
                label: 'This Week',
                value: '${rider.weeklyDistance} km',
                icon: Icons.map_outlined,
                color: const Color(0xFF2563EB),
                bg: const Color(0xFFEFF6FF),
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildPerformanceTile(
                label: 'Carbon Saved',
                value: '${rider.carbonSaved} kg',
                icon: Icons.eco_outlined,
                color: const Color(0xFF16A34A),
                bg: const Color(0xFFF0FDF4),
              ),
            ),
          ],
        ),
      ],
    );
  }

  Widget _buildPerformanceTile({
    required String label,
    required String value,
    required IconData icon,
    required Color color,
    required Color bg,
  }) {
    return Container(
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: color.withOpacity(0.1)),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(8),
            decoration: BoxDecoration(
              color: color.withOpacity(0.1),
              shape: BoxShape.circle,
            ),
            child: Icon(icon, color: color, size: 20),
          ),
          const SizedBox(width: 12),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: TextStyle(fontSize: 10, color: color.withOpacity(0.7), fontWeight: FontWeight.bold),
              ),
              Text(
                value,
                style: TextStyle(fontSize: 14, fontWeight: FontWeight.bold, color: color),
              ),
            ],
          ),
        ],
      ),
    );
  }

  // ── Widget builders ───────────────────────────────────────────────────────

  Widget _buildActionRequiredBanner(RiderModel rider) {
    bool isLowBalance = rider.walletBalance <
        (rider.activeRentalPlanPrice * AppConstants.lowBalanceThresholdRatio);

    if (!isLowBalance) {
      return const SizedBox.shrink(); // Hide if balance is safe.
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB), // amber-50
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFFDE68A)), // amber-200
      ),
      child: Row(
        children: [
          const Icon(Icons.warning_amber_rounded,
              color: Color(0xFFF59E0B), size: 20),
          const SizedBox(width: 12),
          const Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Action Required',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF92400E), // amber-800
                  ),
                ),
                Text(
                  'Low Wallet Balance',
                  style: TextStyle(
                    fontSize: 12,
                    color: Color(0xFFD97706), // amber-600
                  ),
                ),
              ],
            ),
          ),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
            decoration: BoxDecoration(
              color: const Color(0xFFFEF3C7), // amber-100
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Text(
              '1',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.bold,
                color: Color(0xFFB45309), // amber-700
              ),
            ),
          ),
          const SizedBox(width: 8),
          const Icon(Icons.keyboard_arrow_down,
              color: Color(0xFF92400E), size: 20),
        ],
      ),
    );
  }

  Widget _buildCacheIndicator(AppLocalizations l10n) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
      decoration: BoxDecoration(
        color: Colors.amber.shade50,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.amber.shade200),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off, size: 14, color: Colors.amber.shade700),
          const SizedBox(width: 6),
          Text(
            l10n.common_fromCache,
            style: TextStyle(
              fontSize: 12,
              color: Colors.amber.shade700,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusBadge(
      BuildContext context, RiderModel rider, AppLocalizations l10n) {
    final statusText = switch (rider.accountStatus) {
      AccountStatus.ACTIVE => l10n.dashboard_statusActive,
      AccountStatus.SUSPENDED => l10n.dashboard_statusSuspended,
      AccountStatus.PRE_ACTIVE => l10n.dashboard_statusPreActive,
      AccountStatus.TERMINATED => l10n.dashboard_statusSuspended,
    };
    final color = _statusColor(rider.accountStatus);

    if (rider.accountStatus == AccountStatus.SUSPENDED) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2), // red-50
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFFECACA)), // red-200
        ),
        child: const Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.warning, color: Color(0xFFEF4444), size: 14),
            const SizedBox(width: 8),
            Text(
              'ACCOUNT SUSPENDED',
              style: TextStyle(
                color: Color(0xFFB91C1C),
                fontWeight: FontWeight.w900,
                fontSize: 10,
                letterSpacing: 1.0,
              ),
            ),
          ],
        ),
      );
    }

    return const SizedBox.shrink();
  }

  Widget _buildProfileBox(
      BuildContext context, RiderModel rider, AppLocalizations l10n) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        gradient: AppGradients.success, // User request #2: Green rider card
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: [
          BoxShadow(
            color: AppColors.success.withOpacity(0.2),
            blurRadius: 48,
            offset: const Offset(0, 24),
          ),
        ],
      ),
      child: Row(
        children: [
          // User request #6: Photo instead of label
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.md),
              boxShadow: [
                BoxShadow(
                  color: Colors.black.withOpacity(0.1),
                  blurRadius: 10,
                  offset: const Offset(0, 4),
                ),
              ],
            ),
            child: rider.pickupPhoto != null && rider.pickupPhoto!.isNotEmpty
              ? ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                  child: Image.network(
                    rider.pickupPhoto!,
                    fit: BoxFit.cover,
                  ),
                )
              : Center(
                  child: Text(
                    (rider.name.isNotEmpty ? rider.name[0] : 'A').toUpperCase(),
                    style: const TextStyle(
                      color: AppColors.success,
                      fontSize: 28,
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                ),
          ),
          const SizedBox(width: 16),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'RIDER',
                  style: const TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                    color: Colors.white70,
                    letterSpacing: 1.2,
                  ),
                ),
                Text(
                  // User request #5: Rider name instead of label
                  rider.name.isNotEmpty ? rider.name : 'Vollfleeet Rider',
                  style: const TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                const SizedBox(height: 4),
                Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text(
                    rider.id ?? '—',
                    style: const TextStyle(
                      fontFamily: 'monospace',
                      fontSize: 11,
                      fontWeight: FontWeight.w600,
                      color: Colors.white,
                    ),
                  ),
                ),
              ],
            ),
          ),
          const Icon(Icons.chevron_right,
              size: 24, color: Colors.white70),
        ],
      ),
    );
  }

  Widget _buildSubscriptionCard(BuildContext context, RiderModel rider,
      AppProvider provider, AppLocalizations l10n) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0053C1), Color(0xFF2F6DDE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: Color(0x330053C1),
            blurRadius: 24,
            offset: Offset(0, 12),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Text(
                'CURRENT SUBSCRIPTION',
                style: TextStyle(
                  color: Colors.white.withOpacity(0.7),
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            rider.currentPlan ?? 'No Plan',
            style: const TextStyle(
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'TIME REMAINING',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.7),
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        rider.planEndDate != null
                            ? _daysRemaining(rider.planEndDate!)
                            : 'N/A',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'ENDS ON',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.7),
                          fontSize: 9,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 0.8,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        rider.planEndDate != null
                            ? _formatDate(rider.planEndDate!)
                            : 'N/A',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          if (rider.submissionDate != null && !rider.returnPending) ...[
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFFFEF2F2), // red-50
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFFFCA5A5), width: 1.5),
              ),
              child: Column(
                children: [
                  Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: const BoxDecoration(
                            color: Color(0xFFFEE2E2), shape: BoxShape.circle),
                        child: const Icon(Icons.assignment_return,
                            color: Color(0xFFDC2626), size: 24),
                      ),
                      const SizedBox(width: 16),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            const Text(
                              'RETURN SCHEDULED',
                              style: TextStyle(
                                  color: Color(0xFF991B1B),
                                  fontWeight: FontWeight.w900,
                                  fontSize: 11,
                                  letterSpacing: 1.1),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              'Date: ${_formatDate(rider.submissionDate!)}',
                              style: const TextStyle(
                                  color: Color(0xFFDC2626),
                                  fontSize: 14,
                                  fontWeight: FontWeight.bold),
                            ),
                          ],
                        ),
                      ),
                      GestureDetector(
                        key: const Key('cancelReturnButton'),
                        onTap: () {
                          final updated = rider.copyWith(submissionDate: null);
                          provider.updateRider(updated);
                        },
                        child: const Icon(Icons.cancel_outlined,
                            color: Color(0xFF991B1B), size: 24),
                      ),
                    ],
                  ),
                  const SizedBox(height: 20),
                  ElevatedButton(
                    key: const Key('processReturnButton'),
                    onPressed: () =>
                        _showReturnVehicleBottomSheet(context, provider),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFDC2626),
                      foregroundColor: Colors.white,
                      elevation: 0,
                      minimumSize: const Size(double.infinity, 50),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(12),
                      ),
                    ),
                    child: const Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.camera_alt_outlined, size: 20),
                        SizedBox(width: 12),
                        Text('Process Vehicle Return',
                            style: TextStyle(
                                fontWeight: FontWeight.bold, fontSize: 14)),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: 16),
          ],
          SizedBox(
            width: double.infinity,
            child: FilledButton(
              key: const Key('manageSubscriptionButton'),
              onPressed: () => _showSubscriptionBottomSheet(context, rider),
              style: FilledButton.styleFrom(
                backgroundColor: Colors.white,
                foregroundColor: const Color(0xFF0053C1),
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(20),
                ),
              ),
              child: const Text('Manage Subscription',
                  style: TextStyle(fontWeight: FontWeight.bold)),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBentoGrid(
      BuildContext context, RiderModel rider, AppLocalizations l10n) {
    return Row(
      children: [
        // Active Hub.
        Expanded(
          child: _BentoTile(
            icon: Icons.location_on,
            iconColor: const Color(0xFF0053C1),
            iconBgColor: const Color(0xFFEFF6FF), // blue-50
            title: 'ACTIVE HUB',
            value: rider.pickupHub ?? 'Not Assigned',
          ),
        ),
        const SizedBox(width: 12),
        // Team Leader.
        Expanded(
          child: InkWell(
            key: const Key('teamLeaderTile'),
            onTap: () => _showTLDetailsBottomSheet(context, rider),
            child: _BentoTile(
              icon: Icons.stars,
              iconColor: const Color(0xFFD97706),
              iconBgColor: const Color(0xFFFFFBEB), // amber-50
              title: 'TEAM LEADER',
              value: rider.teamLeader ?? 'Not Assigned',
            ),
          ),
        ),
      ],
    );
  }

  void _showTLDetailsBottomSheet(BuildContext context, RiderModel rider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(32),
              topRight: Radius.circular(32),
            ),
          ),
          padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                      color: const Color(0xFFE2E8F0),
                      borderRadius: BorderRadius.circular(2)),
                ),
              ),
              const SizedBox(height: 24),
              const CircleAvatar(
                radius: 48,
                backgroundColor: Color(0xFFF1F5F9),
                child: Icon(Icons.person, size: 48, color: Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 16),
              Text(
                rider.teamLeader ?? 'Team Leader',
                style: const TextStyle(
                    fontSize: 22,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFF1E293B)),
              ),
              const SizedBox(height: 4),
              const Text(
                'Assigned Team Leader',
                style: TextStyle(
                    fontSize: 13,
                    color: Color(0xFF64748B),
                    fontWeight: FontWeight.w500),
              ),
              const SizedBox(height: 24),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(16)),
                child: Row(
                  children: [
                    const Icon(Icons.phone_outlined,
                        color: Color(0xFF2563EB), size: 20),
                    const SizedBox(width: 16),
                    const Text('+91 98765 43210',
                        style: TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF1E293B))),
                    const Spacer(),
                    IconButton(
                        key: const Key('callTeamLeaderButton'),
                        onPressed: () {},
                        icon: const Icon(Icons.call, color: Color(0xFF16A34A))),
                  ],
                ),
              ),
              const SizedBox(height: 32),
              Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      key: const Key('changeTeamLeaderButton'),
                      onPressed: () {
                        Navigator.pop(context);
                        _showChangeTLReasonBottomSheet(context);
                      },
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        side: const BorderSide(color: Color(0xFFE2E8F0)),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text('Change TL',
                          style: TextStyle(
                              color: Color(0xFFDC2626),
                              fontWeight: FontWeight.bold)),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0053C1),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 16),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text('Close',
                          style: TextStyle(fontWeight: FontWeight.bold)),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }

  void _showChangeTLReasonBottomSheet(BuildContext context) {
    final TextEditingController reasonController = TextEditingController();
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Padding(
          padding:
              EdgeInsets.only(bottom: MediaQuery.of(context).viewInsets.bottom),
          child: Container(
            decoration: const BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(32),
                topRight: Radius.circular(32),
              ),
            ),
            padding: const EdgeInsets.fromLTRB(24, 12, 24, 32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 40,
                    height: 4,
                    decoration: BoxDecoration(
                        color: const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(2)),
                  ),
                ),
                const SizedBox(height: 24),
                const Text(
                  'Change Team Leader',
                  style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1E293B)),
                ),
                const SizedBox(height: 8),
                const Text(
                  'Please provide a reason for changing your assigned Team Leader. This will be reviewed by the support team.',
                  style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                ),
                const SizedBox(height: 20),
                TextField(
                  controller: reasonController,
                  maxLines: 3,
                  decoration: InputDecoration(
                    hintText: 'Enter your reason here...',
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(16),
                        borderSide: BorderSide.none),
                  ),
                ),
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: () {
                    // Logic to submit reason
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text(
                            'Your request has been submitted for approval'),
                        backgroundColor: Color(0xFF10B981),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFDC2626),
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text('Submit Request',
                      style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildReferralWidget(BuildContext context, AppLocalizations l10n) {
    return Consumer<AppProvider>(
      builder: (context, provider, _) {
        final referralCode = provider.rider?.riderId ?? 'VF-REF';
        final shareText =
            'Hey! Use my referral code $referralCode to get ₹500 off your first EV rental with VoltFleet! http://voltfleet.app/refer/$referralCode';
        return Container(
          decoration: BoxDecoration(
            color: const Color(0xFF16A34A),
            borderRadius: BorderRadius.circular(16),
          ),
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'INVITE & EARN',
                        style: TextStyle(
                          color: Colors.white.withOpacity(0.7),
                          fontSize: 10,
                          fontWeight: FontWeight.w600,
                          letterSpacing: 1.2,
                        ),
                      ),
                      const SizedBox(height: 4),
                      const Text(
                        'Refer Friends, Get Rewards!',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 14,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                  Material(
                    color: Colors.transparent,
                    child: InkWell(
                      key: const Key('shareReferralButton'),
                      onTap: () {
                        SharePlus.instance.share(
                          ShareParams(
                            text: shareText,
                            subject: 'Rent an EV with VoltFleet',
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(22),
                      child: Container(
                        width: 44,
                        height: 44,
                        decoration: BoxDecoration(
                          color: Colors.white.withOpacity(0.2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.share,
                            color: Colors.white, size: 20),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: InkWell(
                  key: const Key('copyReferralButton'),
                  onTap: () {
                    Clipboard.setData(ClipboardData(text: referralCode));
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Referral code copied!'),
                        backgroundColor: Color(0xFF16A34A),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        referralCode,
                        style: const TextStyle(
                          color: Colors.white,
                          fontFamily: 'monospace',
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                          letterSpacing: 1.5,
                        ),
                      ),
                      Icon(Icons.copy,
                          color: Colors.white.withOpacity(0.8), size: 16),
                    ],
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVehicleCard(
      BuildContext context, RiderModel rider, AppLocalizations l10n) {
    return InkWell(
      key: const Key('assignedVehicleCard'),
      onTap: () => _showVehicleDetailsBottomSheet(context, rider),
      borderRadius: BorderRadius.circular(16),
      child: Container(
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(16),
          boxShadow: const [
            BoxShadow(
              color: Color(0x0A0F172A),
              blurRadius: 48,
              offset: Offset(0, 24),
            ),
          ],
        ),
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFF3F4F6),
                borderRadius: BorderRadius.circular(12),
              ),
              child: const Icon(Icons.electric_bike,
                  color: Color(0xFF6B7280), size: 18),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'Assigned Vehicle',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF6B7280),
                    ),
                  ),
                  Text(
                    rider.assignedVehicle ?? 'Not Assigned',
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF1A1A2E),
                    ),
                  ),
                ],
              ),
            ),
            const Text(
              'Details',
              style: TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w600,
                color: Color(0xFF0053C1),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showVehicleDetailsBottomSheet(BuildContext context, RiderModel rider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          height: MediaQuery.of(context).size.height * 0.85,
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(32),
              topRight: Radius.circular(32),
            ),
          ),
          child: Column(
            children: [
              const SizedBox(height: 12),
              Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0),
                    borderRadius: BorderRadius.circular(2)),
              ),
              const SizedBox(height: 24),
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
                  children: [
                    const Text('Vehicle Details',
                        style: TextStyle(
                            fontSize: 24,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF1E293B))),
                    const SizedBox(height: 24),
                    _buildVehicleInfoRow(
                        'Reg Number', rider.assignedVehicle ?? '—'),
                    _buildVehicleInfoRow('Model', 'Voltium V1 Pro'),
                    _buildVehicleInfoRow('Battery Health', '98%'),
                    _buildVehicleInfoRow('Last Serviced', '24 Oct 2023'),
                    const SizedBox(height: 32),
                    const Text('PICKUP PHOTOS',
                        style: TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w800,
                            color: Color(0xFF64748B),
                            letterSpacing: 1.0)),
                    const SizedBox(height: 16),
                    GridView.builder(
                      shrinkWrap: true,
                      physics: const NeverScrollableScrollPhysics(),
                      gridDelegate:
                          const SliverGridDelegateWithFixedCrossAxisCount(
                              crossAxisCount: 2,
                              crossAxisSpacing: 12,
                              mainAxisSpacing: 12,
                              childAspectRatio: 1.2),
                      itemCount: 4,
                      itemBuilder: (context, index) {
                        return Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFFF1F5F9),
                            borderRadius: BorderRadius.circular(16),
                            image: const DecorationImage(
                              image: NetworkImage(
                                  'https://images.unsplash.com/photo-1558981403-c5f91cbba527?auto=format&fit=crop&q=80&w=400'),
                              fit: BoxFit.cover,
                            ),
                          ),
                          child: Align(
                            alignment: Alignment.bottomRight,
                            child: Container(
                              margin: const EdgeInsets.all(8),
                              padding: const EdgeInsets.all(4),
                              decoration: const BoxDecoration(
                                  color: Colors.black54,
                                  shape: BoxShape.circle),
                              child: const Icon(Icons.zoom_in,
                                  color: Colors.white, size: 16),
                            ),
                          ),
                        );
                      },
                    ),
                    const SizedBox(height: 32),
                    ElevatedButton(
                      onPressed: () => Navigator.pop(context),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0053C1),
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 18),
                        shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(16)),
                      ),
                      child: const Text('Back to Dashboard',
                          style: TextStyle(
                              fontWeight: FontWeight.bold, fontSize: 16)),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildVehicleInfoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 12),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label,
              style: const TextStyle(
                  fontSize: 15,
                  color: Color(0xFF64748B),
                  fontWeight: FontWeight.w500)),
          Text(value,
              style: const TextStyle(
                  fontSize: 15,
                  color: Color(0xFF1E293B),
                  fontWeight: FontWeight.bold)),
        ],
      ),
    );
  }

  // ── Formatting helpers ────────────────────────────────────────────────────

  String _daysRemaining(DateTime endDate) {
    final now = DateTime.now();
    final diff = endDate.difference(now).inDays;
    if (diff <= 0) return '0d';
    return '${diff}d';
  }

  String _formatDate(DateTime date) {
    return '${date.day}/${date.month}/${date.year}';
  }

  void _showSubscriptionBottomSheet(BuildContext context, RiderModel rider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        return Container(
          decoration: const BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.only(
              topLeft: Radius.circular(24),
              topRight: Radius.circular(24),
            ),
          ),
          padding:
              const EdgeInsets.only(top: 12, left: 24, right: 24, bottom: 32),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Drag handle
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(
                    color: const Color(0xFFE2E8F0), // slate-200
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ),
              const SizedBox(height: 24),
              const Text(
                'Manage Subscription',
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: Color(0xFF1E293B), // slate-800
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'View your current active plan details below. To change or upgrade your plan, please submit a request to your hub manager.',
                style: TextStyle(
                  fontSize: 14,
                  color: Color(0xFF64748B), // slate-500
                ),
              ),
              const SizedBox(height: 24),

              // Current Plan Card
              Container(
                padding: const EdgeInsets.all(20),
                decoration: BoxDecoration(
                  color: const Color(0xFFF8FAFC), // slate-50
                  borderRadius: BorderRadius.circular(16),
                  border:
                      Border.all(color: const Color(0xFFE2E8F0)), // slate-200
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          rider.currentPlan
                                  ?.replaceAll('_', ' ')
                                  .toUpperCase() ??
                              'NO PLAN',
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Color(0xFF0F172A), // slate-900
                          ),
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: const Color(0xFFDCFCE7), // green-100
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: const Text(
                            'Active',
                            style: TextStyle(
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFF16A34A), // green-600
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Row(
                      children: [
                        const Icon(Icons.currency_rupee,
                            size: 16, color: Color(0xFF64748B)),
                        Text(
                          '${rider.activeRentalPlanPrice.toInt()} / week',
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 24),

              // Action Buttons
              FilledButton(
                key: const Key('requestPlanChangeButton'),
                onPressed: () {
                  Navigator.pop(context);
                  AppNavigator.push(context, const TroubleshooterScreen());
                },
                style: FilledButton.styleFrom(
                  backgroundColor: const Color(0xFF0053C1),
                  foregroundColor: Colors.white,
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(27),
                  ),
                ),
                child: const Text(
                  'Request Plan Change',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              const SizedBox(height: 12),

              // End Rental Button
              OutlinedButton(
                key: const Key('endRentalButton'),
                onPressed: () {
                  Navigator.pop(context);
                  _startVehicleReturnWorkflow(context, rider);
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFFDC2626), // red-600
                  side: const BorderSide(color: Color(0xFFFECACA)), // red-200
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(27),
                  ),
                ),
                child: const Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(Icons.assignment_return_outlined, size: 20),
                    SizedBox(width: 8),
                    Text(
                      'End Rental',
                      style:
                          TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 12),

              // Change Intent Button
              OutlinedButton(
                key: const Key('changeIntentButton'),
                onPressed: () {
                  Navigator.pop(context);
                  _showIntentDialog(context, rider);
                },
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF475569), // slate-600
                  side: const BorderSide(color: Color(0xFFE2E8F0)), // slate-200
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(27),
                  ),
                ),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(Icons.work_outline, size: 20),
                    const SizedBox(width: 8),
                    Text(
                      rider.intent != null
                          ? 'Change Intent: ${rider.intent}'
                          : 'Change Intent of Use',
                      style: const TextStyle(
                          fontSize: 16, fontWeight: FontWeight.bold),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              OutlinedButton(
                onPressed: () => Navigator.pop(context),
                style: OutlinedButton.styleFrom(
                  foregroundColor: const Color(0xFF64748B),
                  side: const BorderSide(color: Color(0xFFCBD5E1)), // slate-300
                  minimumSize: const Size(double.infinity, 54),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(27),
                  ),
                ),
                child: const Text(
                  'Close',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
              ),
              // Optional safe area bottom padding
              SizedBox(height: MediaQuery.of(context).padding.bottom),
            ],
          ),
        );
      },
    );
  }

  void _startVehicleReturnWorkflow(
      BuildContext context, RiderModel rider) async {
    final picker = ImagePicker();
    final List<File> photos = [];
    final List<String> labels = [
      'Left Side',
      'Right Side',
      'Front View',
      'Speedometer'
    ];

    for (int i = 0; i < labels.length; i++) {
      final XFile? image = await showModalBottomSheet<XFile?>(
        context: context,
        backgroundColor: Colors.white,
        shape: const RoundedRectangleBorder(
          borderRadius: BorderRadius.vertical(top: Radius.circular(20)),
        ),
        builder: (context) {
          return SafeArea(
            child: Padding(
              padding: const EdgeInsets.all(24.0),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.camera_alt,
                      size: 48, color: Color(0xFF0053C1)),
                  const SizedBox(height: 16),
                  Text(
                    'Step ${i + 1} of 4',
                    style: const TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF0053C1)),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Capture ${labels[i]} of Vehicle',
                    style: const TextStyle(
                        fontSize: 18,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B)),
                  ),
                  const SizedBox(height: 8),
                  const Text(
                    'Ensure the photo is clear and well-lit for faster approval.',
                    textAlign: TextAlign.center,
                    style: TextStyle(fontSize: 14, color: Color(0xFF64748B)),
                  ),
                  const SizedBox(height: 24),
                  FilledButton.icon(
                    key: const Key('captureReturnPhotoButton'),
                    onPressed: () async {
                      final photo =
                          await picker.pickImage(source: ImageSource.camera);
                      if (context.mounted) Navigator.pop(context, photo);
                    },
                    icon: const Icon(Icons.photo_camera),
                    label: const Text('Capture Photo'),
                    style: FilledButton.styleFrom(
                      backgroundColor: const Color(0xFF0053C1),
                      minimumSize: const Size(double.infinity, 54),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                  const SizedBox(height: 12),
                  TextButton(
                    key: const Key('cancelReturnProcessButton'),
                    onPressed: () => Navigator.pop(context),
                    child: const Text('Cancel Return Process',
                        style: TextStyle(color: Color(0xFF64748B))),
                  ),
                ],
              ),
            ),
          );
        },
      );

      if (image == null) return; // User cancelled
      photos.add(File(image.path));
    }

    // After capturing all photos, show the submitting overlay
    if (context.mounted) {
      showDialog(
        context: context,
        barrierDismissible: false,
        builder: (context) => const AlertDialog(
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              CircularProgressIndicator(color: Color(0xFF0053C1)),
              SizedBox(height: 16),
              Text('Uploading photos & submitting request...',
                  style: TextStyle(fontWeight: FontWeight.bold)),
              SizedBox(height: 8),
              Text('Please do not close the app.',
                  style: TextStyle(fontSize: 12, color: Colors.grey)),
            ],
          ),
        ),
      );

      final success = await context.read<AppProvider>().submitVehicleReturn(
            photos: photos,
            reason: 'Rental Term Completed',
          );

      if (context.mounted) {
        Navigator.pop(context); // Close submitting dialog

        if (success) {
          showDialog(
            context: context,
            builder: (context) => AlertDialog(
              icon: const Icon(Icons.check_circle,
                  size: 48, color: Color(0xFF16A34A)),
              title: const Text('Return Request Submitted'),
              content: const Text(
                  'Your vehicle return request is pending approval. Our hub manager will verify your submission soon.'),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Great!'),
                ),
              ],
            ),
          );
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(
              content:
                  Text('Failed to submit return request. Please try again.'),
              backgroundColor: Color(0xFFDC2626),
            ),
          );
        }
      }
    }
  }

  void _showIntentDialog(BuildContext context, RiderModel rider) {
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Intent of Use'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              _IntentOption(
                label: 'Personal Use',
                isSelected: rider.intent == 'Personal Use',
                onTap: () => _updateIntent(context, rider, 'Personal Use'),
              ),
              _IntentOption(
                label: 'E-commerce Delivery',
                isSelected: rider.intent == 'E-commerce Delivery',
                onTap: () =>
                    _updateIntent(context, rider, 'E-commerce Delivery'),
              ),
              _IntentOption(
                label: 'Food Delivery',
                isSelected: rider.intent == 'Food Delivery',
                onTap: () => _updateIntent(context, rider, 'Food Delivery'),
              ),
              _IntentOption(
                label: 'Other',
                isSelected: rider.intent == 'Other',
                onTap: () => _updateIntent(context, rider, 'Other'),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
          ],
        );
      },
    );
  }

  void _updateIntent(BuildContext context, RiderModel rider, String newIntent) {
    final updated = rider.copyWith(intent: newIntent);
    context.read<AppProvider>().updateRider(updated);
    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text('Intent updated to $newIntent'),
        backgroundColor: const Color(0xFF16A34A),
      ),
    );
  }

  Widget _buildReturnPendingCard(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: const Color(0xFFFEF2F2),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFFCA5A5), width: 1.5),
      ),
      child: Column(
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: const BoxDecoration(
                color: Color(0xFFFEE2E2), shape: BoxShape.circle),
            child: const Icon(Icons.history_toggle_off_rounded,
                color: Color(0xFFDC2626), size: 32),
          ),
          const SizedBox(height: 12),
          const Text('RETURN PENDING',
              style: TextStyle(
                  color: Color(0xFFDC2626),
                  fontWeight: FontWeight.w900,
                  fontSize: 13,
                  letterSpacing: 1.2)),
          const SizedBox(height: 8),
          const Text(
            'You have submitted your vehicle return request. Our hub admin is currently reviewing your photos and vehicle condition.',
            textAlign: TextAlign.center,
            style: TextStyle(
                color: Color(0xFF7F1D1D),
                fontSize: 14,
                fontWeight: FontWeight.w500),
          ),
          const SizedBox(height: 12),
          const Text('Status: WAITING FOR APPROVAL',
              style: TextStyle(
                  color: Color(0xFFDC2626),
                  fontWeight: FontWeight.bold,
                  fontSize: 12)),
        ],
      ),
    );
  }

  void _showReturnVehicleBottomSheet(
      BuildContext context, AppProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (context) {
        List<File?> selectedFiles = List.filled(4, null);
        return StatefulBuilder(
          builder: (context, setModalState) {
            Future<void> pickImage(int index) async {
              final ImagePicker picker = ImagePicker();
              final XFile? image = await picker.pickImage(
                source: ImageSource.camera,
                imageQuality: 70,
              );
              if (image != null) {
                setModalState(() {
                  selectedFiles[index] = File(image.path);
                });
              }
            }

            return Container(
              height: MediaQuery.of(context).size.height * 0.85,
              decoration: const BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.only(
                    topLeft: Radius.circular(32),
                    topRight: Radius.circular(32)),
              ),
              child: Column(
                children: [
                  const SizedBox(height: 12),
                  Container(
                      width: 40,
                      height: 4,
                      decoration: BoxDecoration(
                          color: const Color(0xFFE2E8F0),
                          borderRadius: BorderRadius.circular(2))),
                  const SizedBox(height: 24),
                  Expanded(
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(24, 0, 24, 32),
                      children: [
                        const Text('Vehicle Return',
                            style: TextStyle(
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                                color: Color(0xFF1E293B))),
                        const SizedBox(height: 12),
                        const Text(
                          'Please upload 4 current photos of your vehicle capturing all sides (Front, Back, Left, Right) to initiate the return process.',
                          style:
                              TextStyle(color: Color(0xFF64748B), fontSize: 14),
                        ),
                        const SizedBox(height: 32),
                        const Text('UPLOAD VEHICLE PHOTOS',
                            style: TextStyle(
                                fontSize: 12,
                                fontWeight: FontWeight.w800,
                                color: Color(0xFF64748B),
                                letterSpacing: 1.0)),
                        const SizedBox(height: 16),
                        GridView.builder(
                          shrinkWrap: true,
                          physics: const NeverScrollableScrollPhysics(),
                          gridDelegate:
                              const SliverGridDelegateWithFixedCrossAxisCount(
                                  crossAxisCount: 2,
                                  crossAxisSpacing: 12,
                                  mainAxisSpacing: 12,
                                  childAspectRatio: 1.2),
                          itemCount: 4,
                          itemBuilder: (context, index) {
                            final file = selectedFiles[index];
                            return InkWell(
                              onTap: () => pickImage(index),
                              child: Container(
                                decoration: BoxDecoration(
                                  color: const Color(0xFFF1F5F9),
                                  borderRadius: BorderRadius.circular(16),
                                  border: Border.all(
                                      color: const Color(0xFFE2E8F0)),
                                  image: file != null
                                      ? DecorationImage(
                                          image: FileImage(file),
                                          fit: BoxFit.cover,
                                        )
                                      : null,
                                ),
                                child: file == null
                                    ? const Column(
                                        mainAxisAlignment:
                                            MainAxisAlignment.center,
                                        children: [
                                          Icon(Icons.add_a_photo_outlined,
                                              color: Color(0xFF3B82F6),
                                              size: 32),
                                          SizedBox(height: 8),
                                          Text('Add Photo',
                                              style: TextStyle(
                                                  fontSize: 12,
                                                  color: Color(0xFF64748B),
                                                  fontWeight: FontWeight.bold)),
                                        ],
                                      )
                                    : null,
                              ),
                            );
                          },
                        ),
                        const SizedBox(height: 48),
                        ElevatedButton(
                          key: const Key('completeReturnButton'),
                          onPressed: () async {
                            final files =
                                selectedFiles.whereType<File>().toList();
                            if (files.length < 4) {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content:
                                        Text('Please capture all 4 photos')),
                              );
                              return;
                            }

                            // Show loading
                            showDialog(
                              context: context,
                              barrierDismissible: false,
                              builder: (context) => const Center(
                                  child: CircularProgressIndicator()),
                            );

                            final success = await provider.submitVehicleReturn(
                              photos: files,
                            );

                            // Pop loading
                            Navigator.pop(context);

                            if (success) {
                              Navigator.pop(context);
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content: Text(
                                        'Vehicle return process initiated!'),
                                    backgroundColor: Color(0xFF10B981)),
                              );
                            } else {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                    content:
                                        Text('Submission failed. Try again.')),
                              );
                            }
                          },
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFFDC2626),
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(vertical: 18),
                            shape: RoundedRectangleBorder(
                                borderRadius: BorderRadius.circular(16)),
                          ),
                          child: const Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Icon(Icons.check_circle_outline, size: 20),
                              SizedBox(width: 12),
                              Text('Complete Return',
                                  style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 16)),
                            ],
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextButton(
                          onPressed: () => Navigator.pop(context),
                          child: const Text('Cancel',
                              style: TextStyle(
                                  color: Color(0xFF64748B),
                                  fontWeight: FontWeight.bold)),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          },
        );
      },
    );
  }
}

// =============================================================================
// Private sub-widgets
// =============================================================================

class _BentoTile extends StatelessWidget {
  const _BentoTile({
    required this.icon,
    required this.iconColor,
    required this.iconBgColor,
    required this.title,
    required this.value,
  });

  final IconData icon;
  final Color iconColor;
  final Color iconBgColor;
  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 32,
            height: 32,
            decoration: BoxDecoration(
              color: iconBgColor,
              borderRadius: BorderRadius.circular(8),
            ),
            child: Icon(icon, color: iconColor, size: 16),
          ),
          const SizedBox(height: 12),
          Text(
            title.toUpperCase(),
            style: const TextStyle(
              fontSize: 10,
              fontWeight: FontWeight.w600,
              color: Color(0xFF6B7280),
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            value,
            style: const TextStyle(
              fontSize: 14,
              fontWeight: FontWeight.bold,
              color: Color(0xFF1A1A2E), // vf-on-surface
            ),
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
          ),
        ],
      ),
    );
  }
}

class _IntentOption extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _IntentOption({
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return ListTile(
      title: Text(label),
      leading: Icon(
        isSelected ? Icons.radio_button_checked : Icons.radio_button_off,
        color: isSelected ? const Color(0xFF0053C1) : Colors.grey,
      ),
      onTap: onTap,
    );
  }
}
