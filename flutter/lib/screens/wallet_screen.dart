import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import '../gen/app_localizations.dart';
import '../models/rider_model.dart';
import '../models/transaction_model.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';
import '../utils/app_constants.dart';
import '../utils/app_navigator.dart';
import '../widgets/fade_up_widget.dart';
import 'history_screen.dart';
import 'top_up_purpose_screen.dart';
import 'top_up_amount_screen.dart';
import 'top_up_upi_screen.dart';

/// Wallet screen for the Voltium Rider App.
///
/// Shows the available balance, payment streak, top-up / history actions,
/// and a list of recent transactions. All user-facing strings come from
/// [AppLocalizations].
class WalletScreen extends StatefulWidget {
  const WalletScreen({super.key});

  @override
  State<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends State<WalletScreen> {
  String _selectedFilter = 'All';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppProvider>().refreshTransactions();
    });
  }

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF1F5F9),
      body: Column(
        children: [
          // Header / AppBar Parity
          Container(
            padding: const EdgeInsets.fromLTRB(20, 52, 20, 32),
            decoration: const BoxDecoration(
              color: Color(0xFF1B60DA),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Wallet',
                  style: TextStyle(
                    fontSize: 20,
                    fontWeight: FontWeight.bold,
                    color: Colors.white,
                  ),
                ),
                InkWell(
                  key: const Key('refreshButton'),
                  onTap: () async {
                    try {
                      await context.read<AppProvider>().refresh();
                      await context.read<AppProvider>().refreshTransactions();
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text('Failed to refresh'),
                              backgroundColor: Color(0xFFEF4444)),
                        );
                      }
                    }
                  },
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.refresh,
                        color: Colors.white, size: 20),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: Consumer<AppProvider>(
              builder: (context, provider, _) {
                final l10n = AppLocalizations.of(context)!;
                final rider = provider.rider;
                final isCache = provider.dataState == DataState.fromCache;

                return RefreshIndicator(
                  color: AppColors.primary,
                  onRefresh: () async {
                    try {
                      await provider.refresh();
                      await provider.refreshTransactions();
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text('Failed to refresh'),
                              backgroundColor: Color(0xFFEF4444)),
                        );
                      }
                    }
                  },
                  child: ListView(
                    padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                    children: [
                      const SizedBox(height: 16),
                      // Cache indicator.
                      if (isCache) ...[
                        _buildCacheIndicator(l10n),
                        const SizedBox(height: 12),
                      ],

                      // Action Banner (Low Balance)
                      if (rider != null)
                        FadeUpWidget(
                          delay: 0,
                          child: _buildActionRequiredBanner(rider),
                        ),
                      const SizedBox(height: 16),

                      // Balance card.
                      FadeUpWidget(
                        delay: 100,
                        child: _buildBalanceCard(context, rider, l10n),
                      ),
                      const SizedBox(height: 12),

                      // Security Deposit card
                      FadeUpWidget(
                        delay: 200,
                        child: _buildSecurityDepositCard(context, rider),
                      ),
                      const SizedBox(height: 12),

                      // Action buttons: Top Up & History.
                      FadeUpWidget(
                        delay: 300,
                        child: _buildActionButtons(context, l10n),
                      ),
                      const SizedBox(height: 24),

                      // Recent transactions with filters.
                      FadeUpWidget(
                        delay: 400,
                        child: _buildRecentTransactions(
                            context, l10n, provider.transactions, provider),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  // ── Widget builders ───────────────────────────────────────────────────────

  Widget _buildSecurityDepositCard(BuildContext context, RiderModel? rider) {
    if (rider == null) return const SizedBox.shrink();

    final double deposit = rider.securityDeposit;
    final bool isRefundable = deposit >= AppConstants.depositRefundThreshold;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
        boxShadow: const [
          BoxShadow(
            color: Color(0x050F172A),
            blurRadius: 24,
            offset: Offset(0, 8),
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
                'SECURITY DEPOSIT',
                style: TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF64748B),
                  letterSpacing: 1.0,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                decoration: BoxDecoration(
                  color: isRefundable
                      ? const Color(0xFFDCFCE7)
                      : const Color(0xFFFEF2F2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  isRefundable ? 'Refundable' : 'Non-Refundable',
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.bold,
                    color: isRefundable
                        ? const Color(0xFF16A34A)
                        : const Color(0xFFDC2626),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Row(
            crossAxisAlignment: CrossAxisAlignment.baseline,
            textBaseline: TextBaseline.alphabetic,
            children: [
              const Text(
                '\u20B9',
                style: TextStyle(
                  fontSize: 16,
                  fontWeight: FontWeight.w400,
                  color: Color(0xFF1E293B),
                ),
              ),
              const SizedBox(width: 4),
              Text(
                deposit.toInt().toString(),
                style: const TextStyle(
                  fontSize: 24,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFF1E293B),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            isRefundable
                ? 'Your first top-up of ₹${deposit.toInt()} is refundable after 180 days of active service.'
                : 'Amounts less than ₹${AppConstants.depositRefundThreshold.toInt()} are treated as account activation fees and are non-refundable.',
            style: const TextStyle(
              fontSize: 12,
              color: Color(0xFF64748B),
              height: 1.4,
            ),
          ),
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

  Widget _buildActionRequiredBanner(RiderModel? rider) {
    if (rider == null) return const SizedBox.shrink();
    bool isLowBalance = rider.walletBalance <
        (rider.activeRentalPlanPrice * AppConstants.lowBalanceThresholdRatio);

    if (!isLowBalance) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB), // amber-50
        borderRadius: BorderRadius.circular(24),
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
        ],
      ),
    );
  }

  Widget _buildBalanceCard(
      BuildContext context, RiderModel? rider, AppLocalizations l10n) {
    final balance = rider?.walletBalance ?? 0.0;
    final int streak = rider?.paymentStreak ?? 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF1B60DA), Color(0xFF2F6DDE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x261B60DA),
            blurRadius: 40,
            offset: Offset(0, 20),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Decorative circles
          Positioned(
            right: -16,
            top: -16,
            child: Container(
              height: 160,
              width: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.1),
              ),
            ),
          ),
          Positioned(
            right: -8,
            bottom: -16,
            child: Container(
              height: 24,
              width: 24,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withValues(alpha: 0.1),
              ),
            ),
          ),

          // Content
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(Icons.account_balance_wallet,
                      color: Colors.white.withValues(alpha: 0.7), size: 16),
                  const SizedBox(width: 8),
                  Text(
                    l10n.wallet_availableBalance,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  const Text(
                    '\u20B9',
                    style: TextStyle(
                      color: Colors.white,
                      fontSize: 28,
                      fontWeight: FontWeight.w300,
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(
                    _formatCurrency(balance),
                    key: const Key('walletBalanceText'),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 36,
                      fontWeight: FontWeight.w800,
                      letterSpacing: -0.5,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),

              // Internal Streak Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    l10n.wallet_paymentStreak,
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.7),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    l10n.wallet_streakOf(streak),
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.9),
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                children: List.generate(5, (index) {
                  return Expanded(
                    child: Container(
                      height: 10,
                      margin: EdgeInsets.only(right: index < 4 ? 6 : 0),
                      decoration: BoxDecoration(
                        color: index < streak
                            ? Colors.white
                            : Colors.white.withValues(alpha: 0.25),
                        borderRadius: BorderRadius.circular(5),
                      ),
                    ),
                  );
                }),
              ),
              if (streak > 0)
                Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Text(
                    '$streak day streak! Keep going to unlock premium tiers.',
                    style: TextStyle(
                      color: Colors.white.withValues(alpha: 0.5),
                      fontSize: 10,
                    ),
                  ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(BuildContext context, AppLocalizations l10n) {
    return Row(
      children: [
        // Top Up.
        Expanded(
          child: InkWell(
            key: const Key('topUpButton'),
            onTap: () {
              AppNavigator.push(
                context,
                TopUpPurposeScreen(
                  onContinue: (purpose) {
                    AppNavigator.push(
                      context,
                      TopUpAmountScreen(
                        onProceed: (amount) {
                          AppNavigator.push(
                            context,
                            TopUpUpiScreen(
                              amount: amount,
                              purpose: purpose == TopUpPurpose.topUp
                                  ? 'Wallet Top-up'
                                  : 'Security Deposit',
                            ),
                          );
                        },
                      ),
                    );
                  },
                ),
              );
            },
            borderRadius: BorderRadius.circular(24),
            child: Container(
              height: 64,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x05000000),
                    blurRadius: 10,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Color(0xFFDCFCE7),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.add,
                        color: Color(0xFF16A34A), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    l10n.wallet_topUp,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        // History.
        Expanded(
          child: InkWell(
            key: const Key('historyButton'),
            onTap: () {
              final rider = context.read<AppProvider>().rider;
              if (rider != null && rider.id != null) {
                AppNavigator.push(
                  context,
                  HistoryScreen(riderId: rider.id!),
                );
              }
            },
            borderRadius: BorderRadius.circular(24),
            child: Container(
              height: 64,
              decoration: BoxDecoration(
                color: Colors.white,
                borderRadius: BorderRadius.circular(24),
                boxShadow: const [
                  BoxShadow(
                    color: Color(0x05000000),
                    blurRadius: 10,
                    offset: Offset(0, 4),
                  ),
                ],
              ),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: const BoxDecoration(
                      color: Color(0xFFEFF6FF),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.download,
                        color: Color(0xFF0053C1), size: 20),
                  ),
                  const SizedBox(width: 12),
                  Text(
                    l10n.wallet_history,
                    style: const TextStyle(
                      fontSize: 15,
                      fontWeight: FontWeight.bold,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildRecentTransactions(BuildContext context, AppLocalizations l10n,
      List<TransactionModel> transactions, AppProvider provider) {
    // Apply local filters based on selected category
    final filtered = transactions.where((tx) {
      if (_selectedFilter == 'All') return true;
      if (_selectedFilter == 'Approved')
        return tx.status == TransactionStatus.success;
      if (_selectedFilter == 'Rejected')
        return tx.status == TransactionStatus.failed;
      if (_selectedFilter == 'Rent')
        return tx.purpose?.toUpperCase() == 'RENTAL';
      if (_selectedFilter == 'Security')
        return tx.purpose?.toUpperCase() == 'SECURITY_DEPOSIT';
      return true;
    }).toList();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(24),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      padding: const EdgeInsets.all(20),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section header.
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                l10n.wallet_recentTransactions,
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFF191C1E),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Filters row
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children:
                  ['All', 'Approved', 'Rejected', 'Rent', 'Security'].map((f) {
                final isSelected = _selectedFilter == f;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    key: Key('filter${f}Chip'),
                    onTap: () => setState(() => _selectedFilter = f),
                    borderRadius: BorderRadius.circular(24),
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                          horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected
                            ? const Color(0xFF1B60DA)
                            : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(24),
                      ),
                      child: Text(
                        f,
                        style: TextStyle(
                          fontSize: 12,
                          color: isSelected
                              ? Colors.white
                              : const Color(0xFF64748B),
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 16),

          // Transaction list.
          if (filtered.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  _selectedFilter == 'All'
                      ? 'No transactions yet'
                      : 'No transactions matching filter',
                  style: TextStyle(
                    fontSize: 13,
                    color: Colors.grey.shade400,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
            )
          else
            ...filtered.take(10).map(
                  (tx) => _TransactionListTile(tx: tx, l10n: l10n),
                ),
        ],
      ),
    );
  }

  // ── Formatting helpers ────────────────────────────────────────────────────

  String _formatCurrency(double amount) {
    return amount
        .abs()
        .toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2);
  }
}

// =============================================================================
// Transaction list tile
// =============================================================================
// Transaction list tile
// =============================================================================

class _TransactionListTile extends StatelessWidget {
  const _TransactionListTile({required this.tx, required this.l10n});

  final TransactionModel tx;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final String type = tx.type.name;
    final String purpose = tx.purpose ?? '';
    final double amount = tx.amount;
    final String status = tx.status.name;
    final String dateStr = tx.createdAt?.toIso8601String() ?? '';

    final isCredit = tx.isCredit;

    // ── Status Color Logic (Web Parity) ──
    Color statusTextColor = const Color(0xFFD97706); // Amber
    Color statusBgColor = const Color(0xFFFFFBEB);

    if (tx.status == TransactionStatus.failed) {
      statusTextColor = const Color(0xFFDC2626);
      statusBgColor = const Color(0xFFFEF2F2);
    } else if (tx.status == TransactionStatus.success) {
      if (purpose.contains('REWARD')) {
        statusTextColor = const Color(0xFFF59E0B);
        statusBgColor = const Color(0xFFFFFBEB);
      } else if (purpose.contains('REFUND')) {
        statusTextColor = const Color(0xFF1B60DA);
        statusBgColor = const Color(0xFFEFF6FF);
      } else if (isCredit) {
        statusTextColor = const Color(0xFF16A34A);
        statusBgColor = const Color(0xFFDCFCE7);
      }
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          // Icon.
          Container(
            height: 40,
            width: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.account_balance_wallet,
                color: Color(0xFF64748B), size: 18),
          ),
          const SizedBox(width: 12),

          // Details.
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      purpose.isNotEmpty ? purpose : type,
                      style: const TextStyle(
                        fontSize: 14,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF1E293B),
                      ),
                    ),
                    if (!isCredit)
                      const Padding(
                        padding: EdgeInsets.only(left: 4),
                        child: Icon(Icons.arrow_outward,
                            color: Color(0xFFDC2626), size: 12),
                      ),
                  ],
                ),
                Text(
                  dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr,
                  style: const TextStyle(
                    fontSize: 11,
                    color: Color(0xFF64748B),
                  ),
                ),
              ],
            ),
          ),

          // Amount & Status.
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isCredit ? '+' : '-'}\u20B9${amount.abs().toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: isCredit
                      ? const Color(0xFF16A34A)
                      : const Color(0xFF1E293B),
                ),
              ),
              const SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: statusBgColor,
                  borderRadius: BorderRadius.circular(12),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w900,
                    color: statusTextColor,
                  ),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
