import 'package:flutter/material.dart';
import 'package:provider/provider.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/models/transaction_model.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'top_up_flow.dart';
import 'package:voltium_rider/features/wallet/presentation/widgets/wallet_widgets.dart';

/// Wallet screen for the Voltium Rider App.
///
/// Shows the available balance, payment streak, top-up / history actions,
/// and a list of recent transactions. All user-facing strings come from
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
    final rider = context.select<AppProvider, RiderModel?>((p) => p.rider);
    final transactions = context
        .select<AppProvider, List<TransactionModel>>((p) => p.transactions);
    final isRefreshing =
        context.select<AppProvider, bool>((p) => p.isRefreshingTransactions);
    final appProvider = context.read<AppProvider>();
    return Scaffold(
      backgroundColor: AppColors.iconBackground,
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
                const Text('Wallet',
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
                      color: Colors.white.withValues(alpha: 0.2),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(
                      Icons.refresh,
                      color: Colors.white,
                      size: 20,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              color: AppColors.primary,
              onRefresh: () async {
                await appProvider.refresh();
                await appProvider.refreshTransactions();
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                children: [
                  const SizedBox(height: 16),

                  // Balance card.
                  FadeUpWidget(
                    delay: 100,
                    child: WalletBalanceCard(rider: rider),
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
                      onTopUp: () => Navigator.of(context).push(
                        MaterialPageRoute(builder: (_) => const TopUpFlow()),
                      ),
                      onHistory: () {},
                    ),
                  ),
                  const SizedBox(height: 24),

                  // Recent transactions with filters.
                  FadeUpWidget(
                    delay: 400,
                    child: TransactionHistorySection(
                      transactions: transactions,
                      selectedFilter: _selectedFilter,
                      onFilterChanged: (f) =>
                          setState(() => _selectedFilter = f),
                      onDeleteHistory: () =>
                          _confirmDeleteHistory(context, appProvider),
                    ),
                  ),
                  if (isRefreshing) const SizedBox.shrink(),
                ],
              ),
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
        content: const Text('This will clear your local transaction history. This action cannot be undone.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
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
}
