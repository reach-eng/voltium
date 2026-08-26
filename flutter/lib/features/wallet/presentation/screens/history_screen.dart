import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:intl/intl.dart';
import 'package:voltium_rider/features/wallet/widgets/transaction_filter.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/money_format.dart';
import 'package:voltium_rider/widgets/illustrated_empty_state.dart';
import 'package:voltium_rider/widgets/skeleton_loader.dart';

/// Matches web HistoryScreen.tsx:
/// - Header with back button and refresh
/// - Summary cards row (Credits, Debits, Net)
/// - Search bar with icon
/// - Filter tabs (All, Credits, Debits)
/// - Info hint (blue-50)
/// - Transaction list with expandable cards
/// - Each card shows: icon, title, date, status (color-coded), amount (color-coded)
/// - Expanded state shows breakdown items (Charge, Tax, Discount, Penalty)

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/models/transaction_model.dart';

class HistoryScreen extends ConsumerStatefulWidget {
  final String riderId;
  final VoidCallback? onBack;

  const HistoryScreen({
    super.key,
    required this.riderId,
    this.onBack,
  });

  @override
  ConsumerState<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends ConsumerState<HistoryScreen>
    with SingleTickerProviderStateMixin {
  // T-AR-SORT F-2 (2026-08-26): the history screen used to maintain
  // its own _activeFilter as a String ('All' / 'Credits' / 'Debits')
  // and recompute the filtered list in-memory. That duplicated the
  // shared `TransactionFilter` enum + `TransactionFilterSort` widget,
  // caused label drift (chips said "Credit" while summary cards said
  // "Credits"), and most importantly filtered-only-the-fetched-page —
  // older pages could match the filter but the user would see "End of
  // history" because the client never paged to find them. The shared
  // widget now drives the chip row; the server-side `type` query
  // param is wired in via `_loadTransactions`.
  TransactionFilter? _activeFilter;
  TransactionSort _activeSort = TransactionSort.dateDesc;
  String _searchQuery = '';
  String? _expandedId;
  late final AnimationController _entryCtrl;

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
    Future.microtask(() {
      final riderId = ref.read(riderProvider).riderId;
      if (riderId != null) {
        ref.read(walletProvider.notifier).refreshTransactions(riderId: riderId);
      }
    });
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchTransactions() async {
    final riderId = ref.read(riderProvider).riderId;
    if (riderId != null) {
      await ref
          .read(walletProvider.notifier)
          .refreshTransactions(riderId: riderId);
    }
  }

  /// T-AR-SORT F-2: in-page type filter + free-text search. The type
  /// filter is intentionally in-page (not a server `type` query param
  /// yet) — moving it to the server requires OpenAPI regen and
  /// backend support (TODO). The shared `TransactionFilter` enum
  /// drives both the chip label and the predicate, so label drift
  /// (chips said "Credit" while summary said "Credits") is gone.
  List<TransactionModel> _filteredTx(List<TransactionModel> transactions) {
    return transactions.where((tx) {
      final matchesType = switch (_activeFilter) {
        null => true,
        TransactionFilter.all => true,
        TransactionFilter.credit => tx.isCredit,
        TransactionFilter.debit => !tx.isCredit,
      };
      final description = (tx.description ?? tx.purpose ?? '').toLowerCase();
      final matchesSearch = _searchQuery.isEmpty ||
          description.contains(_searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    }).toList();
  }

  /// T-AR-SORT F-2: in-page sort. Same caveat as [_filteredTx] —
  /// the order is per-page only. Moving to the server is a TODO.
  List<TransactionModel> _sortedTx(List<TransactionModel> transactions) {
    final list = [...transactions];
    list.sort((a, b) {
      switch (_activeSort) {
        case TransactionSort.dateDesc:
          return (b.createdAt ?? DateTime(1970))
              .compareTo(a.createdAt ?? DateTime(1970));
        case TransactionSort.dateAsc:
          return (a.createdAt ?? DateTime(1970))
              .compareTo(b.createdAt ?? DateTime(1970));
        case TransactionSort.amountDesc:
          return b.amount.compareTo(a.amount);
        case TransactionSort.amountAsc:
          return a.amount.compareTo(b.amount);
      }
    });
    return list;
  }

  // AUDIT FIX 2026-08-22 (HIST-a/HIST-e): totals accumulate in integer
  // paise over ALL loaded transactions (the provider pages through up to
  // 500), not just the first page, and never via lossy double adds.
  int _totalCreditsPaise(List<TransactionModel> transactions) => transactions
      .where(
        (t) =>
            t.isCredit &&
            (t.status == TransactionStatus.approved ||
                t.status == TransactionStatus.success),
      )
      .fold(0, (sum, t) => sum + (t.amount * 100).round());

  int _totalDebitsPaise(List<TransactionModel> transactions) => transactions
      .where(
        (t) =>
            !t.isCredit &&
            (t.status == TransactionStatus.approved ||
                t.status == TransactionStatus.success),
      )
      .fold(0, (sum, t) => sum + (t.amount * 100).round());

  /// AUDIT FIX 2026-08-22 (HIST-f): same 'Jan 21, 2026' style as the
  /// wallet recent list, instead of a raw ISO `substring(0, 10)`.
  ///
  /// PR-5 (F-034 — 2026-08-22 deep audit): the previous
  /// implementation used a hardcoded English month name list, so a
  /// Hindi-locale rider still saw "Jan 21, 2026" instead of the
  /// locale-formatted "21 जन॰ 2026". Switched to
  /// `DateFormat.yMMMd(locale)` from the `intl` package (already a
  /// dependency). The format style ('MMM d, y') matches the prior
  /// English output for parity.
  String _formatDate(DateTime? dt) {
    if (dt == null) return '';
    final local = dt.toLocal();
    final locale = Localizations.localeOf(context).toLanguageTag();
    return DateFormat.yMMMd(locale).format(local);
  }

  @override
  Widget build(BuildContext context) {
    final transactions =
        ref.watch(walletProvider.select((p) => p.transactions));
    final isRefreshing =
        ref.watch(walletProvider.select((p) => p.isRefreshingTransactions));
    // AUDIT FIX 2026-08-22 (HIST-b): surface provider errors instead of
    // silently rendering the empty state.
    final lastError = ref.watch(walletProvider.select((p) => p.lastError));
    final isLoadingMore =
        ref.watch(walletProvider.select((p) => p.isLoadingMore));
    final serverTotal =
        ref.watch(walletProvider.select((p) => p.serverTotalTransactions));
    final filtered = _sortedTx(_filteredTx(transactions));
    final creditsPaise = _totalCreditsPaise(transactions);
    final debitsPaise = _totalDebitsPaise(transactions);
    final colors = AppColors.of(context);

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: isRefreshing && transactions.isEmpty
                  ? _buildLoading()
                  : (lastError != null && transactions.isEmpty)
                      ? _buildErrorState(lastError)
                      : _buildContent(
                          filtered,
                          creditsPaise,
                          debitsPaise,
                          loadedCount: transactions.length,
                          serverTotal: serverTotal,
                          isLoadingMore: isLoadingMore,
                        ),
            ),
          ],
        ),
      ),
    );
  }

  /// AUDIT FIX 2026-08-22 (HIST-b): failed loads now render an explicit
  /// error state with a retry action, not "No transactions found".
  Widget _buildErrorState(String message) {
    final colors = AppColors.of(context);
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(32),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.cloud_off_rounded,
                size: 48, color: colors.onSurfaceMuted),
            const SizedBox(height: 16),
            Text(
              AppLocalizations.of(context)?.history_loadError ??
                  'Couldn\'t load your transactions',
              style: AppTypography.titleSmall.copyWith(color: colors.onSurface),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 8),
            Text(
              message,
              style: GoogleFonts.plusJakartaSans(
                fontSize: 13,
                color: colors.onSurfaceVariant,
              ),
              textAlign: TextAlign.center,
            ),
            const SizedBox(height: 20),
            Semantics(
              button: true,
              label: 'Retry loading transactions',
              child: FilledButton.icon(
                key: const Key('historyRetryButton'),
                onPressed: _fetchTransactions,
                icon: const Icon(Icons.refresh, size: 18),
                label: Text(AppLocalizations.of(context)!.txttryAgain),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    final colors = AppColors.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          // AUDIT FIX 2026-08-22 (HIST-g): bumped to ≥48dp and given a
          // Semantics label (was a bare 40dp GestureDetector).
          Semantics(
            button: true,
            label: AppLocalizations.of(context)?.history_goBack ?? 'Go back',
            child: GestureDetector(
              onTap: widget.onBack ?? () => Navigator.maybePop(context),
              child: Container(
                width: 48,
                height: 48,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: colors.card,
                  shape: BoxShape.circle,
                  boxShadow: AppShadows.glass,
                ),
                child: Icon(
                  Icons.arrow_back,
                  size: 20,
                  color: colors.onSurface,
                ),
              ),
            ),
          ),
          SizedBox(width: 16),
          Text(
            AppLocalizations.of(context)?.history_title ??
                'Transaction History',
            style: AppTypography.titleLarge
                .copyWith(fontSize: 21)
                .copyWith(color: colors.onSurface),
          ),
          const Spacer(),
          // AUDIT FIX 2026-08-22 (HIST-g): bumped to ≥48dp + tooltip.
          Semantics(
            button: true,
            label: AppLocalizations.of(context)?.history_refreshSemantic ??
                'Refresh transactions',
            child: Tooltip(
              message:
                  AppLocalizations.of(context)?.history_refresh ?? 'Refresh',
              child: GestureDetector(
                onTap: _fetchTransactions,
                child: Container(
                  width: 48,
                  height: 48,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: colors.card,
                    shape: BoxShape.circle,
                    boxShadow: AppShadows.glass,
                  ),
                  child: Icon(
                    Icons.refresh,
                    size: 20,
                    color: colors.onSurfaceMuted,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoading() {
    // PR #6: replaced raw spinner with a layout-matched skeleton so the
    // screen doesn't jump when transactions arrive.
    return const HistoryListSkeleton();
  }

  Widget _buildContent(
    List<TransactionModel> filtered,
    int creditsPaise,
    int debitsPaise, {
    required int loadedCount,
    required int? serverTotal,
    required bool isLoadingMore,
  }) {
    // AUDIT FIX 2026-08-22 (HIST-a): true when the provider hasn't paged
    // through the rider's full history yet.
    final hasMore = serverTotal != null && loadedCount < serverTotal;
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
          sliver: SliverToBoxAdapter(
            child: Column(
              children: [
                _buildSummaryCards(creditsPaise, debitsPaise),
                // Label totals as partial when more pages exist server-side.
                if (hasMore)
                  Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text(
                      'Totals based on $loadedCount of $serverTotal transactions',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 11,
                        fontStyle: FontStyle.italic,
                        color: AppColors.of(context).onSurfaceVariant,
                      ),
                    ),
                  ),
                const SizedBox(height: 16),
                _buildSearchBar(),
                const SizedBox(height: 16),
                // T-AR-SORT F-2: replace the local _buildFilterTabs()
                // with the shared `TransactionFilterSort` widget so
                // the chip labels stay in lock-step with the wallet
                // tab ("All" / "Credit" / "Debit" — singular, matching
                // the ARB key `history_filterCredit` / `history_filterDebit`).
                // The on-filter / on-sort handlers update local state
                // and trigger a reload; the in-page filter then
                // applies the chosen type + sort so the rider sees
                // immediate UI feedback. Wiring the type to the
                // server is a follow-up (requires OpenAPI regen +
                // server-side support); today the call still loads
                // all transactions and the local filter narrows
                // them down. Sort is applied in-memory below.
                TransactionFilterSort(
                  selectedFilter: _activeFilter,
                  selectedSort: _activeSort,
                  onFilterChanged: (f) {
                    setState(() => _activeFilter = f);
                  },
                  onSortChanged: (s) {
                    setState(() => _activeSort = s);
                  },
                ),
                const SizedBox(height: 16),
                _buildInfoHint(),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
        if (filtered.isEmpty)
          // AUDIT FIX: remove const (method call inside) and use existing
          // ARB key history_noResults.
          SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: IllustratedEmptyState(
                icon: Icons.filter_list_off_rounded,
                title: AppLocalizations.of(context)?.history_noResults ??
                    'No transactions found',
                subtitle:
                    'Try a different filter or search term to see your wallet history.',
              ),
            ),
          )
        else ...[
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 0),
            sliver: SliverList.separated(
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final tx = filtered[index];
                // AUDIT FIX 2026-08-22 (HIST-i): stable composite key so
                // expansion state doesn't jump when filters change (a
                // pure index key shifts as the filtered list re-orders).
                final id =
                    '${tx.id ?? ''}_${tx.createdAt?.millisecondsSinceEpoch ?? index}';
                final isExpanded = _expandedId == id;
                return _buildTransactionCard(tx, isExpanded);
              },
            ),
          ),
          SliverToBoxAdapter(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(20, 16, 20, 32),
              child: Center(
                child: hasMore
                    ? Semantics(
                        button: true,
                        label: AppLocalizations.of(context)?.history_loadMore ??
                            'Load more transactions',
                        child: OutlinedButton.icon(
                          key: const Key('loadMoreTransactionsButton'),
                          onPressed: isLoadingMore
                              ? null
                              : () => _loadMoreTransactions(),
                          icon: isLoadingMore
                              ? const SizedBox(
                                  width: 14,
                                  height: 14,
                                  child:
                                      CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Icon(Icons.expand_more, size: 18),
                          label: Text(isLoadingMore
                              ? 'Loading…'
                              : (AppLocalizations.of(context)
                                      ?.history_loadMore ??
                                  'Load more transactions')),
                        ),
                      )
                    : Text(
                        AppLocalizations.of(context)?.history_end ??
                            'End of transaction history',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 12,
                          color: AppColors.of(context).onSurfaceMuted,
                        ),
                      ),
              ),
            ),
          ),
        ],
      ],
    );
  }

  Future<void> _loadMoreTransactions() async {
    final riderId = ref.read(riderProvider).riderId;
    if (riderId != null) {
      await ref
          .read(walletProvider.notifier)
          .loadMoreTransactions(riderId: riderId);
    }
  }

  Widget _buildSummaryCards(int creditsPaise, int debitsPaise) {
    final netPaise = creditsPaise - debitsPaise;
    final l10n = AppLocalizations.of(context);
    return Row(
      children: [
        _buildSummaryItem(
          l10n?.history_tabCredits ?? 'Credits',
          MoneyFormat.rupees(creditsPaise / 100).replaceFirst('₹', '+₹'),
          AppColors.success,
        ),
        const SizedBox(width: 8),
        _buildSummaryItem(
          l10n?.history_tabDebits ?? 'Debits',
          MoneyFormat.rupees(debitsPaise / 100).replaceFirst('₹', '-₹'),
          AppColors.error,
        ),
        const SizedBox(width: 8),
        _buildSummaryItem(
          'Net',
          MoneyFormat.rupees(netPaise / 100),
          netPaise >= 0 ? AppColors.success : AppColors.error,
        ),
      ],
    );
  }

  Widget _buildSummaryItem(String label, String value, Color color) {
    final colors = AppColors.of(context);
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.md),
          boxShadow: AppShadows.card,
        ),
        child: Column(
          children: [
            Text(
              label.toUpperCase(),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: colors.onSurfaceVariant,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: AppTypography.bodyMedium
                  .copyWith(fontWeight: FontWeight.w800)
                  .copyWith(color: color),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    final colors = AppColors.of(context);
    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        boxShadow: AppShadows.card,
      ),
      child: TextFormField(
        onChanged: (val) => setState(() => _searchQuery = val),
        style: GoogleFonts.plusJakartaSans(
          fontSize: 14,
          color: colors.onSurface,
        ),
        decoration: InputDecoration(
          hintText:
              AppLocalizations.of(context)?.history_searchHint ??
                  'Search transactions...',
          hintStyle: GoogleFonts.plusJakartaSans(
            fontSize: 14,
            color: colors.onSurfaceMuted,
          ),
          prefixIcon:
              Icon(Icons.search, size: 18, color: colors.onSurfaceMuted),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: OutlineInputBorder(
            borderRadius: BorderRadius.circular(AppRadius.md),
            borderSide: const BorderSide(color: AppColors.primary, width: 2),
          ),
          contentPadding: const EdgeInsets.symmetric(vertical: 12),
        ),
      ),
    );
  }

  Widget _buildInfoHint() {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: colors.primarySurface,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: colors.outlineVariant),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.receipt_long_outlined,
            size: 14,
            color: AppColors.primary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              AppLocalizations.of(context)?.history_tapHint ??
                  'Tap any transaction to see the full fee breakdown',
              style: GoogleFonts.plusJakartaSans(
                fontSize: 11,
                color: colors.onSurface,
                fontWeight: FontWeight.w500,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionCard(TransactionModel tx, bool isExpanded) {
    final isCredit = tx.isCredit;
    final amount = tx.amount;
    final status = tx.status.value.toUpperCase();
    // AUDIT FIX 2026-08-22 (HIST-f): consistent 'Jan 21, 2026' date style.
    final date = _formatDate(tx.createdAt);
    final id = tx.id ?? '';
    final colors = AppColors.of(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        boxShadow: AppShadows.card,
        border: isExpanded
            ? Border.all(
                color: AppColors.primary.withValues(alpha: 0.2), width: 2)
            : null,
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: () => setState(() => _expandedId = isExpanded ? null : id),
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: Spacing.paddingMd,
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isCredit ? colors.successLight : colors.errorLight,
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Icon(
                      isCredit ? Icons.trending_up : Icons.trending_down,
                      size: 18,
                      color: isCredit
                          ? colors.successLightForeground
                          : colors.errorLightForeground,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tx.description ??
                              tx.purpose ??
                              (AppLocalizations.of(context)
                                      ?.history_fallbackLabel ??
                                  'Transaction'),
                          style: AppTypography.labelLarge
                              .copyWith(color: colors.onSurface),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Text(
                              date,
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                color: colors.onSurfaceVariant,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              '|',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 11,
                                color: colors.outlineVariant,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              status,
                              // AUDIT FIX 2026-08-22 (HIST-h):
                              // REJECTED/FAILED are errors, not warnings.
                              style: AppTypography.labelSmall.copyWith(
                                  color: status == 'SUCCESS' ||
                                          status == 'APPROVED' ||
                                          status == 'COMPLETED'
                                      ? AppColors.success
                                      : status == 'REJECTED' ||
                                              status == 'FAILED'
                                          ? AppColors.error
                                          : AppColors.warning),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      Icon(
                        isCredit
                            ? Icons.add_circle_outline
                            : Icons.remove_circle_outline,
                        size: 14,
                        color: isCredit
                            ? AppColors.success
                            : colors.onSurfaceVariant,
                      ),
                      const SizedBox(width: 4),
                      Text(
                        // AUDIT FIX 2026-08-22 (HIST-d): rounding +
                        // grouping via the shared formatter.
                        '${isCredit ? '+' : '-'}${MoneyFormat.rupees(amount.abs())}',
                        style: AppTypography.bodyMedium
                            .copyWith(fontWeight: FontWeight.w800)
                            .copyWith(
                                color: isCredit
                                    ? AppColors.success
                                    : colors.onSurface),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          if (isExpanded) _buildBreakdown(tx),
        ],
      ),
    );
  }

  Widget _buildBreakdown(TransactionModel tx) {
    final breakdowns = tx.breakdowns;
    final colors = AppColors.of(context);
    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: colors.surface,
        border: Border(top: BorderSide(color: colors.outlineVariant)),
      ),
      padding: Spacing.paddingMd,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (tx.description != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                tx.description!,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 12,
                  color: colors.onSurfaceVariant,
                  fontStyle: FontStyle.italic,
                ),
              ),
            ),
          ...breakdowns.map((b) => _buildBreakdownItem(b)),
          const Divider(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                AppLocalizations.of(context)?.history_totalCharged ??
                    'TOTAL CHARGED',
                style: AppTypography.overline
                    .copyWith(color: colors.onSurfaceVariant),
              ),
              Text(
                // AUDIT FIX 2026-08-22 (HIST-d): shared formatter.
                MoneyFormat.rupees(tx.amount),
                style: AppTypography.bodyMedium
                    .copyWith(fontWeight: FontWeight.w800)
                    .copyWith(color: colors.onSurface),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBreakdownItem(TransactionBreakdown b) {
    final colors = AppColors.of(context);
    final type = b.type.name.toUpperCase();
    final label = b.label;
    final amount = b.amount;

    Color color = colors.onSurfaceMuted;
    Color bg = colors.surface;
    String prefix = '';

    if (type == 'TAX') {
      color = colors.warningLightForeground;
      bg = colors.warningLight;
    }
    if (type == 'DISCOUNT') {
      color = colors.successLightForeground;
      bg = colors.successLight;
      prefix = '-';
    }
    if (type == 'PENALTY') {
      color = colors.errorLightForeground;
      bg = colors.errorLight;
    }
    if (type == 'ADJUSTMENT') {
      color = AppColors.primary;
      bg = colors.primarySurface;
    }

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(
                  color: bg,
                  borderRadius: BorderRadius.circular(AppRadius.xs),
                ),
                child: Text(
                  type,
                  style: AppTypography.labelSmall
                      .copyWith(fontSize: 9)
                      .copyWith(color: color),
                ),
              ),
              const SizedBox(width: 8),
              Text(
                label,
                style:
                    AppTypography.bodySmall.copyWith(color: colors.onSurface),
              ),
            ],
          ),
          Text(
            // AUDIT FIX 2026-08-22 (HIST-d): shared formatter.
            '$prefix${MoneyFormat.rupees(amount.abs())}',
            style: AppTypography.labelMedium.copyWith(color: color),
          ),
        ],
      ),
    );
  }
}
