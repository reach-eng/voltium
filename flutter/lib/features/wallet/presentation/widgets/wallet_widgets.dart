import 'package:flutter/material.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/transaction_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_constants.dart';

class TransactionListTile extends StatelessWidget {
  const TransactionListTile({super.key, required this.tx, required this.l10n});

  final dynamic tx;
  final AppLocalizations l10n;

  @override
  Widget build(BuildContext context) {
    final String type = tx['type'] ?? 'OTHER';
    final String purpose = tx['purpose'] ?? '';
    final double amount = (tx['amount'] ?? 0).toDouble();
    final String status = tx['status'] ?? 'pending';
    final String dateStr = tx['createdAt'] ?? '';

    final isCredit = type == 'CREDIT' || type.contains('TOPUP');

    Color statusTextColor = const Color(0xFFD97706); // Amber
    Color statusBgColor = const Color(0xFFFFFBEB);

    if (status == 'rejected' || status == 'failed' || !isCredit) {
      statusTextColor = const Color(0xFFDC2626);
      statusBgColor = const Color(0xFFFEF2F2);
    } else if (status == 'approved' || status == 'success') {
      if (purpose.contains('REWARD')) {
        statusTextColor = const Color(0xFFF59E0B);
        statusBgColor = const Color(0xFFFFFBEB);
      } else if (purpose.contains('REFUND')) {
        statusTextColor = const Color(0xFF1B60DA);
        statusBgColor = const Color(0xFFEFF6FF);
      } else if (type.contains('TOPUP') || type == 'CREDIT') {
        statusTextColor = const Color(0xFF16A34A);
        statusBgColor = const Color(0xFFDCFCE7);
      }
    }

    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            height: 40,
            width: 40,
            decoration: BoxDecoration(
              color: const Color(0xFFF8FAFC),
              borderRadius: BorderRadius.circular(12),
            ),
            child: const Icon(Icons.account_balance_wallet, color: Color(0xFF64748B), size: 18),
          ),
          const SizedBox(width: 12),
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
                        child: Icon(Icons.arrow_outward, color: Color(0xFFDC2626), size: 12),
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
          Column(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(
                '${isCredit ? '+' : '-'}\u20B9${amount.abs().toStringAsFixed(0)}',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: isCredit ? const Color(0xFF16A34A) : const Color(0xFF1E293B),
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

class MethodChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const MethodChip({
    super.key,
    required this.label,
    required this.isSelected,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(20),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFF0053C1) : Colors.grey.shade100,
          borderRadius: BorderRadius.circular(20),
        ),
        child: Text(
          label,
          style: TextStyle(
            color: isSelected ? Colors.white : Colors.grey.shade700,
            fontWeight: FontWeight.w600,
            fontSize: 12,
          ),
        ),
      ),
    );
  }
}

class SecurityDepositCard extends StatelessWidget {
  final dynamic rider;

  const SecurityDepositCard({super.key, required this.rider});

