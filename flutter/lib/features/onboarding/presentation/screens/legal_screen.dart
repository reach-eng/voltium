import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';

/// Matches web LegalConsentScreen.tsx exactly:
/// - bg #f7f9fb
/// - Glass back button (40×40 circle, white/70, blur, shadow)
/// - Shield icon in glass card (48×48, rounded-xl) + "Agree to Terms" title (24px bold)
/// - Subtitle "Please review and accept our legal documents to continue."
/// - Expandable white cards (rounded-xl, shadow) — Terms of Service, Privacy Policy
///   - Chevron rotates 180° when expanded
///   - Divider inside, scrollable content (max 280px), 13px text #424653
/// - Custom checkbox: 24×24 rounded-lg, gradient when checked, spring animation
/// - "Continue" gradient pill button (56px, disabled opacity 0.4)

const _kTermsContent =
    'These Terms of Service ("Terms") govern your access to and use of Voltium\'s services, including our electric vehicle rental platform, mobile application, and related services.\n\nBy creating an account or using our services, you agree to be bound by these Terms.\n\n1. Account Registration: You must provide accurate, current, and complete information during registration and keep your account information updated.\n\n2. Vehicle Rental: All vehicle rentals are subject to availability and our rental policies. You must hold a valid driver\'s license and meet minimum age requirements.\n\n3. Safety Requirements: You agree to follow all safety guidelines, traffic laws, and Voltium usage policies while operating our vehicles.\n\n4. Payment Terms: You authorize Voltium to charge your selected payment method for rental fees, security deposits, and any applicable charges.\n\n5. Liability: You are responsible for any damage to the vehicle during your rental period, subject to the terms of your selected plan.';

const _kPrivacyContent =
    'Voltium respects your privacy and is committed to protecting your personal data. This Privacy Policy explains how we collect, use, and safeguard your information.\n\n1. Information We Collect: We collect your name, phone number, email, government-issued ID (Aadhaar, PAN), bank details, location data, and vehicle usage information.\n\n2. How We Use Your Data: We use your information to provide and improve our services, process transactions, communicate with you, and comply with legal obligations.\n\n3. Data Sharing: We may share your data with trusted partners, government authorities as required by law, and service providers who assist our operations.\n\n4. Data Security: We implement industry-standard security measures including encryption, secure servers, and access controls to protect your data.\n\n5. Your Rights: You can access, correct, or delete your personal data by contacting our support team or through your account settings.\n\n6. Data Retention: We retain your data for as long as necessary to provide our services and comply with legal requirements.';

const _kRentalSafetyContent =
    'This Rental and Safety Agreement ("Agreement") governs the rental and operation of Voltium electric vehicles.\n\n1. Vehicle Inspection: You must inspect the vehicle before each ride and report any damage immediately. You are responsible for pre-existing damage not reported.\n\n2. Safe Operation: You agree to operate the vehicle in accordance with all traffic laws, wear a helmet at all times, and not operate under the influence of alcohol or drugs.\n\n3. Parking and Storage: Vehicles must be returned to designated hubs. Overnight parking is permitted only at approved locations. Improper parking may result in additional charges.\n\n4. Damage and Theft: You are liable for damage or theft during your rental period. Voltium recommends opting for damage protection plans where available.\n\n5. Speed and Usage Limits: Vehicles have speed governors and geo-fencing. Violation of usage zones or speed limits may result in penalties or account suspension.\n\n6. Accident Protocol: In case of an accident, ensure your safety first, contact emergency services if needed, and report the incident through the Voltium app within 24 hours.';

const _kRefundContent =
    'This Refund and Cancellation Policy outlines the terms for cancellations and refunds on Voltium\'s rental services.\n\n1. Rental Cancellation: You may cancel a rental booking up to 2 hours before the scheduled start time for a full refund. Cancellations within 2 hours may incur a fee of 10% of the booking amount.\n\n2. Security Deposit Refund: Security deposits are refundable after 180 days of active service, subject to the terms outlined in your rental agreement. Deductions may apply for outstanding dues, damages, or non-returned accessories.\n\n3. Top-Up Refunds: Wallet top-ups are non-refundable but remain in your Voltium wallet for future rentals. Refund requests for technical errors or duplicate transactions will be processed within 5-7 business days.\n\n4. Plan Changes: You may upgrade your rental plan at any time. Downgrades take effect at the next billing cycle. Prorated refunds are provided for unused days on annual or monthly plans.\n\n5. Service Disruptions: If Voltium is unable to provide a booked vehicle due to operational issues, you will receive a full refund or a comparable vehicle upgrade at no additional charge.';

