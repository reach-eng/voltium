import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import '../../../../theme/app_theme.dart';

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
  int _selectedAmount = 1000;
  final _customAmountCtrl = TextEditingController(text: '1000');
  late final AnimationController _entryCtrl;

  final List<int> _quickAmounts = [500, 1000, 2000, 5000];

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();

    _customAmountCtrl.addListener(() {
      final text = _customAmountCtrl.text;
      if (text.isNotEmpty) {
        final val = int.tryParse(text) ?? 0;
        widget.onAmountChanged?.call(val);
      }
    });
  }

  @override
  void dispose() {
    _customAmountCtrl.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  int get _finalAmount => int.tryParse(_customAmountCtrl.text) ?? 0;

  bool get _canProceed => _finalAmount >= 100;

  void _selectQuickAmount(int amount) {
    setState(() {
      _selectedAmount = amount;
      _customAmountCtrl.text = amount.toString();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 32),
              child: FadeTransition(
                opacity: _entryCtrl,
                child: Column(
                  children: [
                    Text('Enter Amount',
                      style: GoogleFonts.inter(
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text('How much would you like to add?',
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        color: AppColors.slate500,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Large Amount Input Display
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      crossAxisAlignment: CrossAxisAlignment.center,
                      children: [
                        Padding(
                          padding: const EdgeInsets.only(bottom: 6),
                          child: Text(
                            '₹',
                            style: GoogleFonts.inter(
                              fontSize: 28,
                              fontWeight: FontWeight.w700,
                              color: AppColors.slate500,
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        IntrinsicWidth(
                          child: TextFormField(
                            key: const Key('customAmountField'),
                            controller: _customAmountCtrl,
                            keyboardType: TextInputType.number,
                            inputFormatters: [
                              FilteringTextInputFormatter.digitsOnly,
                            ],
                            textAlign: TextAlign.center,
                            style: GoogleFonts.inter(
                              fontSize: 48,
                              fontWeight: FontWeight.w800,
                              color: const Color(0xFF1E293B),
                              letterSpacing: -1,
                            ),
                            decoration: const InputDecoration(
                              border: InputBorder.none,
                              isDense: true,
                              contentPadding: EdgeInsets.zero,
                            ),
                            onChanged: (val) {
                              setState(() {
                                _selectedAmount = int.tryParse(val) ?? 0;
                              });
                            },
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 40),

                    // Grid of 4 chips
                    GridView.count(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      shrinkWrap: true,
                      childAspectRatio: 2.2,
                      physics: const NeverScrollableScrollPhysics(),
                      children: _quickAmounts.map((amt) {
                        final isSelected = _selectedAmount == amt;
                        return GestureDetector(
                          onTap: () => _selectQuickAmount(amt),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 200),
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? AppColors.primaryGradientEnd
                                  : Colors.white,
                              borderRadius: BorderRadius.circular(12),
                              border: Border.all(
                                color: isSelected
                                    ? AppColors.primaryGradientEnd
                                    : AppColors.outlineVariant,
                                width: 1,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                '₹$amt',
                                style: GoogleFonts.inter(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: isSelected
                                      ? Colors.white
                                      : const Color(0xFF475569),
                                ),
                              ),
                            ),
                          ),
                        );
                      }).toList(),
                    ),

                    const SizedBox(height: 24),

                    // Balance info row
                    Consumer<AppProvider>(builder: (context, provider, _) {
                      final currentBalance =
                          provider.rider?.walletBalance ?? 0.0;
                      return Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'Current Balance: ₹${currentBalance.toInt()}',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: const Color(0xFF475569),
                            ),
                          ),
                          Text(
                            'Min: ₹100',
                            style: GoogleFonts.inter(
                              fontSize: 13,
                              color: AppColors.slate500,
                            ),
                          ),
                        ],
                      );
                    },),
                  ],
                ),
              ),
            ),
          ),

          // Bottom button
          Padding(
            padding: const EdgeInsets.all(20),
            child: _buildProceedButton(),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader() {
    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        20,
        MediaQuery.of(context).padding.top + 16,
        20,
        48,
      ),
      decoration: const BoxDecoration(
        color: AppColors.primary,
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(36)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              // Back button
              GestureDetector(
                key: const Key('backButton'),
                onTap: widget.onBack ?? () => Navigator.maybePop(context),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.chevron_left_rounded,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
              ),
              const SizedBox(width: 32),
            ],
          ),
          const SizedBox(height: 24),
          Text('Step 2 of 3',
            style: GoogleFonts.inter(
              color: Colors.white.withValues(alpha: 0.7),
              fontSize: 14,
              fontWeight: FontWeight.w500,
            ),
          ),
          const SizedBox(height: 4),
          Text('Enter Amount',
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 28,
              fontWeight: FontWeight.w700,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildProceedButton() {
    return GestureDetector(
      key: const Key('proceedToPaymentButton'),
      onTap: _canProceed ? () => widget.onProceed?.call(_finalAmount) : null,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 56,
        decoration: BoxDecoration(
          color:
              _canProceed ? AppColors.primaryGradientEnd : AppColors.outlineVariant,
          borderRadius: BorderRadius.circular(16),
          boxShadow: _canProceed
              ? [
                  BoxShadow(
                    color: AppColors.primaryGradientEnd.withValues(alpha: 0.3),
                    blurRadius: 12,
                    offset: const Offset(0, 4),
                  ),
                ]
              : null,
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Expanded(
                child: Text('PROCEED TO PAYMENT',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    color: _canProceed ? Colors.white : AppColors.slate400,
                  ),
                ),
              ),
              if (_canProceed)
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.arrow_forward,
                    color: Colors.white,
                    size: 16,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
