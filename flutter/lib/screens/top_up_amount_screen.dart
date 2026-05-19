import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// Matches web TopUpAmountScreen.tsx:
/// - Gradient header with back btn + "Step 2 of 3" + "Enter Amount"
/// - Quick select cards: ₹500, ₹1000, ₹2000 (Recommended), ₹5000
/// - Custom amount input with Indian Rupee symbol
/// - Amount summary box (green-50)
/// - Gradient "Proceed to UPI Payment" pill button

class TopUpAmountScreen extends StatefulWidget {
  final Function(int)? onProceed;
  final VoidCallback? onBack;
  final Function(int)? onAmountChanged;

  const TopUpAmountScreen({
    super.key,
    this.onProceed,
    this.onBack,
    this.onAmountChanged,
  });

  @override
  State<TopUpAmountScreen> createState() => _TopUpAmountScreenState();
}

class _TopUpAmountScreenState extends State<TopUpAmountScreen>
    with SingleTickerProviderStateMixin {
  int? _selectedAmount = 2000;
  final _customAmountCtrl = TextEditingController();
  bool _isCustom = false;
  late final AnimationController _entryCtrl;

  final List<Map<String, dynamic>> _quickAmounts = [
    {'value': 500, 'label': '₹500'},
    {'value': 1000, 'label': '₹1,000'},
    {'value': 2000, 'label': '₹2,000', 'recommended': true},
    {'value': 5000, 'label': '₹5,000'},
  ];

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
  }

  @override
  void dispose() {
    _customAmountCtrl.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  int get _finalAmount => _isCustom
      ? int.tryParse(_customAmountCtrl.text) ?? 0
      : _selectedAmount ?? 0;

  bool get _canProceed => _finalAmount > 0;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          // Gradient header
          _buildHeader(),

          // Scrollable content
          Expanded(
            child: Transform.translate(
              offset: const Offset(0, -16),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
                child: Column(
                  children: [
                    // Quick select cards
                    _buildQuickSelectSection(),

                    const SizedBox(height: 16),

                    // Custom amount input
                    _buildCustomAmountSection(),

                    const SizedBox(height: 16),

                    // Amount summary
                    if (_finalAmount > 0) _buildSummary(),

                    const SizedBox(height: 24),

                    // Proceed button
                    _buildProceedButton(),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      padding: EdgeInsets.fromLTRB(
          20, MediaQuery.of(context).padding.top + 12, 20, 40),
      decoration: const BoxDecoration(
        gradient: LinearGradient(
          colors: [Color(0xFF0053C1), Color(0xFF2F6DDE)],
          begin: Alignment.centerLeft,
          end: Alignment.centerRight,
        ),
      ),
      child: Stack(
        children: [
          Positioned(
            top: 0,
            left: 0,
            child: GestureDetector(
              key: const Key('backButton'),
              onTap: widget.onBack ?? () => Navigator.maybePop(context),
              child: Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: Colors.white.withOpacity(0.15),
                  shape: BoxShape.circle,
                ),
                child: const Icon(
                  Icons.arrow_back,
                  color: Colors.white,
                  size: 20,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(left: 48, top: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Step 2 of 3',
                  style: GoogleFonts.inter(
                    color: Colors.white70,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Enter Amount',
                  style: GoogleFonts.inter(
                    color: Colors.white,
                    fontSize: 21,
                    fontWeight: FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildQuickSelectSection() {
    final anim = CurvedAnimation(
      parent: _entryCtrl,
      curve: const Interval(0.2, 0.7, curve: Curves.easeOutCubic),
    );

    return FadeTransition(
      opacity: anim,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.2), end: Offset.zero)
            .animate(anim),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            boxShadow: AppShadows.card,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const Icon(Icons.account_balance_wallet_outlined,
                      size: 16, color: AppColors.onSurfaceVariant),
                  const SizedBox(width: 8),
                  Text(
                    'Quick Select',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: AppColors.onSurfaceAlt,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),
              GridView.count(
                crossAxisCount: 2,
                crossAxisSpacing: 12,
                mainAxisSpacing: 12,
                shrinkWrap: true,
                childAspectRatio: 1.6,
                physics: const NeverScrollableScrollPhysics(),
                children: _quickAmounts.map((item) {
                  final isSelected =
                      _selectedAmount == item['value'] && !_isCustom;
                  return _buildQuickAmountItem(item, isSelected);
                }).toList(),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildQuickAmountItem(Map<String, dynamic> item, bool isSelected) {
    return GestureDetector(
      key: Key('amount${item['value']}'),
      onTap: () {
        setState(() {
          _selectedAmount = item['value'];
          _isCustom = false;
          _customAmountCtrl.clear();
        });
        widget.onAmountChanged?.call(item['value']);
      },
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        decoration: BoxDecoration(
          color: isSelected ? const Color(0xFFEFF6FF) : AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(
            color: isSelected ? AppColors.primary : AppColors.divider,
            width: 2,
          ),
        ),
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            if (item['recommended'] == true)
              Positioned(
                top: -10,
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 2),
                  decoration: BoxDecoration(
                    gradient: AppGradients.primary,
                    borderRadius: BorderRadius.circular(999),
                  ),
                  child: Text(
                    'Recommended',
                    style: GoogleFonts.inter(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                ),
              ),
            Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(
                  item['label'],
                  style: GoogleFonts.inter(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color:
                        isSelected ? AppColors.primary : AppColors.onSurfaceAlt,
                  ),
                ),
                if (isSelected) ...[
                  const SizedBox(height: 4),
                  Container(
                    width: 20,
                    height: 20,
                    decoration: const BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                    ),
                    child:
                        const Icon(Icons.star, color: Colors.white, size: 12),
                  ),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildCustomAmountSection() {
    final anim = CurvedAnimation(
      parent: _entryCtrl,
      curve: const Interval(0.3, 0.8, curve: Curves.easeOutCubic),
    );

    return FadeTransition(
      opacity: anim,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.2), end: Offset.zero)
            .animate(anim),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            boxShadow: AppShadows.card,
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Or Enter Custom Amount',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w600,
                  color: AppColors.onSurfaceAlt,
                ),
              ),
              const SizedBox(height: 12),
              TextField(
                key: const Key('customAmountField'),
                controller: _customAmountCtrl,
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                onChanged: (val) {
                  setState(() {
                    _isCustom = val.isNotEmpty;
                    if (_isCustom) _selectedAmount = null;
                  });
                  widget.onAmountChanged?.call(int.tryParse(val) ?? 0);
                },
                style: GoogleFonts.inter(
                  fontSize: 18,
                  fontWeight: FontWeight.w700,
                  color: AppColors.onSurfaceAlt,
                ),
                decoration: InputDecoration(
                  hintText: 'Enter amount',
                  prefixIcon: Container(
                    padding: const EdgeInsets.only(left: 16, right: 8),
                    child: const Icon(Icons.currency_rupee,
                        size: 18, color: AppColors.onSurfaceVariant),
                  ),
                  prefixIconConstraints: const BoxConstraints(minWidth: 0),
                  filled: true,
                  fillColor: AppColors.surface,
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    borderSide:
                        const BorderSide(color: AppColors.divider, width: 2),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    borderSide:
                        const BorderSide(color: AppColors.divider, width: 2),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(AppRadius.md),
                    borderSide:
                        const BorderSide(color: AppColors.primary, width: 2),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSummary() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
      decoration: BoxDecoration(
        color: const Color(0xFFF0FDF4),
        borderRadius: BorderRadius.circular(AppRadius.lg),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            'Amount to Pay',
            style: GoogleFonts.inter(
                fontSize: 14, color: AppColors.onSurfaceVariant),
          ),
          Text(
            '₹${_finalAmount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
            style: GoogleFonts.inter(
              fontSize: 20,
              fontWeight: FontWeight.w800,
              color: const Color(0xFF16A34A),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProceedButton() {
    return GestureDetector(
      key: const Key('proceedToUpiButton'),
      onTap: _canProceed ? () => widget.onProceed?.call(_finalAmount) : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 56,
        decoration: BoxDecoration(
          gradient: _canProceed ? AppGradients.primary : null,
          color: _canProceed ? null : AppColors.divider,
          borderRadius: BorderRadius.circular(999),
          boxShadow: _canProceed ? AppShadows.primaryButton : null,
        ),
        child: Center(
          child: Text(
            'Proceed to UPI Payment',
            style: GoogleFonts.inter(
              fontSize: 15,
              fontWeight: FontWeight.w700,
              color: _canProceed ? Colors.white : AppColors.onSurfaceVariant,
            ),
          ),
        ),
      ),
    );
  }
}
