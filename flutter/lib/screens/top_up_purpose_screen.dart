import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// Matches web TopUpPurposeScreen.tsx:
/// - Gradient header with back btn + "Step 1 of 3" + "Select Purpose"
/// - Two selectable cards: Wallet Top-up, Security Deposit
///   - Selected: gradient blue bg + ring, checkmark, white text
///   - Unselected: white bg, border #e0e3e5
/// - Info box (blue-50)
/// - Gradient "Continue to Payment" pill button

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
      backgroundColor: AppColors.surface,
      body: Column(
        children: [
          // Gradient header
          _buildHeader(),

          // Scrollable content with -16 overlap
          Expanded(
            child: Transform.translate(
              offset: const Offset(0, -16),
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 32),
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
                      icon: Icons.lock_outline,
                      isSelected: _selected == TopUpPurpose.securityDeposit,
                      onTap: () {
                        setState(
                            () => _selected = TopUpPurpose.securityDeposit);
                        widget.onPurposeSelected
                            ?.call(TopUpPurpose.securityDeposit);
                      },
                      badge: '₹2,000',
                      key: const Key('securityDepositPurposeCard'),
                    ),

                    const SizedBox(height: 24),

                    _buildInfoBox(),

                    const SizedBox(height: 24),

                    // Continue button
                    _buildContinueButton(),
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
          // Back button
          Positioned(
            top: 0,
            left: 0,
            child: GestureDetector(
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

          // Title
          Padding(
            padding: const EdgeInsets.only(left: 48, top: 4),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Step 1 of 3',
                  style: GoogleFonts.inter(
                    color: Colors.white70,
                    fontSize: 14,
                    fontWeight: FontWeight.w500,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  'Select Purpose',
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
    final delay = 0.15 + index * 0.06;
    final anim = CurvedAnimation(
      parent: _entryCtrl,
      curve: Interval(delay, (delay + 0.4).clamp(0.0, 1.0),
          curve: Curves.easeOutCubic),
    );

    return FadeTransition(
      opacity: anim,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero)
            .animate(anim),
        child: GestureDetector(
          key: key,
          onTap: onTap,
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 200),
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              gradient: isSelected ? AppGradients.primary : null,
              color: isSelected ? null : Colors.white,
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: isSelected
                  ? Border.all(color: Colors.transparent)
                  : Border.all(color: AppColors.divider),
              boxShadow: AppShadows.card,
            ),
            child: Stack(
              clipBehavior: Clip.none,
              children: [
                // Decorative circles on selected
                if (isSelected) ...[
                  Positioned(
                    right: -10,
                    top: -10,
                    child: Container(
                      width: 80,
                      height: 80,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.1),
                      ),
                    ),
                  ),
                  Positioned(
                    right: 20,
                    bottom: -10,
                    child: Container(
                      width: 50,
                      height: 50,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: Colors.white.withOpacity(0.05),
                      ),
                    ),
                  ),
                ],

                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Icon
                    Container(
                      width: 56,
                      height: 56,
                      decoration: BoxDecoration(
                        color: isSelected
                            ? Colors.white.withOpacity(0.15)
                            : AppColors.primary.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                      ),
                      child: Icon(
                        icon,
                        size: 28,
                        color: isSelected ? Colors.white : AppColors.primary,
                      ),
                    ),
                    const SizedBox(height: 16),

                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 18,
                        fontWeight: FontWeight.w700,
                        color:
                            isSelected ? Colors.white : AppColors.onSurfaceAlt,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      description,
                      style: GoogleFonts.inter(
                        fontSize: 14,
                        color: isSelected
                            ? Colors.white70
                            : AppColors.onSurfaceVariant,
                      ),
                    ),

                    if (badge != null) ...[
                      const SizedBox(height: 16),
                      Container(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 12, vertical: 8),
                        decoration: BoxDecoration(
                          color: isSelected
                              ? Colors.white.withOpacity(0.1)
                              : AppColors.primary.withOpacity(0.05),
                          borderRadius: BorderRadius.circular(AppRadius.sm),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Standard Amount',
                              style: GoogleFonts.inter(
                                fontSize: 12,
                                color: isSelected
                                    ? Colors.white60
                                    : AppColors.primary.withOpacity(0.6),
                              ),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              badge,
                              style: GoogleFonts.inter(
                                fontSize: 14,
                                fontWeight: FontWeight.w600,
                                color: isSelected
                                    ? Colors.white
                                    : AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),

                // Checkmark when selected
                if (isSelected)
                  Positioned(
                    top: 0,
                    right: 0,
                    child: Container(
                      padding: const EdgeInsets.all(4),
                      decoration: const BoxDecoration(
                        color: Colors.white,
                        shape: BoxShape.circle,
                      ),
                      child: const Icon(
                        Icons.check_circle,
                        color: AppColors.primary,
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
      opacity:
          CurvedAnimation(parent: _entryCtrl, curve: const Interval(0.3, 0.9)),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: AppColors.infoLight,
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 32,
              height: 32,
              margin: const EdgeInsets.only(top: 2),
              decoration: BoxDecoration(
                color: AppColors.primary.withOpacity(0.1),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.info_outline,
                  color: AppColors.primary, size: 16),
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
                      color: AppColors.onSurfaceAlt,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Security deposits are refundable as per the lease terms. The amount will be returned within 7-10 business days after lease termination.',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppColors.onSurfaceVariant,
                      height: 1.6,
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
      opacity:
          CurvedAnimation(parent: _entryCtrl, curve: const Interval(0.4, 1.0)),
      child: GestureDetector(
        key: const Key('continueToPaymentButton'),
        onTap: () => widget.onContinue?.call(_selected),
        child: Container(
          height: 52,
          decoration: BoxDecoration(
            gradient: AppGradients.primary,
            borderRadius: BorderRadius.circular(999),
            boxShadow: AppShadows.primaryButton,
          ),
          child: Center(
            child: Text(
              'Continue to Payment',
              style: GoogleFonts.inter(
                fontSize: 15,
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
