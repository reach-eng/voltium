import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../widgets/animated_bottom_nav.dart';

/// Matches web HistoryScreen.tsx:
/// - Header with back button and refresh
/// - Summary cards row (Credits, Debits, Net)
/// - Search bar with icon
/// - Filter tabs (All, Credits, Debits)
/// - Info hint (blue-50)
/// - Transaction list with expandable cards
/// - Each card shows: icon, title, date, status (color-coded), amount (color-coded)
/// - Expanded state shows breakdown items (Charge, Tax, Discount, Penalty)

class HistoryScreen extends StatefulWidget {
  final String riderId;
  final VoidCallback? onBack;

  const HistoryScreen({
    super.key,
    required this.riderId,
    this.onBack,
  });

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen>
    with SingleTickerProviderStateMixin {
  String _activeFilter = 'All';
  String _searchQuery = '';
  String? _expandedId;
  List<dynamic> _transactions = [];
  bool _isLoading = true;
  late final AnimationController _entryCtrl;

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
    _fetchTransactions();
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    super.dispose();
  }

  Future<void> _fetchTransactions() async {
    setState(() => _isLoading = true);
    try {
      final res = await ApiService().fetchTransactionHistory(riderId: widget.riderId);
      if (mounted) {
        setState(() {
          _transactions = res['data'] ?? [];
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
      }
    }
  }

  List<dynamic> get _filteredTx {
    return _transactions.where((tx) {
      final type = (tx['type'] as String).toUpperCase();
      final isCredit = type == 'CREDIT' || type == 'TOP_UP';
      final matchesFilter = _activeFilter == 'All' ||
          (_activeFilter == 'Credits' && isCredit) ||
          (_activeFilter == 'Debits' && !isCredit);
      final description = (tx['description'] ?? '').toString().toLowerCase();
      final matchesSearch = _searchQuery.isEmpty || description.contains(_searchQuery.toLowerCase());
      return matchesFilter && matchesSearch;
    }).toList();
  }

  double get _totalCredits => _transactions
      .where((t) => (t['type'] == 'CREDIT' || t['type'] == 'TOP_UP') && (t['status'] == 'APPROVED' || t['status'] == 'SUCCESS'))
      .fold(0.0, (sum, t) => sum + (t['amount'] as num).toDouble());

  double get _totalDebits => _transactions
      .where((t) => (t['type'] == 'DEBIT') && (t['status'] == 'APPROVED' || t['status'] == 'SUCCESS'))
      .fold(0.0, (sum, t) => sum + (t['amount'] as num).toDouble());

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: _isLoading ? _buildLoading() : _buildContent(),
            ),
          ],
        ),
      ),
      bottomNavigationBar: AppBottomNav(
        currentIndex: 1,
        onTap: (i) {
          // Navigation handled by parent
        },
      ),
    );
  }

  Widget _buildHeader() {
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
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: AppShadows.glass,
              ),
              child: const Icon(Icons.arrow_back,
                  size: 18, color: AppColors.onSurface),
            ),
          ),
          const SizedBox(width: 16),
          Text(
            'Transaction History',
            style: GoogleFonts.inter(
              fontSize: 21,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurface,
            ),
          ),
          const Spacer(),
          GestureDetector(
            onTap: _fetchTransactions,
            child: Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: AppShadows.glass,
              ),
              child: const Icon(Icons.refresh,
                  size: 16, color: AppColors.onSurfaceVariant),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLoading() {
    return const Center(
      child: CircularProgressIndicator(color: AppColors.primary),
    );
  }

  Widget _buildContent() {
    return SingleChildScrollView(
      padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
      child: Column(
        children: [
          _buildSummaryCards(),
          const SizedBox(height: 16),
          _buildSearchBar(),
          const SizedBox(height: 16),
          _buildFilterTabs(),
          const SizedBox(height: 16),
          _buildInfoHint(),
          const SizedBox(height: 16),
          _buildTransactionList(),
        ],
      ),
    );
  }

  Widget _buildSummaryCards() {
    return Row(
      children: [
        _buildSummaryItem('Credits', '+₹${_totalCredits.toInt()}', const Color(0xFF16A34A)),
        const SizedBox(width: 8),
        _buildSummaryItem('Debits', '-₹${_totalDebits.toInt()}', const Color(0xFFEF4444)),
        const SizedBox(width: 8),
        _buildSummaryItem('Net', '₹${(_totalCredits - _totalDebits).toInt()}', 
            (_totalCredits - _totalDebits) >= 0 ? const Color(0xFF16A34A) : const Color(0xFFEF4444)),
      ],
    );
  }

  Widget _buildSummaryItem(String label, String value, Color color) {
    return Expanded(
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 12),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.md),
          boxShadow: AppShadows.card,
        ),
        child: Column(
          children: [
            Text(
              label.toUpperCase(),
              style: GoogleFonts.inter(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: AppColors.onSurfaceVariant,
                letterSpacing: 1.0,
              ),
            ),
            const SizedBox(height: 4),
            Text(
              value,
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: color,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSearchBar() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.md),
        boxShadow: AppShadows.card,
      ),
      child: TextField(
        onChanged: (val) => setState(() => _searchQuery = val),
        style: GoogleFonts.inter(fontSize: 14),
        decoration: InputDecoration(
          hintText: 'Search transactions...',
          prefixIcon: const Icon(Icons.search, size: 18, color: AppColors.outline),
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
                  color: isActive ? AppColors.primary : Colors.white,
                  borderRadius: BorderRadius.circular(999),
                  boxShadow: isActive ? AppShadows.primaryButton : AppShadows.card,
                ),
                child: Center(
                  child: Text(
                    tab,
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      fontWeight: FontWeight.w700,
                      color: isActive ? Colors.white : AppColors.onSurfaceVariant,
                    ),
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
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFEFF6FF),
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: const Color(0xFFDBEAFE)),
      ),
      child: Row(
        children: [
          const Icon(Icons.receipt_long_outlined, size: 14, color: Color(0xFF3B82F6)),
          const SizedBox(width: 8),
          Text(
            'Tap any transaction to see the full fee breakdown',
            style: GoogleFonts.inter(
              fontSize: 11,
              color: const Color(0xFF1D4ED8),
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTransactionList() {
    if (_filteredTx.isEmpty) {
      return Padding(
        padding: const EdgeInsets.only(top: 40),
        child: Column(
          children: [
            const Icon(Icons.filter_list_off, size: 48, color: AppColors.outline),
            const SizedBox(height: 12),
            Text(
              'No transactions found',
              style: GoogleFonts.inter(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: AppColors.onSurfaceAlt,
              ),
            ),
          ],
        ),
      );
    }

    return ListView.separated(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _filteredTx.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final tx = _filteredTx[index];
        final id = tx['id'] as String;
        final isExpanded = _expandedId == id;
        return _buildTransactionCard(tx, isExpanded);
      },
    );
  }

  Widget _buildTransactionCard(dynamic tx, bool isExpanded) {
    final type = (tx['type'] as String).toUpperCase();
    final isCredit = type == 'CREDIT' || type == 'TOP_UP';
    final amount = (tx['amount'] as num).toDouble();
    final status = (tx['status'] as String).toUpperCase();
    final date = tx['createdAt'] != null ? tx['createdAt'].toString().substring(0, 10) : '';

    return Container(
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.md),
        boxShadow: AppShadows.card,
        border: isExpanded ? Border.all(color: AppColors.primary.withOpacity(0.2), width: 2) : null,
      ),
      child: Column(
        children: [
          GestureDetector(
            onTap: () => setState(() => _expandedId = isExpanded ? null : tx['id']),
            behavior: HitTestBehavior.opaque,
            child: Padding(
              padding: const EdgeInsets.all(16),
              child: Row(
                children: [
                  Container(
                    width: 40,
                    height: 40,
                    decoration: BoxDecoration(
                      color: isCredit ? const Color(0xFFF0FDF4) : const Color(0xFFFEF2F2),
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                    child: Icon(
                      isCredit ? Icons.trending_up : Icons.trending_down,
                      size: 18,
                      color: isCredit ? const Color(0xFF16A34A) : const Color(0xFFEF4444),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          tx['description'] ?? tx['purpose'] ?? 'Transaction',
                          style: GoogleFonts.inter(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: AppColors.onSurfaceAlt,
                          ),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                        ),
                        const SizedBox(height: 2),
                        Row(
                          children: [
                            Text(date, style: GoogleFonts.inter(fontSize: 11, color: AppColors.onSurfaceVariant)),
                            const SizedBox(width: 8),
                            Text('|', style: GoogleFonts.inter(fontSize: 11, color: AppColors.outline)),
                            const SizedBox(width: 8),
                            Text(status, style: GoogleFonts.inter(
                              fontSize: 11, 
                              fontWeight: FontWeight.w700,
                              color: status == 'SUCCESS' || status == 'APPROVED' ? const Color(0xFF16A34A) : const Color(0xFFD97706),
                            )),
                          ],
                        ),
                      ],
                    ),
                  ),
                  Row(
                    children: [
                      Icon(
                        isCredit ? Icons.add_circle_outline : Icons.remove_circle_outline,
                        size: 14,
                        color: isCredit ? const Color(0xFF16A34A) : const Color(0xFFBA1A1A),
                      ),
                      const SizedBox(width: 4),
                      Text(
                        '₹${amount.toInt()}',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: isCredit ? const Color(0xFF16A34A) : const Color(0xFFBA1A1A),
                        ),
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

  Widget _buildBreakdown(dynamic tx) {
    final breakdowns = tx['breakdowns'] as List<dynamic>? ?? [];
    return Container(
      width: double.infinity,
      decoration: const BoxDecoration(
        color: Color(0xFFF9FAFB),
        border: Border(top: BorderSide(color: Color(0xFFF3F4F6))),
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (tx['description'] != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: Text(
                tx['description'],
                style: GoogleFonts.inter(fontSize: 12, color: AppColors.onSurfaceVariant, fontStyle: FontStyle.italic),
              ),
            ),
          ...breakdowns.map((b) => _buildBreakdownItem(b)),
          const Divider(height: 24),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('TOTAL CHARGED', style: GoogleFonts.inter(
                fontSize: 10, fontWeight: FontWeight.w800, color: AppColors.onSurfaceVariant)),
              Text('₹${(tx['amount'] as num).toInt()}', style: GoogleFonts.inter(
                fontSize: 14, fontWeight: FontWeight.w800, color: AppColors.onSurfaceAlt)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildBreakdownItem(dynamic b) {
    final type = b['type'] as String;
    final label = b['label'] as String;
    final amount = (b['amount'] as num).toDouble();
    
    Color color = AppColors.onSurfaceAlt;
    Color bg = const Color(0xFFF3F4F6);
    String prefix = '';
    
    if (type == 'TAX') { color = const Color(0xFFC2410C); bg = const Color(0xFFFFF7ED); }
    if (type == 'DISCOUNT') { color = const Color(0xFF15803D); bg = const Color(0xFFF0FDF4); prefix = '-'; }
    if (type == 'PENALTY') { color = const Color(0xFFB91C1C); bg = const Color(0xFFFEF2F2); }
    if (type == 'ADJUSTMENT') { color = const Color(0xFF1D4ED8); bg = const Color(0xFFEFF6FF); }

    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                decoration: BoxDecoration(color: bg, borderRadius: BorderRadius.circular(4)),
                child: Text(type, style: GoogleFonts.inter(fontSize: 9, fontWeight: FontWeight.w800, color: color)),
              ),
              const SizedBox(width: 8),
              Text(label, style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w500, color: AppColors.onSurfaceAlt)),
            ],
          ),
          Text(
            '$prefix₹${amount.toInt()}',
            style: GoogleFonts.inter(fontSize: 12, fontWeight: FontWeight.w700, color: color),
          ),
        ],
      ),
    );
  }
}
