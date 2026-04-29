import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import '../gen/app_localizations.dart';
import '../models/transaction_model.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';
import '../utils/app_constants.dart';
import '../widgets/fade_up_widget.dart';

/// Wallet screen for the VoltFleet Rider App.
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
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<AppProvider>().refreshTransactions();
    });
  }

  String _selectedFilter = 'All';

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
                  onTap: () {
                    context.read<AppProvider>().refresh();
                    context.read<AppProvider>().refreshTransactions();
                  },
                  child: Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: Colors.white.withOpacity(0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.refresh, color: Colors.white, size: 20),
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
                    await provider.refresh();
                    await provider.refreshTransactions();
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
                      if (rider != null && rider.walletBalance < 500)
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

  Widget _buildSecurityDepositCard(BuildContext context, rider) {
    if (rider == null) return const SizedBox.shrink();

    final double deposit = rider.securityDeposit;
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

  Widget _buildActionRequiredBanner(rider) {
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
        ],
      ),
    );
  }

  Widget _buildBalanceCard(BuildContext context, rider, AppLocalizations l10n) {
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

              // Internal Streak Section
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

  Widget _buildActionButtons(BuildContext context, AppLocalizations l10n) {
    return Row(
      children: [
        // Top Up.
        Expanded(
          child: InkWell(
            key: const Key('topUpButton'),
            onTap: () => _showTopUpDialog(context),
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
        // History.
        Expanded(
          child: InkWell(
            key: const Key('historyButton'),
            onTap: () {},
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

  Widget _buildRecentTransactions(BuildContext context, AppLocalizations l10n,
      List<TransactionModel> transactions, AppProvider provider) {
    // Apply local filters based on selected category
    final filtered = transactions.where((tx) {
      if (_selectedFilter == 'All') return true;
      if (_selectedFilter == 'Approved')
        return tx.status == TransactionStatus.SUCCESS;
      if (_selectedFilter == 'Rejected')
        return tx.status == TransactionStatus.FAILED;
      if (_selectedFilter == 'Damage')
        return (tx.purpose ?? '').toUpperCase() == 'DAMAGE';
      if (_selectedFilter == 'Cash') return tx.remark?.toUpperCase() == 'CASH';
      if (_selectedFilter == 'UPI') return tx.upiRef != null;
      if (_selectedFilter == 'Rent')
        return tx.purpose?.toUpperCase() == 'RENTAL';
      if (_selectedFilter == 'Security')
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
              IconButton(
                onPressed: () => _confirmDeleteHistory(context, provider),
                icon: const Icon(Icons.delete_outline,
                    color: Colors.redAccent, size: 20),
                tooltip: 'Delete History',
              ),
            ],
          ),
          const SizedBox(height: 12),

          // Filters row
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
                final isSelected = _selectedFilter == f;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: InkWell(
                    key: Key('filter${f}Chip'),
                    onTap: () => setState(() => _selectedFilter = f),
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

  void _confirmDeleteHistory(BuildContext context, AppProvider provider) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete History?'),
        content: const Text(
            'This will clear your local transaction history. This action cannot be undone.'),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              await provider.deleteTransactionHistory();
              if (context.mounted) Navigator.pop(context);
            },
            child:
                const Text('Delete', style: TextStyle(color: Colors.redAccent)),
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

  void _showTopUpDialog(BuildContext context) {
    final provider = Provider.of<AppProvider>(context, listen: false);
    final l10n = AppLocalizations.of(context)!;
    final amountController = TextEditingController();
    String selectedMethod = 'UPI';
    final upiRefController = TextEditingController();
    File? selectedImage;
    bool isLoading = false;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setState) => AlertDialog(
          backgroundColor: Colors.white,
          shape:
              RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
          title: Text(
            l10n.wallet_topUp,
            style: const TextStyle(
                fontWeight: FontWeight.bold, color: Color(0xFF191C1E)),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Enter Amount (₹)',
                    style: TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(height: 8),
                TextField(
                  key: const Key('topUpAmountField'),
                  controller: amountController,
                  keyboardType: TextInputType.number,
                  decoration: InputDecoration(
                    hintText: 'e.g. 500',
                    filled: true,
                    fillColor: Colors.grey.shade50,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                const SizedBox(height: 20),
                const Text('Payment Method',
                    style: TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(height: 8),
                Row(
                  children: [
                    _MethodChip(
                      key: const Key('upiMethodChip'),
                      label: 'UPI',
                      isSelected: selectedMethod == 'UPI',
                      onTap: () => setState(() => selectedMethod = 'UPI'),
                    ),
                    const SizedBox(width: 8),
                    _MethodChip(
                      key: const Key('cashMethodChip'),
                      label: 'Cash',
                      isSelected: selectedMethod == 'Cash',
                      onTap: () => setState(() => selectedMethod = 'Cash'),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                const Text('Transaction ID / UPI Ref',
                    style: TextStyle(fontSize: 12, color: Colors.grey)),
                const SizedBox(height: 8),
                TextField(
                  key: const Key('upiRefField'),
                  controller: upiRefController,
                  decoration: InputDecoration(
                    hintText: 'Compulsory',
                    filled: true,
                    fillColor: Colors.grey.shade50,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(12),
                      borderSide: BorderSide.none,
                    ),
                  ),
                ),
                if (selectedMethod == 'Cash') ...[
                  const SizedBox(height: 20),
                  const Text('Payment Proof (Photo Required)',
                      style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 8),
                  InkWell(
                    key: const Key('paymentProofUpload'),
                    onTap: () async {
                      final picker = ImagePicker();
                      final img =
                          await picker.pickImage(source: ImageSource.camera);
                      if (img != null) {
                        setState(() => selectedImage = File(img.path));
                      }
                    },
                    child: Container(
                      height: 120,
                      width: double.infinity,
                      decoration: BoxDecoration(
                        color: Colors.grey.shade50,
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: Colors.grey.shade200),
                      ),
                      child: selectedImage == null
                          ? const Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Icon(Icons.add_a_photo_outlined,
                                    color: Colors.grey),
                                SizedBox(height: 4),
                                Text('Take Photo',
                                    style: TextStyle(
                                        fontSize: 12, color: Colors.grey)),
                              ],
                            )
                          : ClipRRect(
                              borderRadius: BorderRadius.circular(12),
                              child:
                                  Image.file(selectedImage!, fit: BoxFit.cover),
                            ),
                    ),
                  ),
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              key: const Key('cancelTopUpButton'),
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel', style: TextStyle(color: Colors.grey)),
            ),
            ElevatedButton(
              key: const Key('submitTopUpButton'),
              onPressed: isLoading
                  ? null
                  : () async {
                      final amountText = amountController.text;
                      final amount = double.tryParse(amountText);
                      if (amount == null || amount <= 0) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text('Please enter a valid amount')),
                        );
                        return;
                      }

                      if (upiRefController.text.trim().isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text('Transaction ID is compulsory')),
                        );
                        return;
                      }

                      if (selectedMethod == 'Cash' && selectedImage == null) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(
                              content: Text(
                                  'Please take a photo of the cash payment proof')),
                        );
                        return;
                      }

                      setState(() => isLoading = true);
                      try {
                        await provider.topUpWallet(
                          amount: amount,
                          method: selectedMethod.toUpperCase(),
                          upiRef: upiRefController.text,
                          image: selectedImage,
                        );
                        if (context.mounted) {
                          Navigator.pop(context);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                                content: Text(
                                    'Top-up request submitted successfully!')),
                          );
                        }
                      } catch (e) {
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Failed: $e')),
                          );
                        }
                      } finally {
                        if (context.mounted) {
                          setState(() => isLoading = false);
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0053C1),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(12)),
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
              ),
              child: isLoading
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(
                          color: Colors.white, strokeWidth: 2))
                  : const Text('Top Up',
                      style: TextStyle(
                          color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }
}

// =============================================================================
// Transaction list tile
// =============================================================================

class _TransactionListTile extends StatelessWidget {
  const _TransactionListTile({required this.tx, required this.l10n});

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

    // ── Status Color Logic (Web Parity) ──
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
          // Icon.
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

          // Amount & Status.
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

class _MethodChip extends StatelessWidget {
  final String label;
  final bool isSelected;
  final VoidCallback onTap;

  const _MethodChip({
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
