import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/animated_success_glow.dart';
import 'package:voltium_rider/widgets/electric_burst_success.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

/// Matches web TopUpReceiptScreen.tsx:
/// - Success animation: green check circle with glow rings
/// - "Payment Submitted" text
/// - Status card (yellow-50) with "Verification in Progress"
/// - Info note (blue-50)
/// - Gradient "Back to Dashboard" pill button
/// - Decorative particles

class TopUpReceiptScreen extends StatefulWidget {
  final int amount;
  final String purpose;
  final VoidCallback? onBackToDashboard;

  const TopUpReceiptScreen({
    super.key,
    required this.amount,
    required this.purpose,
    this.onBackToDashboard,
  });

  @override
  State<TopUpReceiptScreen> createState() => _TopUpReceiptScreenState();
}

class _TopUpReceiptScreenState extends State<TopUpReceiptScreen>
    with TickerProviderStateMixin {
  late final AnimationController _mainCtrl;
  final GlobalKey<ElectricBurstSuccessState> _burstKey = GlobalKey();

  @override
  void initState() {
    super.initState();
    _mainCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );

    _mainCtrl.forward();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _burstKey.currentState?.trigger();
      PostHogService.capture('top_up_completed', properties: {
        'amount': widget.amount.toString(),
        'purpose': widget.purpose,
      });
    });
  }

  @override
  void dispose() {
    _mainCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
      body: Stack(
        alignment: Alignment.center,
        children: [
          // Content
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                // Success Circle with electric burst
                ElectricBurstSuccess(
                  key: _burstKey,
                  child: const AnimatedSuccessGlow(),
                ),

                const SizedBox(height: 32),

                // Text
                _buildTextSection(),

                const SizedBox(height: 24),

                // Status Card
                _buildStatusCard(),

                const SizedBox(height: 16),

                // Info Note
                _buildInfoNote(),

                const SizedBox(height: 40),

                // Back Button
                _buildBackButton(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextSection() {
    return FadeTransition(
      opacity:
          CurvedAnimation(parent: _mainCtrl, curve: const Interval(0.5, 0.8)),
      child: Column(
        children: [
          Text(
            'Payment Submitted',
            style: AppTypography.headingMedium
                .copyWith(color: AppColors.onSurfaceAlt),
          ),
          SizedBox(height: 12),
          RichText(
            textAlign: TextAlign.center,
            text: TextSpan(
              style: GoogleFonts.plusJakartaSans(
                fontSize: 15,
                color: AppColors.onSurfaceVariant,
                height: 1.6,
              ),
              children: [
                const TextSpan(text: 'Your payment of '),
                TextSpan(
                  text:
                      '₹${widget.amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                  style: GoogleFonts.plusJakartaSans(
                    fontWeight: FontWeight.bold,
                    color: AppColors.onSurfaceAlt,
                  ),
                ),
                TextSpan(
                  text:
                      ' for ${widget.purpose.replaceAll('_', ' ').toLowerCase()} is being verified by our team.',
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusCard() {
    final colors = AppColors.of(context);
    return FadeTransition(
      opacity:
          CurvedAnimation(parent: _mainCtrl, curve: const Interval(0.6, 0.9)),
      child: Container(
        padding: Spacing.paddingMd,
        decoration: BoxDecoration(
          color: colors.card,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.card,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: const BoxDecoration(
                color: AppColors.warningLight,
                shape: BoxShape.circle,
              ),
              child: const Icon(
                Icons.access_time,
                color: AppColors.warningDark,
                size: 20,
              ),
            ),
            SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Verification in Progress',
                    style: AppTypography.labelLarge
                        .copyWith(color: AppColors.onSurfaceAlt),
                  ),
                  SizedBox(height: 2),
                  Text(
                    'Estimated time: Within 24 hours',
                    style: GoogleFonts.plusJakartaSans(
                      fontSize: 14,
                      color: AppColors.onSurfaceVariant,
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

  Widget _buildInfoNote() {
    return FadeTransition(
      opacity:
          CurvedAnimation(parent: _mainCtrl, curve: const Interval(0.7, 1.0)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: AppColors.primarySurface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline, color: AppColors.primary, size: 16),
            SizedBox(width: 8),
            Expanded(
              child: Text(
                'Balance will update after admin approval. You\'ll receive a notification once it\'s done.',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  color: AppColors.onSurfaceVariant,
                  height: 1.5,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBackButton() {
    return FadeTransition(
      opacity:
          CurvedAnimation(parent: _mainCtrl, curve: const Interval(0.8, 1.0)),
      child: GestureDetector(
        onTap: widget.onBackToDashboard,
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            gradient: AppGradients.primary,
            borderRadius: BorderRadius.circular(AppRadius.full),
            boxShadow: AppShadows.primaryButton,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.home_outlined, color: Colors.white, size: 20),
              SizedBox(width: 8),
              Text(
                'Back to Dashboard',
                style: AppTypography.buttonMedium.copyWith(color: Colors.white),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
