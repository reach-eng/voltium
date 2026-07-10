import 'package:flutter/material.dart';
import 'package:voltium_rider/widgets/top_up_request_sent_card.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/models/transaction_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'top_up_flow.dart';
import 'package:voltium_rider/features/wallet/presentation/widgets/wallet_widgets.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';

/// Wallet screen for the Voltium Rider App.
///
/// Shows the available balance, payment streak, top-up / history actions,
/// and a list of recent transactions. All user-facing strings come from
class WalletScreen extends ConsumerStatefulWidget {
  const WalletScreen({super.key});

  @override
  ConsumerState<WalletScreen> createState() => _WalletScreenState();
}

class _WalletScreenState extends ConsumerState<WalletScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(appProvider).refreshTransactions();
    });
  }

  String _selectedFilter = 'All';

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(appProvider.select((p) => p.rider));
    final transactions =
        ref.watch(appProvider.select((p) => p.transactions));
    final isRefreshing =
        ref.watch(appProvider.select((p) => p.isRefreshingTransactions));
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
                    ref.read(appProvider).refresh();
                    ref.read(appProvider).refreshTransactions();
                  },
                  child: Container(
                    padding: const EdgeInsets.all(12),
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
                await ref.read(appProvider).refresh();
                await ref.read(appProvider).refreshTransactions();
              },
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 100),
                children: [
                  const SizedBox(height: 16),

                  // Balance card.
                  FadeUpWidget(
                    delay: 100,
                    child: WalletBalanceCard(
                      rider: rider,
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Security Deposit card
                  FadeUpWidget(
                    delay: 200,
                    child: SecurityDepositCard(rider: rider),
                  ),
                  const SizedBox(height: 12),
                  if (rider != null &&
                      (rider.depositStatus == DepositStatus.pendingVerification ||
                          rider.depositStatus == DepositStatus.rejected)) ...[
                    FadeUpWidget(
                      delay: 300,
                      child: TopUpRequestSentCard(
                        rider: rider,
                        topUpAmount: rider.depositRecord != null 
                            ? (rider.depositRecord!.amountInPaise / 100).round() 
                            : 0,
                        onResubmit: () => Navigator.of(context).push(
                          MaterialPageRoute(builder: (_) => const TopUpFlow()),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Recent transactions with filters.
                  FadeUpWidget(
                    delay: 400,
                    child: TransactionHistorySection(
                      transactions: transactions,
                      selectedFilter: _selectedFilter,
                      onFilterChanged: (f) =>
                          setState(() => _selectedFilter = f),
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
}
