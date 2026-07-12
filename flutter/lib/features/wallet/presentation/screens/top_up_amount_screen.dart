import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';

class TopUpAmountScreen extends ConsumerStatefulWidget {
  final Function(int)? onProceed;
  final VoidCallback? onBack;
  final Function(int)? onAmountChanged;
  final int? securityDeposit;
  final int? rentalPrice;

  const TopUpAmountScreen({
    super.key,
    this.onProceed,
    this.onBack,
    this.onAmountChanged,
    this.securityDeposit,
    this.rentalPrice,
  });

  @override
  ConsumerState<TopUpAmountScreen> createState() => _TopUpAmountScreenState();
}

class _TopUpAmountScreenState extends ConsumerState<TopUpAmountScreen>
    with SingleTickerProviderStateMixin {
  late int _selectedAmount;
  late final TextEditingController _customAmountCtrl;
  late final AnimationController _entryCtrl;

  late final List<int> _quickAmounts;

  @override
  void initState() {
    super.initState();
    // Prefill with plan's security deposit + rental price if provided
    final planTotal = (widget.securityDeposit ?? 0) + (widget.rentalPrice ?? 0);
    _selectedAmount = planTotal > 0 ? planTotal : 1000;
    _customAmountCtrl = TextEditingController(text: _selectedAmount.toString());

    // Generate quick amounts based on plan total if available
    if (planTotal > 0) {
      _quickAmounts = [
        planTotal,
        (planTotal * 1.5).round(),
        (planTotal * 2).round(),
        (planTotal * 3).round(),
      ];
    } else {
      _quickAmounts = [500, 1000, 2000, 5000];
    }

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
    HapticFeedback.lightImpact();
    setState(() {
      _selectedAmount = amount;
      _customAmountCtrl.text = amount.toString();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      extendBody: true, // For glass bottom nav
      body: Column(
        children: [
          _buildHeader(),
          Expanded(
            child: SingleChildScrollView(
              padding: const EdgeInsets.fromLTRB(
                  20, 32, 20, 140), // extra bottom padding for floating footer
              child: FadeTransition(
                opacity: _entryCtrl,
                child: Column(
                  children: [
                    // Large Amount Input Display
                    Container(
                      padding: const EdgeInsets.symmetric(
                          vertical: 32, horizontal: 16),
                      decoration: BoxDecoration(
                        color: Colors.white,
                        borderRadius: BorderRadius.circular(24),
                        boxShadow: AppShadows.glass,
                        border: Border.all(
                            color: Colors.white.withValues(alpha: 0.5)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text(
                              '₹',
                              style: GoogleFonts.inter(
                                fontSize: 32,
                                fontWeight: FontWeight.w700,
                                color: AppColors.slate500,
                              ),
                            ),
                          ),
                          const SizedBox(width: 8),
                          IntrinsicWidth(
                            child: ConstrainedBox(
                              constraints: const BoxConstraints(minWidth: 50),
                              child: TextFormField(
                                key: const Key('customAmountField'),
                                autofocus: true,
                                controller: _customAmountCtrl,
                                keyboardType: TextInputType.number,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                textAlign: TextAlign.center,
                                style: GoogleFonts.inter(
                                  fontSize: 56,
                                  fontWeight: FontWeight.w800,
                                  color: const Color(0xFF1E293B),
                                  letterSpacing: -2,
                                ),
                                decoration: const InputDecoration(
                                  border: InputBorder.none,
                                  enabledBorder: InputBorder.none,
                                  focusedBorder: InputBorder.none,
                                  errorBorder: InputBorder.none,
                                  focusedErrorBorder: InputBorder.none,
                                  disabledBorder: InputBorder.none,
                                  isDense: true,
                                  contentPadding: EdgeInsets.zero,
                                  filled: false, // Override theme
                                ),
                                onChanged: (val) {
                                  setState(() {
                                    _selectedAmount = int.tryParse(val) ?? 0;
                                  });
                                },
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 40),

                    // Grid of 4 chips
                    GridView.count(
                      crossAxisCount: 2,
                      crossAxisSpacing: 16,
                      mainAxisSpacing: 16,
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
                              gradient:
                                  isSelected ? AppGradients.primary : null,
                              color: isSelected ? null : Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              boxShadow: isSelected
                                  ? AppShadows.primaryButton
                                  : AppShadows.glass,
                              border: Border.all(
                                color: isSelected
                                    ? Colors.transparent
                                    : AppColors.outlineVariant
                                        .withValues(alpha: 0.5),
                                width: 1,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                '₹$amt',
                                style: GoogleFonts.inter(
                                  fontSize: 18,
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

                    const SizedBox(height: 32),

                    // Balance info row
                    Consumer(
                      builder: (context, ref, _) {
                        final currentBalance = ref
                                .watch(appProvider.select((p) => p.rider))
                                ?.walletBalance ??
                            0.0;
                        return Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Current Balance: ₹${currentBalance.toInt()}',
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                color: const Color(0xFF475569),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                            Text(
                              'Min: ₹100',
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                color: AppColors.slate500,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        );
                      },
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
      bottomNavigationBar: ClipRect(
        child: BackdropFilter(
          filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
          child: Container(
            padding: EdgeInsets.fromLTRB(
                20, 20, 20, MediaQuery.of(context).padding.bottom + 20),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.7),
              border: Border(
                top: BorderSide(
                  color: Colors.white.withValues(alpha: 0.2),
                  width: 1,
                ),
              ),
            ),
            child: _buildProceedButton(),
          ),
        ),
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
      decoration: BoxDecoration(
        gradient: AppGradients.primary,
        borderRadius: const BorderRadius.vertical(bottom: Radius.circular(40)),
        boxShadow: [
          BoxShadow(
            color: AppColors.primary.withValues(alpha: 0.3),
            blurRadius: 30,
            offset: const Offset(0, 10),
          ),
        ],
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
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.2),
              borderRadius: BorderRadius.circular(12),
            ),
            child: Text(
              'Step 1 of 2',
              style: GoogleFonts.inter(
                color: Colors.white,
                fontSize: 12,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.5,
              ),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Enter Amount',
            style: GoogleFonts.inter(
              color: Colors.white,
              fontSize: 32,
              fontWeight: FontWeight.w800,
              letterSpacing: -0.5,
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
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 60,
        decoration: BoxDecoration(
          gradient: _canProceed ? AppGradients.primary : null,
          color: _canProceed ? null : AppColors.outlineVariant,
          borderRadius: BorderRadius.circular(20),
          boxShadow: _canProceed
              ? [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 8),
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
                child: Text(
                  'PROCEED TO PAYMENT',
                  textAlign: TextAlign.center,
                  style: GoogleFonts.inter(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.5,
                    color: _canProceed ? Colors.white : AppColors.slate400,
                  ),
                ),
              ),
              if (_canProceed)
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.2),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.arrow_forward,
                    color: Colors.white,
                    size: 18,
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