  @override
  Widget build(BuildContext context) {
    if (rider == null) return const SizedBox.shrink();

    final double deposit = (rider.securityDeposit ?? 0).toDouble();
    final bool isRefundable = deposit >= AppConstants.depositRefundThreshold;

    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(top: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
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
}

// ── Helpers ─────────────────────────────────────────────────────────────────

String _formatCurrency(double amount) {
  return amount
      .abs()
      .toStringAsFixed(amount.truncateToDouble() == amount ? 0 : 2);
}

// ── WalletBalanceCard ───────────────────────────────────────────────────────

/// Displays the rider's wallet balance with a payment-streak indicator.
class WalletBalanceCard extends StatelessWidget {
  final dynamic rider;
  final AppLocalizations l10n;

  const WalletBalanceCard({super.key, required this.rider, required this.l10n});

  @override
  Widget build(BuildContext context) {
    final balance = rider?.walletBalance ?? 0.0;
    final int streak = rider?.paymentStreak ?? 0;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        gradient: const LinearGradient(
          colors: [Color(0xFF0053C1), Color(0xFF2F6DDE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [
          BoxShadow(
            color: Color(0x0A0F172A),
            blurRadius: 48,
            offset: Offset(0, 24),
          ),
        ],
      ),
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          // Decorative circles
          Positioned(
            right: -40,
            top: -40,
            child: Container(
              height: 160,
              width: 160,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.1),
              ),
            ),
          ),
          Positioned(
            right: 0,
            bottom: -20,
            child: Container(
              height: 96,
              width: 96,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: Colors.white.withOpacity(0.05),
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
                      color: Colors.white.withOpacity(0.7), size: 16),
                  const SizedBox(width: 8),
                  Text(
                    l10n.wallet_availableBalance,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.7),
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
              // Streak section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    l10n.wallet_paymentStreak,
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.7),
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                  Text(
                    l10n.wallet_streakOf(streak),
                    style: TextStyle(
                      color: Colors.white.withOpacity(0.9),
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
                            : Colors.white.withOpacity(0.25),
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
                      color: Colors.white.withOpacity(0.5),
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
}

// ── WalletActionButtons ─────────────────────────────────────────────────────

/// Top-up and History action buttons.
class WalletActionButtons extends StatelessWidget {
  final AppLocalizations l10n;
  final VoidCallback onTopUp;
  final VoidCallback onHistory;

  const WalletActionButtons({
    super.key,
    required this.l10n,
    required this.onTopUp,
    required this.onHistory,
  });

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: InkWell(
            key: const Key('topUpButton'),
            onTap: onTopUp,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
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
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      color: Color(0xFFDCFCE7),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.add,
                        color: Color(0xFF16A34A), size: 18),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    l10n.wallet_topUp,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: Color(0xFF191C1E),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: InkWell(
            key: const Key('historyButton'),
            onTap: onHistory,
            borderRadius: BorderRadius.circular(16),
            child: Container(
              padding: const EdgeInsets.symmetric(vertical: 14),
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
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Container(
                    width: 36,
                    height: 36,
                    decoration: const BoxDecoration(
                      color: Color(0xFFEFF6FF),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.download,
                        color: Color(0xFF0053C1), size: 18),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    l10n.wallet_history,
                    style: const TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
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
}

// ── TransactionHistorySection ───────────────────────────────────────────────

/// Recent-transaction list with filter chips.
class TransactionHistorySection extends StatelessWidget {
  final List<TransactionModel> transactions;
  final AppLocalizations l10n;
  final String selectedFilter;
  final ValueChanged<String> onFilterChanged;
  final VoidCallback onDeleteHistory;

  const TransactionHistorySection({
    super.key,
    required this.transactions,
    required this.l10n,
    required this.selectedFilter,
    required this.onFilterChanged,
    required this.onDeleteHistory,
  });

  @override
  Widget build(BuildContext context) {
    final filtered = transactions.where((tx) {
      if (selectedFilter == 'All') return true;
      if (selectedFilter == 'Approved')
        return tx.status == TransactionStatus.success;
      if (selectedFilter == 'Rejected')
        return tx.status == TransactionStatus.failed;
      if (selectedFilter == 'Damage')
        return (tx.purpose ?? '').toUpperCase() == 'DAMAGE';
      if (selectedFilter == 'Cash') return tx.remark?.toUpperCase() == 'CASH';
      if (selectedFilter == 'UPI') return tx.upiRef != null;
      if (selectedFilter == 'Rent')
        return tx.purpose?.toUpperCase() == 'RENTAL';
      if (selectedFilter == 'Security')
        return tx.purpose?.toUpperCase() == 'SECURITY_DEPOSIT';
      return true;
    }).toList();

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(20),
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
              IconButton(
                onPressed: onDeleteHistory,
                icon: const Icon(Icons.delete_outline,
                    color: Colors.redAccent, size: 20),
                tooltip: 'Delete History',
              ),
            ],
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                'All',
                'Approved',
                'Rejected',
                'Rent',
                'Security'
              ].map((f) {
                final isSelected = selectedFilter == f;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    key: Key('filter${f}Chip'),
                    onTap: () => onFilterChanged(f),
                    borderRadius: BorderRadius.circular(20),
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                      decoration: BoxDecoration(
                        color: isSelected ? const Color(0xFF1B60DA) : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(20),
                      ),
                      child: Text(
                        f,
                        style: TextStyle(
                          fontSize: 12,
                          color: isSelected ? Colors.white : const Color(0xFF64748B),
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
          if (filtered.isEmpty)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Center(
                child: Text(
                  selectedFilter == 'All'
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
                  (tx) => TransactionListTile(tx: tx, l10n: l10n),
                ),
        ],
      ),
    );
  }
}
