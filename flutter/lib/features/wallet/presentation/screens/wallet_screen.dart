import 'dart:io';
import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';

import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'top_up_flow.dart';
import 'package:voltium_rider/features/wallet/presentation/widgets/wallet_widgets.dart';

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
            padding: const EdgeInsets.fromLTRB(20, 20, 20, 24),
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


                      // Balance card.
                      FadeUpWidget(
                        delay: 100,
                        child: WalletBalanceCard(rider: rider, l10n: l10n),
                      ),
                      const SizedBox(height: 12),

                      // Security Deposit card
                      FadeUpWidget(
                        delay: 200,
                        child: SecurityDepositCard(rider: rider),
                      ),
                      const SizedBox(height: 12),

                      // Action buttons: Top Up & History.
                      FadeUpWidget(
                        delay: 300,
                        child: WalletActionButtons(
                          l10n: l10n,
                          onTopUp: () => Navigator.of(context).push(
                              MaterialPageRoute(builder: (_) => const TopUpFlow())),
                          onHistory: () {},
                        ),
                      ),
                      const SizedBox(height: 24),

                      // Recent transactions with filters.
                      FadeUpWidget(
                        delay: 400,
                        child: TransactionHistorySection(
                          transactions: provider.transactions,
                          l10n: l10n,
                          selectedFilter: _selectedFilter,
                          onFilterChanged: (f) =>
                              setState(() => _selectedFilter = f),
                          onDeleteHistory: () =>
                              _confirmDeleteHistory(context, provider),
                        ),
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
                    MethodChip(
                      key: const Key('upiMethodChip'),
                      label: 'UPI',
                      isSelected: selectedMethod == 'UPI',
                      onTap: () => setState(() => selectedMethod = 'UPI'),
                    ),
                    const SizedBox(width: 8),
                    MethodChip(
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

