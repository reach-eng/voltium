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