const _kGuarantorAgreementContent =
    'This Guarantor\'s Agreement ("Agreement") is a legally binding contract between you (the "Guarantor") and Voltium, guaranteeing the obligations of the rider you are sponsoring.\n\n1. Guarantor Obligations: As a guarantor, you agree to be jointly and severally liable for all rental charges, damages, and penalties incurred by the rider during the rental period.\n\n2. Financial Responsibility: You authorize Voltium to recover any outstanding amounts from the rider\'s security deposit or wallet balance. If the balance is insufficient, you agree to pay the outstanding amount upon demand.\n\n3. Duration: This guarantor obligation remains in effect for the entire duration of the rider\'s active subscription with Voltium and for 30 days after the account is closed or terminated.\n\n4. Termination: You may request to be released as a guarantor by providing 30 days written notice. Voltium reserves the right to require the rider to provide an alternate guarantor before releasing you.\n\n5. Communication: You agree to receive communications from Voltium regarding the rider\'s account status, payment defaults, and other relevant notifications at the phone number and email address provided during registration.\n\n6. Verification: You confirm that all information provided during the guarantor registration process is accurate and complete. Voltium may verify your identity and financial standing through third-party services.';

class LegalScreen extends StatefulWidget {
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  const LegalScreen({super.key, this.onNext, this.onBack});

  @override
  State<LegalScreen> createState() => _LegalScreenState();
}

