import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class TopUpAmountScreen extends ConsumerStatefulWidget {
  final Function(int)? onProceed;
  final VoidCallback? onBack;
  final Function(int)? onAmountChanged;
  final int? securityDeposit;
  final int? rentalPrice;
  final int? initialAmount;

  const TopUpAmountScreen({
    super.key,
    this.onProceed,
    this.onBack,
    this.onAmountChanged,
    this.securityDeposit,
    this.rentalPrice,
    this.initialAmount,
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
    final isAdvanceRentPaid =
        ref.read(riderProvider).rider?.advanceRentPaid ?? false;
    final secDeposit = widget.securityDeposit ?? 0;
    final rentPrice = widget.rentalPrice ?? 0;

    // Auto-fill required top-up amount:
    // If Advance Rent was ticked during plan selection -> Security Deposit + Advance Rent Price
    // Otherwise -> Security Deposit only
    final planTotal = isAdvanceRentPaid
        ? (secDeposit + rentPrice)
        : (secDeposit > 0 ? secDeposit : (rentPrice > 0 ? rentPrice : 0));

    final initial = widget.initialAmount;
    if (initial != null && initial > 0) {
      _selectedAmount = initial;
    } else {
      _selectedAmount = planTotal > 0 ? planTotal : 1000;
    }
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

  int get _requiredMinAmount {
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final isAdvanceRentPaid = rider?.advanceRentPaid ?? false;
    final secDeposit =
        (widget.securityDeposit != null && widget.securityDeposit! > 0)
            ? widget.securityDeposit!
            : (rider?.activeRentalPlanSecurityDeposit.toInt() ?? 0);
    final rentPrice = (widget.rentalPrice != null && widget.rentalPrice! > 0)
        ? widget.rentalPrice!
        : (rider?.activeRentalPlanPrice.toInt() ?? 0);

    final planTotal = isAdvanceRentPaid
        ? (secDeposit + rentPrice)
        : (secDeposit > 0 ? secDeposit : rentPrice);

    final minTopup =
        ref.watch(walletProvider.select((p) => p.walletMinTopup)).toInt();
    return planTotal > 0 ? planTotal : (minTopup > 0 ? minTopup : 100);
  }

  bool get _canProceed {
    return _finalAmount >= _requiredMinAmount;
  }

  void _selectQuickAmount(int amount) {
    HapticFeedback.lightImpact();
    FocusScope.of(context).unfocus();
    setState(() {
      _selectedAmount = amount;
      _customAmountCtrl.text = amount.toString();
    });
  }

  Widget _buildTopUpBreakdownCard() {
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    final isAdvanceRentPaid = rider?.advanceRentPaid ?? false;
    final secDeposit =
        (widget.securityDeposit != null && widget.securityDeposit! > 0)
            ? widget.securityDeposit!
            : (rider?.activeRentalPlanSecurityDeposit.toInt() ?? 0);
    final rentPrice = (widget.rentalPrice != null && widget.rentalPrice! > 0)
        ? widget.rentalPrice!
        : (rider?.activeRentalPlanPrice.toInt() ?? 0);

    if (secDeposit <= 0 && rentPrice <= 0) return const SizedBox.shrink();

    final totalRequired = isAdvanceRentPaid
        ? (secDeposit + rentPrice)
        : (secDeposit > 0 ? secDeposit : rentPrice);

    final colors = AppColors.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 24),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: AppColors.primary.withValues(alpha: 0.05),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: AppColors.primary.withValues(alpha: 0.2),
          width: 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.account_balance_wallet_outlined,
                  color: AppColors.primary, size: 20),
              const SizedBox(width: 8),
              Text(
                'Required Deposit Breakdown',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.bold,
                  color: colors.onSurface,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          if (secDeposit > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // T-66: hardcoded English fee-row label.
                  // Localised via the existing
                  // `wallet_securityDeposit` ARB key.
                  Text(AppLocalizations.of(context)!.wallet_securityDeposit,
                      style: TextStyle(
                          fontSize: 13, color: colors.onSurfaceMuted)),
                  Text('₹$secDeposit',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: colors.onSurface)),
                ],
              ),
            ),
          if (isAdvanceRentPaid && rentPrice > 0)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  // T-66: hardcoded English fee-row label.
                  // Localised via the new
                  // `txtadvanceRentalPlanFee` ARB key.
                  Text(AppLocalizations.of(context)!.txtadvanceRentalPlanFee,
                      style: TextStyle(
                          fontSize: 13, color: colors.onSurfaceMuted)),
                  Text('₹$rentPrice',
                      style: TextStyle(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: colors.onSurface)),
                ],
              ),
            ),
          const Divider(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text(
                'Minimum Required Top-Up',
                style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                    color: AppColors.primary),
              ),
              Text(
                '₹$totalRequired',
                style: const TextStyle(
                    fontSize: 16,
                    fontWeight: FontWeight.w800,
                    color: AppColors.primary),
              ),
            ],
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
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
                        color: colors.card,
                        borderRadius:
                            BorderRadius.circular(AppRadius.radiusModal),
                        boxShadow: AppShadows.glass,
                        border: Border.all(
                            color:
                                colors.outlineVariant.withValues(alpha: 0.5)),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Padding(
                            padding: const EdgeInsets.only(bottom: 6),
                            child: Text(
                              '₹',
                              style: GoogleFonts.plusJakartaSans(
                                fontSize: 32,
                                fontWeight: FontWeight.w700,
                                color: colors.onSurfaceVariant,
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
                                style: GoogleFonts.plusJakartaSans(
                                  fontSize: 56,
                                  fontWeight: FontWeight.w800,
                                  color: colors.onSurface,
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

                    const SizedBox(height: 24),
                    _buildTopUpBreakdownCard(),
                    const SizedBox(height: 16),

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
                              color: isSelected ? null : colors.card,
                              borderRadius: BorderRadius.circular(AppRadius.lg),
                              boxShadow: isSelected
                                  ? AppShadows.primaryButton
                                  : AppShadows.glass,
                              border: Border.all(
                                color: isSelected
                                    ? Colors.transparent
                                    : colors.outlineVariant
                                        .withValues(alpha: 0.5),
                                width: 1,
                              ),
                            ),
                            child: Center(
                              child: Text(
                                '₹$amt',
                                style: AppTypography.titleMedium.copyWith(
                                    color: isSelected
                                        ? Colors.white
                                        : colors.onSurfaceMuted),
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
                                .watch(riderProvider.select((p) => p.rider))
                                ?.walletBalance ??
                            0.0;
                        return Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Current Balance: ₹${currentBalance.toInt()}',
                              style: AppTypography.bodyMedium
                                  .copyWith(color: colors.onSurfaceMuted),
                            ),
                            Text(
                              'Min Required: ₹$_requiredMinAmount',
                              style: AppTypography.bodyMedium
                                  .copyWith(fontWeight: FontWeight.w600)
                                  .copyWith(color: AppColors.primary),
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
              color: colors.card.withValues(alpha: 0.8),
              border: Border(
                top: BorderSide(
                  color: colors.outlineVariant.withValues(alpha: 0.3),
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
              borderRadius: BorderRadius.circular(AppRadius.md),
            ),
            child: Text(
              'Step 1 of 2',
              style: AppTypography.labelMedium
                  .copyWith(color: Colors.white, letterSpacing: 0.5),
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Enter Amount',
            style: AppTypography.displayMedium
                .copyWith(color: Colors.white, letterSpacing: -0.5),
          ),
        ],
      ),
    );
  }

  Widget _buildProceedButton() {
    final colors = AppColors.of(context);
    return GestureDetector(
      key: const Key('proceedToPaymentButton'),
      onTap: _canProceed
          ? () {
              // PR #6: medium haptic on this high-stakes money action.
              HapticService.medium();
              widget.onProceed?.call(_finalAmount);
            }
          : null,
      behavior: HitTestBehavior.opaque,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 200),
        height: 60,
        decoration: BoxDecoration(
          gradient: _canProceed ? AppGradients.primary : null,
          color: _canProceed ? null : colors.outlineVariant,
          borderRadius: BorderRadius.circular(AppRadius.lg),
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
                  // PR-D: was hardcoded 'PROCEED TO PAYMENT' (all-caps).
                  // Now routes through `txttopupProceedToPayment` ARB key
                  // so Hindi renders as "भुगतान करें" and EN as "Proceed to payment".
                  AppLocalizations.of(context)?.txttopupProceedToPayment ??
                      'Proceed to payment',
                  textAlign: TextAlign.center,
                  style: AppTypography.labelLarge
                      .copyWith(fontWeight: FontWeight.w700)
                      .copyWith(
                          letterSpacing: 0.5,
                          color: _canProceed
                              ? Colors.white
                              : colors.onSurfaceMuted),
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
