import 'package:flutter/material.dart';
import 'package:voltium_rider/features/wallet/widgets/top_up_request_sent_card.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/fade_up_widget.dart';
import 'top_up_flow.dart';
import 'package:voltium_rider/features/wallet/presentation/widgets/wallet_widgets.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/widgets/skeleton_loader.dart';

/// Wallet screen for the Voltium Rider App.
///
/// Shows the available balance, payment streak, top-up / history actions,
/// and a list of recent transactions.
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
      final riderId = ref.read(riderProvider).riderId;
      if (riderId != null) {
        ref.read(walletProvider.notifier).refreshTransactions(riderId: riderId);
      }
    });
  }

  String _selectedFilter = 'All';

  // ── Build ─────────────────────────────────────────────────────────────────

  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final transactions =
        ref.watch(walletProvider.select((p) => p.transactions));
    final isRefreshing =
        ref.watch(walletProvider.select((p) => p.isRefreshingTransactions));
    final dataState = ref.watch(riderProvider.select((p) => p.dataState));
    final isLoading =
        rider == null && (dataState == DataState.initial || isRefreshing);

    // DARK-MODE-AUDIT 2026-08-14 P0-6 + P0-7: the previous
    // version used static `AppColors.of(context).iconBackground` (#F1F5F9,
    // light) for the scaffold AND the AppBar AND
    // `AppColors.of(context).onSurface` (#1E293B, which IS the dark card
    // surface) for the "Wallet" title. In dark mode:
    //   - the scaffold stayed light while the cards inside
    //     were dark, producing a 2014-era dark-mode attempt;
    //   - the title became the same colour as the dark card
    //     and disappeared against it.
    // Both now read from the brightness-aware theme.
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.iconBackground,
      appBar: AppBar(
        backgroundColor: colors.iconBackground,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        automaticallyImplyLeading: false,
        centerTitle: false,
        titleSpacing: 20,
        title: Text(
          'Wallet',
          style: AppTypography.headingMedium
              .copyWith(color: colors.onSurface, letterSpacing: -0.5),
        ),
      ),
      body: isLoading
          ? const WalletSkeleton()
          : Column(
              children: [
                Expanded(
                  child: RefreshIndicator(
                    color: AppColors.primary,
                    onRefresh: () async {
                      final riderId = ref.read(riderProvider).riderId;
                      await Future.wait<dynamic>([
                        ref.read(riderProvider.notifier).refreshFromApi(),
                        if (riderId != null)
                          ref
                              .read(walletProvider.notifier)
                              .refreshTransactions(riderId: riderId),
                      ]);
                    },
                    child: ListView(
                      padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
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
                        if (rider != null &&
                            (rider.depositStatus ==
                                    DepositStatus.pendingVerification ||
                                rider.depositStatus ==
                                    DepositStatus.rejected)) ...[
                          FadeUpWidget(
                            delay: 300,
                            child: TopUpRequestSentCard(
                              rider: rider,
                              topUpAmount: rider.depositRecord != null
                                  ? rider.depositRecord!.amountInRupees.round()
                                  : 0,
                              onResubmit: () => Navigator.of(context).push(
                                MaterialPageRoute(
                                    builder: (_) => const TopUpFlow()),
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
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}
