import 'package:flutter/material.dart';
import 'dart:ui';
import 'package:voltium_rider/models/transaction_model.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import '../../../../theme/app_theme.dart';
import '../../../../widgets/animated_balance_counter.dart';
import '../../../../widgets/streak_celebration_bar.dart';
import '../../../../widgets/effect_widgets.dart';
import '../screens/top_up_flow.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class TransactionListTile extends StatelessWidget {
  const TransactionListTile({super.key, required this.tx});

  final dynamic tx;

  @override
  Widget build(BuildContext context) {
    // Support both TransactionModel objects and raw maps.
    final String type = tx is TransactionModel
        ? tx.type.value.toUpperCase()
        : (tx['type'] ?? 'OTHER').toString();
    final String purpose = tx is TransactionModel
        ? (tx.purpose ?? '')
        : (tx['purpose'] ?? '').toString();
    final double amount =
        tx is TransactionModel ? tx.amount : (tx['amount'] ?? 0).toDouble();
    final String status = tx is TransactionModel
        ? tx.status.name
        : (tx['status'] ?? 'pending').toString();
    final String dateStr = tx is TransactionModel
        ? (tx.createdAt?.toIso8601String() ?? '')
        : (tx['createdAt'] ?? '').toString();
    final String remark = tx is TransactionModel
        ? (tx.remark ?? '')
        : (tx['remark'] ?? '').toString();
    final isCredit = type == 'CREDIT' || type.contains('TOPUP');

    // Determine display label.
    String displayLabel;
    if (!isCredit && purpose.toUpperCase() == 'RENTAL') {
      displayLabel = 'Rent';
    } else if (purpose.toUpperCase() == 'SECURITY_DEPOSIT') {
      displayLabel = 'Security';
    } else if (!isCredit && remark.isNotEmpty) {
      displayLabel = 'Deduction';
    } else {
      displayLabel = purpose.isNotEmpty ? purpose : type;
    }

    // Status colors.
    Color statusTextColor = AppColors.warningDark;
    Color statusBgColor = AppColors.warningSurface;

    if (status == 'rejected' || status == 'failed') {
      statusTextColor = AppColors.error;
      statusBgColor = AppColors.errorSurface;
    } else if (status == 'pending') {
      statusTextColor = AppColors.warningDark;
      statusBgColor = AppColors.warningSurface;
    } else if (status == 'approved' || status == 'success') {
      if (purpose.contains('REWARD')) {
        statusTextColor = AppColors.warning;
        statusBgColor = AppColors.warningSurface;
      } else if (purpose.contains('REFUND')) {
        statusTextColor = AppColors.royalBlue;
        statusBgColor = AppColors.primarySurface;
      } else if (isCredit) {
        statusTextColor = AppColors.success;
        statusBgColor = AppColors.successSurface;
      } else {
        statusTextColor = AppColors.royalBlue;
        statusBgColor = AppColors.primarySurface;
      }
    }

    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Container(
            height: 40,
            width: 40,
            decoration: BoxDecoration(
              color: colors.surfaceAlt,
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Icon(
              Icons.account_balance_wallet,
              color: colors.onSurfaceMuted,
              size: 18,
            ),
          ),
          SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Text(
                      displayLabel,
                      style: AppTypography.bodyMediumEmphasis
                          .copyWith(color: colors.onSurface),
                    ),
                    if (!isCredit)
                      const Padding(
                        padding: EdgeInsets.only(left: 4),
                        child: Icon(
                          Icons.arrow_outward,
                          color: AppColors.error,
                          size: 12,
                        ),
                      ),
                    // Show deduction reason if applicable.
                    if (!isCredit && remark.isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(left: 4),
                        child: Text(
                          '($remark)',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 12,
                            color: colors.onSurfaceMuted,
                          ),
                        ),
                      ),
                  ],
                ),
                Text(
                  dateStr.length >= 10 ? dateStr.substring(0, 10) : dateStr,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: colors.onSurfaceVariant,
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
                style: AppTypography.bodyMediumEmphasis.copyWith(
                    color:
                        isCredit ? AppColors.success : colors.onSurface),
              ),
              SizedBox(height: 4),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                decoration: BoxDecoration(
                  color: statusBgColor,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Text(
                  status.toUpperCase(),
                  style: AppTypography.bodySmallTracked
                      .copyWith(color: statusTextColor),
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
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: isSelected ? AppColors.primary : AppColors.iconBackground,
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Text(
          label,
          style: AppTypography.bodySmallEmphasis.copyWith(
              color: isSelected ? Colors.white : AppColors.slate600),
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
    final colors = AppColors.of(context);

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
        child: Container(
          width: double.infinity,
          margin: const EdgeInsets.only(top: 12),
          padding: const EdgeInsets.all(Spacing.md),
          decoration: BoxDecoration(
            color: colors.surfaceSubtle.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(
                color: colors.outlineVariant.withValues(alpha: 0.5), width: 1),
            boxShadow: AppShadows.glass,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'SECURITY DEPOSIT',
                    style: AppTypography.bodySmallStrong.copyWith(
                        color: colors.onSurfaceMuted, letterSpacing: 1.0),
                  ),
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                    decoration: BoxDecoration(
                      color: (isRefundable
                              ? AppColors.success
                              : AppColors.error)
                          .withValues(alpha: 0.15),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      boxShadow: [
                        BoxShadow(
                          color: (isRefundable
                                  ? AppColors.success
                                  : AppColors.error)
                              .withValues(alpha: 0.3),
                          blurRadius: 12,
                        ),
                      ],
                      border: Border.all(
                        color: (isRefundable
                                ? AppColors.success
                                : AppColors.error)
                            .withValues(alpha: 0.3),
                      ),
                    ),
                    child: Text(
                      isRefundable ? 'Refundable' : 'Non-Refundable',
                      style: AppTypography.labelMedium.copyWith(
                          color: isRefundable
                              ? AppColors.success
                              : AppColors.error),
                    ),
                  ),
                ],
              ),
              SizedBox(height: 12),
              Row(
                crossAxisAlignment: CrossAxisAlignment.baseline,
                textBaseline: TextBaseline.alphabetic,
                children: [
                  Text(
                    '\u20B9',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 16,
                      fontWeight: FontWeight.w400,
                      color: colors.onSurface,
                    ),
                  ),
                  SizedBox(width: 4),
                  Text(
                    deposit.toInt().toString(),
                    style: AppTypography.headingMedium
                        .copyWith(color: colors.onSurface),
                  ),
                ],
              ),
              SizedBox(height: 12),
              Text(
                isRefundable
                    ? 'Your first top-up of ₹\u2060${deposit.toInt()} is refundable after 180 days of active service.'
                    : 'Amounts less than ₹\u2060${AppConstants.depositRefundThreshold.toInt()} are treated as account activation fees and are non-refundable.',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  color: colors.onSurfaceVariant,
                  height: 1.4,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class WalletBalanceCard extends StatelessWidget {
  final dynamic rider;

  const WalletBalanceCard({super.key, required this.rider});

  @override
  Widget build(BuildContext context) {
    final balance = rider?.walletBalance ?? 0.0;
    final int streak = rider?.paymentStreak ?? 0;
    final colors = AppColors.of(context);

    final double rentAmount = (rider?.currentPlanPrice != null)
        ? (rider!.currentPlanPrice as num).toDouble()
        : AppConstants.defaultRentalPrice;
    final DateTime? planEndDate = rider?.planEndDate as DateTime?;
    final int daysUntilDue =
        planEndDate != null ? planEndDate.difference(DateTime.now()).inDays : 0;

    // Rule 1: Pulsating red halo around amount text only if balance < top up required AND days <= 3
    final bool hasPulsatingRedAmountHalo =
        (balance < rentAmount) && (daysUntilDue <= 3);

    // Rule 2 & 3: Amount text color (Green if >= rent required, Amber if < rent required)
    final Color amountTextColor =
        (balance >= rentAmount) ? colors.success : colors.warning;

    // Rule 4: Whole card red halo if balance < rent required AND days <= 1
    final bool hasWholeCardRedHalo =
        (balance < rentAmount) && (daysUntilDue <= 1);

    Widget balanceCounter = AnimatedBalanceCounter(
      value: balance,
      textStyle: GoogleFonts.plusJakartaSans(
        color: amountTextColor,
        fontSize: 36,
        fontWeight: FontWeight.w800,
        letterSpacing: -0.5,
      ),
      duration: const Duration(milliseconds: 700),
    );

    if (hasPulsatingRedAmountHalo) {
      balanceCounter = AnimatedGlow(
        color: AppColors.error,
        duration: const Duration(milliseconds: 1500),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
          child: balanceCounter,
        ),
      );
    }

    Widget cardContent = Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        boxShadow: AppShadows.glass,
        border: Border.all(color: colors.outlineVariant, width: 1),
      ),
      child: Stack(
        children: [
          // Dynamic Mesh Gradient Background
          Positioned(
            top: -50,
            left: -50,
            child: Container(
              width: 200,
              height: 200,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withValues(alpha: 0.15),
              ),
            ),
          ),
          Positioned(
            bottom: -50,
            right: -50,
            child: Container(
              width: 150,
              height: 150,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primaryDeep.withValues(alpha: 0.2),
              ),
            ),
          ),
          Positioned.fill(
            child: BackdropFilter(
              filter: ImageFilter.blur(sigmaX: 40, sigmaY: 40),
              child: Container(color: Colors.transparent),
            ),
          ),
          // Content
          Padding(
            padding: Spacing.paddingLg,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Row(
                      children: [
                        Icon(
                          Icons.account_balance_wallet,
                          color: colors.onSurfaceMuted,
                          size: 16,
                        ),
                        SizedBox(width: 8),
                        Text(
                          'Available Balance',
                          style: GoogleFonts.plusJakartaSans(
                            color: colors.onSurfaceMuted,
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                    InkWell(
                      key: const Key('topUpButton'),
                      onTap: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (context) => const TopUpFlow(),
                          ),
                        );
                      },
                      borderRadius: BorderRadius.circular(AppRadius.md),
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: BoxDecoration(
                          color: AppColors.primary.withValues(alpha: 0.1),
                          border: Border.all(
                              color: AppColors.primary.withValues(alpha: 0.2)),
                          borderRadius: BorderRadius.circular(AppRadius.md),
                        ),
                        child: const Icon(Icons.add,
                            color: AppColors.primary, size: 20),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                balanceCounter,
                const SizedBox(height: 24),
                // Streak section
                Container(
                  padding: const EdgeInsets.all(Spacing.sm),
                  decoration: BoxDecoration(
                    color: colors.surfaceSubtle.withValues(alpha: 0.5),
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border: Border.all(
                        color: colors.outlineVariant.withValues(alpha: 0.5)),
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Payment Streak',
                            style: GoogleFonts.plusJakartaSans(
                              color: colors.onSurfaceVariant,
                              fontSize: 12,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                          Text(
                            '$streak / 5 Days',
                            style: GoogleFonts.plusJakartaSans(
                              color: AppColors.primary,
                              fontSize: 12,
                              fontWeight: FontWeight.w700,
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 8),
                      StreakCelebrationBar(
                        streak: streak,
                        earnedColor: AppColors.primary,
                        unearnedColor: colors.outlineVariant,
                      ),
                      if (streak > 0)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            '$streak day streak! Keep going to unlock premium tiers.',
                            style: GoogleFonts.plusJakartaSans(
                              color: colors.onSurfaceMuted,
                              fontSize: 10,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );

    if (hasWholeCardRedHalo) {
      return AnimatedGlow(
        color: AppColors.error,
        duration: const Duration(milliseconds: 1800),
        child: cardContent,
      );
    }

    return cardContent;
  }
}

class WalletActionButtons extends StatelessWidget {
  final VoidCallback onTopUp;
  final VoidCallback onHistory;

  const WalletActionButtons({
    super.key,
    required this.onTopUp,
    required this.onHistory,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Row(
      children: [
        Expanded(
          child: InkWell(
            key: const Key('topUpButton'),
            onTap: onTopUp,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: colors.card.withValues(alpha: 0.8),
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border: Border.all(color: colors.outlineVariant, width: 1),
                    boxShadow: AppShadows.glass,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: const BoxDecoration(
                          color: AppColors.successSurface,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.add,
                          color: AppColors.success,
                          size: 18,
                        ),
                      ),
                      SizedBox(width: 8),
                      Text(
                        'Top Up',
                        style: AppTypography.bodyMediumEmphasis
                            .copyWith(color: colors.onSurface),
                      ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: InkWell(
            key: const Key('historyButton'),
            onTap: onHistory,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              child: BackdropFilter(
                filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
                child: Container(
                  padding: const EdgeInsets.symmetric(vertical: 14),
                  decoration: BoxDecoration(
                    color: colors.card.withValues(alpha: 0.8),
                    borderRadius: BorderRadius.circular(AppRadius.lg),
                    border: Border.all(color: colors.outlineVariant, width: 1),
                    boxShadow: AppShadows.glass,
                  ),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Container(
                        width: 36,
                        height: 36,
                        decoration: const BoxDecoration(
                          color: AppColors.primarySurface,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.download,
                          color: AppColors.primary,
                          size: 18,
                        ),
                      ),
                      SizedBox(width: 8),
                      Text(
                        'History',
                        style: AppTypography.bodyMediumEmphasis
                            .copyWith(color: colors.onSurface),
                      ),
                    ],
                  ),
                ),
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
  final String selectedFilter;
  final ValueChanged<String> onFilterChanged;

  const TransactionHistorySection({
    super.key,
    required this.transactions,
    required this.selectedFilter,
    required this.onFilterChanged,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    final filtered = transactions.where((tx) {
      if (selectedFilter == 'All') return true;

      final String status = tx.status.value;
      final String type = tx.type.value;
      final String purpose = tx.purpose ?? '';
      final String remark = tx.remark ?? '';

      if (selectedFilter == 'Approved') {
        return status.toLowerCase() == 'approved' ||
            status.toLowerCase() == 'success';
      }
      if (selectedFilter == 'Pending') {
        return status.toLowerCase() == 'pending';
      }
      if (selectedFilter == 'Rejected') {
        return status.toLowerCase() == 'rejected' ||
            status.toLowerCase() == 'failed';
      }
      if (selectedFilter == 'Rent') {
        return purpose.toUpperCase() == 'RENTAL' &&
            type.toLowerCase() == 'debit';
      }
      if (selectedFilter == 'Security') {
        return purpose.toUpperCase() == 'SECURITY_DEPOSIT';
      }
      if (selectedFilter == 'Deduction') {
        return type.toLowerCase() == 'debit' &&
            purpose.toUpperCase() != 'RENTAL' &&
            remark.isNotEmpty;
      }
      return true;
    }).toList();

    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.xl),
        border: Border.all(color: colors.outlineVariant, width: 1),
        boxShadow: AppShadows.glass,
      ),
      padding: const EdgeInsets.all(Spacing.md),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Recent Transactions',
                style: AppTypography.labelLarge
                    .copyWith(color: AppColors.onSurfaceAlt),
              ),
            ],
          ),
          SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                'All',
                'Approved',
                'Pending',
                'Rejected',
                'Rent',
                'Security',
                'Deduction'
              ].map((f) {
                final isSelected = selectedFilter == f;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    key: Key('filter${f}Chip'),
                    label: Text(
                      f.toUpperCase(),
                      style: AppTypography.labelMedium.copyWith(
                          color: isSelected
                              ? Colors.white
                              : colors.onSurfaceMuted),
                    ),
                    selected: isSelected,
                    selectedColor: AppColors.primary,
                    backgroundColor: colors.surfaceSubtle,
                    side: BorderSide(
                        color: isSelected
                            ? AppColors.primary
                            : colors.outlineVariant),
                    shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(AppRadius.lg)),
                    onSelected: (_) => onFilterChanged(f),
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
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 13,
                    color: colors.onSurfaceMuted,
                    fontStyle: FontStyle.italic,
                  ),
                ),
              ),
            )
          else
            ListView.separated(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: filtered.length > 10 ? 10 : filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 0),
              itemBuilder: (context, index) {
                return TransactionListTile(tx: filtered[index]);
              },
            ),
        ],
      ),
    );
  }
}
