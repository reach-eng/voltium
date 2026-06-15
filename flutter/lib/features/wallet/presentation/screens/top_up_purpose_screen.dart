import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';

enum TopUpPurpose { topUp, securityDeposit }

class TopUpPurposeScreen extends StatefulWidget {
  final Function(TopUpPurpose)? onContinue;
  final VoidCallback? onBack;
  final Function(TopUpPurpose)? onPurposeSelected;

  const TopUpPurposeScreen({
    super.key,
    this.onContinue,
    this.onBack,
    this.onPurposeSelected,
  });

  @override
  State<TopUpPurposeScreen> createState() => _TopUpPurposeScreenState();
}

class _TopUpPurposeScreenState extends State<TopUpPurposeScreen>
    with SingleTickerProviderStateMixin {
  TopUpPurpose _selected = TopUpPurpose.topUp;
  late final AnimationController _entryCtrl;

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
    _entryCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      body: Column(
        children: [
          // Header (Full Width)
          _buildHeader(),

          // Cards & Info
          Expanded(
            child: SingleChildScrollView(
              physics: const BouncingScrollPhysics(),
              padding: const EdgeInsets.symmetric(horizontal: 20),
              child: Transform.translate(
                offset: const Offset(0, -32),
                child: Column(
                  children: [
                    _buildCard(
                      index: 0,
                      title: 'Wallet Top-up',
                      description: 'Add funds to your wallet for rentals',
                      icon: Icons.account_balance_wallet_outlined,
                      isSelected: _selected == TopUpPurpose.topUp,
                      onTap: () {
                        setState(() => _selected = TopUpPurpose.topUp);
                        widget.onPurposeSelected?.call(TopUpPurpose.topUp);
                      },
                      key: const Key('walletTopUpPurposeCard'),
                    ),
                    const SizedBox(height: 16),
                    _buildCard(
                      index: 1,
                      title: 'Security Deposit',
                      description: 'Refundable as per lease terms',
                      icon: Icons.lock_outline_rounded,
                      isSelected: _selected == TopUpPurpose.securityDeposit,
                      onTap: () {
                        setState(() => _selected = TopUpPurpose.securityDeposit);
                        widget.onPurposeSelected?.call(TopUpPurpose.securityDeposit);
                      },
                      badge: '₹2,000',
                      key: const Key('securityDepositPurposeCard'),
                    ),
                    const SizedBox(height: 24),
                    _buildInfoBox(),
                    const SizedBox(height: 32),
                  ],
                ),
              ),
            ),
          ),

          // Continue Button at bottom
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 0, 20, 24),
            child: _buildContinueButton(),
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
        color: Color(0xFF0053C1),
        borderRadius: BorderRadius.vertical(bottom: Radius.circular(36)),
      ),
      child: Stack(
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              // Back button
              GestureDetector(
                key: const Key('backButton'),
                onTap: widget.onBack ?? () => Navigator.maybePop(context),
                child: Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: Colors.white.withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.chevron_left_rounded,
                    color: Colors.white,
                    size: 28,
                  ),
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Text(
                      'Step 1 of 3',
                      style: GoogleFonts.inter(
                        color: Colors.white.withOpacity(0.7),
                        fontSize: 14,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      'Select Purpose',
                      style: GoogleFonts.inter(
                        color: Colors.white,
                        fontSize: 24,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          Positioned(
            top: 10,
            right: 0,
            child: GestureDetector(
              onTap: () {
                // Info action
              },
              child: const Icon(
                Icons.info_outline_rounded,
                color: Colors.white,
                size: 20,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCard({
    required int index,
    required String title,
    required String description,
    required IconData icon,
    required bool isSelected,
    required VoidCallback onTap,
    String? badge,
    Key? key,
  }) {
    final delay = 0.1 + index * 0.05;
    final anim = CurvedAnimation(
      parent: _entryCtrl,
      curve: Interval(delay, (delay + 0.35).clamp(0.0, 1.0),
          curve: Curves.easeOutCubic),
    );

    return FadeTransition(
      opacity: anim,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.2), end: Offset.zero)
            .animate(anim),
        child: GestureDetector(
          key: key,
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.all(20),
            decoration: BoxDecoration(
              color: isSelected ? const Color(0xFF0053C1) : Colors.white,
              borderRadius: BorderRadius.circular(24),
              border: Border.all(
                color: isSelected ? Colors.transparent : const Color(0xFFE2E8F0),
                width: 1,
              ),
              boxShadow: isSelected
                  ? [
                      BoxShadow(
                        color: const Color(0xFF0053C1).withOpacity(0.15),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      )
                    ]
                  : [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.03),
                        blurRadius: 12,
                        offset: const Offset(0, 4),
                      )
                    ],
            ),
            child: Stack(
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Icon Container
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        color: isSelected
                            ? Colors.white.withOpacity(0.15)
                            : const Color(0xFFEFF6FF),
                        shape: BoxShape.circle,
                      ),
                      child: Icon(
                        icon,
                        size: 24,
                        color: isSelected ? Colors.white : const Color(0xFF0053C1),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color: isSelected ? Colors.white : const Color(0xFF0F172A),
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: isSelected
                            ? Colors.white.withOpacity(0.85)
                            : const Color(0xFF64748B),
                        height: 1.3,
                      ),
                    ),
                    if (badge != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 16, vertical: 12),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? Colors.white.withOpacity(0.12)
                              : const Color(0xFFEFF6FF),
                          borderRadius: BorderRadius.circular(16),
                        ),
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Text(
                              'Standard Amount',
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w500,
                                color: isSelected
                                    ? Colors.white70
                                    : const Color(0xFF64748B),
                              ),
                            ),
                            Text(
                              badge,
                              style: GoogleFonts.inter(
                                fontSize: 15,
                                fontWeight: FontWeight.w700,
                                color: isSelected
                                    ? Colors.white
                                    : const Color(0xFF0053C1),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
                if (isSelected)
                  Positioned(
                    top: 0,
                    right: 0,
                    child: Container(
                      width: 24,
                      height: 24,
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check_rounded,
                        color: Color(0xFF0053C1),
                        size: 16,
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildInfoBox() {
    return FadeTransition(
      opacity: CurvedAnimation(parent: _entryCtrl, curve: const Interval(0.25, 0.85)),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              decoration: const BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.info_outline_rounded,
                color: Color(0xFF0053C1),
                size: 18,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Important Information',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w600,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Security deposits are refundable as per the lease terms. The amount will be returned within 7-10 business days after lease termination.',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: const Color(0xFF475569),
                      height: 1.5,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildContinueButton() {
    return FadeTransition(
      opacity: CurvedAnimation(parent: _entryCtrl, curve: const Interval(0.3, 0.9)),
      child: GestureDetector(
        key: const Key('continueToPaymentButton'),
        onTap: () => widget.onContinue?.call(_selected),
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            color: const Color(0xFF0053C1),
            borderRadius: BorderRadius.circular(999),
            boxShadow: [
              BoxShadow(
                color: const Color(0xFF0053C1).withOpacity(0.25),
                blurRadius: 16,
                offset: const Offset(0, 6),
              )
            ],
          ),
          child: Center(
            child: Text(
              'Continue to Payment',
              style: GoogleFonts.inter(
                fontSize: 16,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ),
        ),
      ),
    );
  }
}
