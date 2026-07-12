import 'package:flutter/material.dart';
import 'package:voltium_rider/widgets/top_up_request_sent_card.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'top_up_flow.dart';
import 'package:voltium_rider/features/wallet/presentation/widgets/wallet_widgets.dart';

import 'package:google_fonts/google_fonts.dart';

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
    final transactions = ref.watch(appProvider.select((p) => p.transactions));
    final isRefreshing =
        ref.watch(appProvider.select((p) => p.isRefreshingTransactions));
    return Scaffold(
      backgroundColor: AppColors.iconBackground,
      appBar: AppBar(
        backgroundColor: AppColors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        automaticallyImplyLeading: false,
        centerTitle: false,
        titleSpacing: 20,
        title: Text(
          'Wallet',
          style: GoogleFonts.plusJakartaSans(
            fontSize: 24,
            fontWeight: FontWeight.w900,
            color: const Color(0xFF1E293B),
            letterSpacing: -0.5,
          ),
        ),
      ),
      body: Column(
        children: [
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
                      (rider.depositStatus ==
                              DepositStatus.pendingVerification ||
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
