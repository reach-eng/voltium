import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
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
  String _activeFilter = 'All';
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

  List<TransactionModel> _filteredTx(List<TransactionModel> transactions) {
    return transactions.where((tx) {
      final isCredit = tx.isCredit;
      final matchesFilter = _activeFilter == 'All' ||
          (_activeFilter == 'Credits' && isCredit) ||
          (_activeFilter == 'Debits' && !isCredit);
      final description = (tx.description ?? tx.purpose ?? '').toLowerCase();
      final matchesSearch = _searchQuery.isEmpty ||
          description.contains(_searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    }).toList();
  }

  double _totalCredits(List<TransactionModel> transactions) => transactions
      .where(
        (t) =>
            t.isCredit &&
            (t.status == TransactionStatus.approved ||
                t.status == TransactionStatus.success),
      )
      .fold(0.0, (sum, t) => sum + t.amount);

  double _totalDebits(List<TransactionModel> transactions) => transactions
      .where(
        (t) =>
            !t.isCredit &&
            (t.status == TransactionStatus.approved ||
                t.status == TransactionStatus.success),
      )
      .fold(0.0, (sum, t) => sum + t.amount);

  @override
  Widget build(BuildContext context) {
    final transactions =
        ref.watch(walletProvider.select((p) => p.transactions));
    final isRefreshing =
        ref.watch(walletProvider.select((p) => p.isRefreshingTransactions));
    final filtered = _filteredTx(transactions);
    final credits = _totalCredits(transactions);
    final debits = _totalDebits(transactions);
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
                  : _buildContent(filtered, credits, debits),
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
          GestureDetector(
            onTap: widget.onBack ?? () => Navigator.maybePop(context),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: colors.card,
                shape: BoxShape.circle,
                boxShadow: AppShadows.glass,
              ),
              child: Icon(
                Icons.arrow_back,
                size: 18,
                color: colors.onSurface,
              ),
            ),
          ),
          SizedBox(width: 16),
          Text(
            'Transaction History',
            style: AppTypography.titleLarge
                .copyWith(fontSize: 21)
                .copyWith(color: colors.onSurface),
          ),
          const Spacer(),
          GestureDetector(
            onTap: _fetchTransactions,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: colors.card,
                shape: BoxShape.circle,
                boxShadow: AppShadows.glass,
              ),
              child: Icon(
                Icons.refresh,
                size: 16,
                color: colors.onSurfaceMuted,
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
      List<TransactionModel> filtered, double credits, double debits) {
    return CustomScrollView(
      slivers: [
        SliverPadding(
          padding: const EdgeInsets.fromLTRB(20, 8, 20, 0),
          sliver: SliverToBoxAdapter(
            child: Column(
              children: [
                _buildSummaryCards(credits, debits),
                const SizedBox(height: 16),
                _buildSearchBar(),
                const SizedBox(height: 16),
                _buildFilterTabs(),
                const SizedBox(height: 16),
                _buildInfoHint(),
                const SizedBox(height: 16),
              ],
            ),
          ),
        ),
        if (filtered.isEmpty)
          const SliverToBoxAdapter(
            child: Padding(
              padding: EdgeInsets.symmetric(vertical: 32),
              child: IllustratedEmptyState(
                icon: Icons.filter_list_off_rounded,
                title: 'No transactions found',
                subtitle:
                    'Try a different filter or search term to see your wallet history.',
              ),
            ),
          )
        else
          SliverPadding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 32),
            sliver: SliverList.separated(
              itemCount: filtered.length,
              separatorBuilder: (_, __) => const SizedBox(height: 8),
              itemBuilder: (context, index) {
                final tx = filtered[index];
                final id = tx.id ?? index.toString();
                final isExpanded = _expandedId == id;
                return _buildTransactionCard(tx, isExpanded);
              },
            ),
          ),
      ],
    );
  }

  Widget _buildSummaryCards(double credits, double debits) {
    return Row(
      children: [
        _buildSummaryItem(
          'Credits',
          '+₹${credits.toInt()}',
          AppColors.success,
        ),
        const SizedBox(width: 8),
        _buildSummaryItem(
          'Debits',
          '-₹${debits.toInt()}',
          AppColors.error,
        ),
        const SizedBox(width: 8),
        _buildSummaryItem(
          'Net',
          '₹${(credits - debits).toInt()}',
          (credits - debits) >= 0 ? AppColors.success : AppColors.error,
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
          hintText: 'Search transactions...',
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

  Widget _buildFilterTabs() {
    final colors = AppColors.of(context);
    final tabs = ['All', 'Credits', 'Debits'];
    return Row(
      children: tabs.map((tab) {
        final isActive = _activeFilter == tab;
        return Expanded(
          child: Padding(
            padding: EdgeInsets.only(right: tab == 'Debits' ? 0 : 8),
            child: GestureDetector(
              onTap: () => setState(() => _activeFilter = tab),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                padding: const EdgeInsets.symmetric(vertical: 10),
                decoration: BoxDecoration(
                  color: isActive ? AppColors.primary : colors.card,
                  borderRadius: BorderRadius.circular(AppRadius.full),
                  boxShadow:
                      isActive ? AppShadows.primaryButton : AppShadows.card,
                ),
                child: Center(
                  child: Text(
                    tab,
                    style: AppTypography.labelMedium.copyWith(
                        color: isActive ? Colors.white : colors.onSurfaceMuted),
                  ),
                ),
              ),
            ),
          ),
        );
      }).toList(),
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
    final date = tx.createdAt != null
        ? tx.createdAt!.toIso8601String().substring(0, 10)
        : '';
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
                          tx.description ?? tx.purpose ?? 'Transaction',
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
                              style: AppTypography.labelSmall.copyWith(
                                  color: status == 'SUCCESS' ||
                                          status == 'APPROVED' ||
                                          status == 'COMPLETED'
                                      ? AppColors.success
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
                        '₹${amount.toInt()}',
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
                'TOTAL CHARGED',
                style: AppTypography.overline
                    .copyWith(color: colors.onSurfaceVariant),
              ),
              Text(
                '₹${tx.amount.toInt()}',
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
            '$prefix₹${amount.toInt()}',
            style: AppTypography.labelMedium.copyWith(color: color),
          ),
        ],
      ),
    );
  }
}