class _LegalScreenState extends State<LegalScreen>
    with TickerProviderStateMixin {
  String? _expandedId;
  bool _accepted = false;

  late final AnimationController _entryCtrl;
  late final AnimationController _checkCtrl;

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 500),
    )..forward();

    _checkCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 200),
    );
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    _checkCtrl.dispose();
    super.dispose();
  }

  void _toggleAccepted() {
    setState(() => _accepted = !_accepted);
    if (_accepted) {
      _checkCtrl.forward();
    } else {
      _checkCtrl.reverse();
    }
  }

  void _handleContinue() {
    if (!_accepted) return;
    widget.onNext?.call();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            // Back button row
            Padding(
              padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
              child: FadeTransition(
                opacity: CurvedAnimation(
                    parent: _entryCtrl,
                    curve: const Interval(0, 0.5, curve: Curves.easeIn),),
                child: _buildBackButton(),
              ),
            ),

            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 24, 20, 0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Header: Shield + "Agree to Terms"
                    _buildHeader(),
                    const SizedBox(height: 8),

                    // Subtitle
                    FadeTransition(
                      opacity: CurvedAnimation(
                          parent: _entryCtrl,
                          curve:
                              const Interval(0.2, 0.8, curve: Curves.easeIn),),
                      child: Text('Please review and accept our legal documents to continue.',
                        style: GoogleFonts.inter(
                          fontSize: 14,
                          color: AppColors.onSurfaceVariant,
                          height: 1.6,
                        ),
                      ),
                    ),

                    const SizedBox(height: 24),

                    // Expandable sections
                    SlideTransition(
                      position: Tween<Offset>(
                              begin: const Offset(0, 0.3), end: Offset.zero,)
                          .animate(CurvedAnimation(
                              parent: _entryCtrl,
                              curve: const Interval(0.2, 0.9,
                                  curve: Curves.easeOutCubic,),),),
                      child: FadeTransition(
                        opacity: CurvedAnimation(
                            parent: _entryCtrl,
                            curve: const Interval(0.2, 0.8),),
                        child: Column(
                          children: [
                            _buildExpandableSection(
                              id: 'terms',
                              title: 'Terms of Service',
                              content: _kTermsContent,
                              headerKey: const Key('termsExpand'),
                            ),
                            const SizedBox(height: 12),
                            _buildExpandableSection(
                              id: 'privacy',
                              title: 'Privacy Policy',
                              content: _kPrivacyContent,
                              headerKey: const Key('privacyExpand'),
                            ),
                            const SizedBox(height: 12),
                            _buildExpandableSection(
                              id: 'rental_safety',
                              title: 'Rental & Safety Agreement',
                              content: _kRentalSafetyContent,
                              headerKey: const Key('rentalSafetyExpand'),
                            ),
                            const SizedBox(height: 12),
                            _buildExpandableSection(
                              id: 'refund',
                              title: 'Refund & Cancellation',
                              content: _kRefundContent,
                              headerKey: const Key('refundExpand'),
                            ),
                            const SizedBox(height: 12),
                            _buildExpandableSection(
                              id: 'guarantor',
                              title: "Guarantor's Agreement",
                              content: _kGuarantorAgreementContent,
                              headerKey: const Key('guarantorExpand'),
                            ),
                          ],
                        ),
                      ),
                    ),

                    const SizedBox(height: 40),
                  ],
                ),
              ),
            ),

            // Checkbox + Continue button
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildBackButton() {
    return GestureDetector(
      onTap: widget.onBack ?? () => Navigator.maybePop(context),
      child: Container(
        width: 40,
        height: 40,
        decoration: BoxDecoration(
          color: Colors.white.withValues(alpha: 0.7),
          borderRadius: BorderRadius.circular(999),
          boxShadow: AppShadows.glass,
        ),
        child: const Icon(
          Icons.arrow_back,
          size: 20,
          color: AppColors.onSurfaceAlt,
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return SlideTransition(
      position: Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero)
          .animate(CurvedAnimation(
              parent: _entryCtrl,
              curve: const Interval(0.1, 0.7, curve: Curves.easeOutCubic),),),
      child: FadeTransition(
        opacity: CurvedAnimation(
            parent: _entryCtrl, curve: const Interval(0.1, 0.7),),
        child: Row(
          children: [
            // Shield card 48×48 rounded-xl glass
            Container(
              width: 48,
              height: 48,
              decoration: BoxDecoration(
                color: Colors.white.withValues(alpha: 0.7),
                borderRadius: BorderRadius.circular(AppRadius.lg),
                boxShadow: AppShadows.glass,
              ),
              child: const Icon(
                Icons.shield_outlined,
                size: 24,
                color: AppColors.primary,
              ),
            ),
            const SizedBox(width: 12),
            Text('Agree to Terms',
              style: GoogleFonts.inter(
                fontSize: 24,
                fontWeight: FontWeight.w700,
                color: AppColors.onSurfaceAlt,
                letterSpacing: -0.5,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildExpandableSection({
    required String id,
    required String title,
    required String content,
    Key? headerKey,
  }) {
    final isExpanded = _expandedId == id;

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header row
            InkWell(
              key: headerKey,
              onTap: () {
                setState(() => _expandedId = isExpanded ? null : id);
              },
              child: Padding(
                padding:
                    const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      title,
                      style: GoogleFonts.inter(
                        fontSize: 15,
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurfaceAlt,
                      ),
                    ),
                    AnimatedRotation(
                      turns: isExpanded ? 0.5 : 0.0,
                      duration: const Duration(milliseconds: 250),
                      child: const Icon(
                        Icons.keyboard_arrow_down,
                        size: 20,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                  ],
                ),
              ),
            ),

            // Expandable content
            AnimatedSize(
              duration: const Duration(milliseconds: 300),
              curve: Curves.easeOutCubic,
              child: isExpanded
                  ? Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        // Divider
                        Container(
                          height: 1,
                          color: AppColors.divider,
                          margin: const EdgeInsets.symmetric(horizontal: 20),
                        ),
                        Padding(
                          padding: const EdgeInsets.fromLTRB(20, 16, 20, 20),
                          child: ConstrainedBox(
                            constraints: const BoxConstraints(maxHeight: 280),
                            child: SingleChildScrollView(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: content
                                    .split('\n\n')
                                    .map(
                                      (para) => Padding(
                                        padding:
                                            const EdgeInsets.only(bottom: 12),
                                        child: Text(
                                          para,
                                          style: GoogleFonts.inter(
                                            fontSize: 13,
                                            color: AppColors.onSurfaceVariant,
                                            height: 1.7,
                                          ),
                                        ),
                                      ),
                                    )
                                    .toList(),
                              ),
                            ),
                          ),
                        ),
                      ],
                    )
                  : const SizedBox.shrink(),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooter() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 12, 20, 32),
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.5), end: Offset.zero)
            .animate(CurvedAnimation(
                parent: _entryCtrl,
                curve: const Interval(0.3, 1.0, curve: Curves.easeOutCubic),),),
        child: FadeTransition(
          opacity: CurvedAnimation(
              parent: _entryCtrl, curve: const Interval(0.3, 0.9),),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // Custom checkbox row
              GestureDetector(
                key: const Key('acceptCheckbox'),
                onTap: _toggleAccepted,
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    // Custom gradient checkbox 24×24 rounded-lg
                    AnimatedContainer(
                      duration: const Duration(milliseconds: 200),
                      width: 24,
                      height: 24,
                      margin: const EdgeInsets.only(top: 2),
                      decoration: BoxDecoration(
                        gradient: _accepted ? AppGradients.primary : null,
                        color: _accepted ? null : AppColors.divider,
                        borderRadius: BorderRadius.circular(AppRadius.sm),
                        boxShadow:
                            _accepted ? AppShadows.checkboxAccepted : null,
                      ),
                      child: _accepted
                          ? ScaleTransition(
                              scale: CurvedAnimation(
                                parent: _checkCtrl,
                                curve: Curves.elasticOut,
                              ),
                              child: const Icon(
                                Icons.check,
                                size: 16,
                                color: Colors.white,
                              ),
                            )
                          : null,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: RichText(
                        text: TextSpan(
                          style: GoogleFonts.inter(
                            fontSize: 13,
                            color: AppColors.onSurfaceVariant,
                            height: 1.6,
                          ),
                          children: [
                            const TextSpan(
                                text: 'I have read and agree to the ',),
                            TextSpan(
                              text: 'Terms of Service',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                            const TextSpan(text: ' and '),
                            TextSpan(
                              text: 'Privacy Policy',
                              style: GoogleFonts.inter(
                                fontSize: 13,
                                fontWeight: FontWeight.w600,
                                color: AppColors.primary,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Continue button
              GestureDetector(
                key: const Key('continueLegalButton'),
                onTap: _accepted ? _handleContinue : null,
                child: AnimatedOpacity(
                  opacity: _accepted ? 1.0 : 0.4,
                  duration: const Duration(milliseconds: 200),
                  child: Container(
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: AppGradients.primary,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: _accepted ? AppShadows.primaryButton : null,
                    ),
                    child: Center(
                      child: Text('Continue',
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
