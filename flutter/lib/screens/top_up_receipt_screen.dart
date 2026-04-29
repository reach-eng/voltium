import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

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
  late final AnimationController _glowCtrl;
  late final Animation<double> _scaleAnim;
  late final Animation<double> _rotateAnim;

  @override
  void initState() {
    super.initState();
    _mainCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1200),
    );
    _glowCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2000),
    )..repeat();

    _scaleAnim = CurvedAnimation(
      parent: _mainCtrl,
      curve: const Interval(0.0, 0.6, curve: Curves.elasticOut),
    );
    _rotateAnim = Tween<double>(begin: -math.pi, end: 0).animate(
      CurvedAnimation(
        parent: _mainCtrl,
        curve: const Interval(0.2, 0.8, curve: Curves.easeOutBack),
      ),
    );

    _mainCtrl.forward();
  }

  @override
  void dispose() {
    _mainCtrl.dispose();
    _glowCtrl.dispose();
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
                // Success Circle
                _buildSuccessCircle(),

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

          // Decorative particles
          ...List.generate(6, (i) => _buildParticle(i)),
        ],
      ),
    );
  }

  Widget _buildSuccessCircle() {
    return ScaleTransition(
      scale: _scaleAnim,
      child: Stack(
        alignment: Alignment.center,
        children: [
          // Outer glow rings
          AnimatedBuilder(
            animation: _glowCtrl,
            builder: (context, child) {
              return Stack(
                alignment: Alignment.center,
                children: [
                  Container(
                    width: 130 + (10 * _glowCtrl.value),
                    height: 130 + (10 * _glowCtrl.value),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A).withOpacity(0.05),
                      shape: BoxShape.circle,
                    ),
                  ),
                  Container(
                    width: 110 + (15 * _glowCtrl.value),
                    height: 110 + (15 * _glowCtrl.value),
                    decoration: BoxDecoration(
                      color: const Color(0xFF16A34A).withOpacity(0.1),
                      shape: BoxShape.circle,
                    ),
                  ),
                ],
              );
            },
          ),
          // Main circle
          Container(
            width: 96,
            height: 96,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFF16A34A), Color(0xFF22C55E)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              shape: BoxShape.circle,
              boxShadow: [
                BoxShadow(
                  color: const Color(0xFF16A34A).withOpacity(0.3),
                  blurRadius: 24,
                  offset: const Offset(0, 8),
                )
              ],
            ),
            child: AnimatedBuilder(
              animation: _rotateAnim,
              builder: (context, child) {
                return Transform.rotate(
                  angle: _rotateAnim.value,
                  child: const Icon(
                    Icons.check_circle_outline,
                    color: Colors.white,
                    size: 56,
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTextSection() {
    return FadeTransition(
      opacity: CurvedAnimation(
          parent: _mainCtrl, curve: const Interval(0.5, 0.8)),
      child: Column(
        children: [
          Text(
            'Payment Submitted',
            style: GoogleFonts.inter(
              fontSize: 24,
              fontWeight: FontWeight.w800,
              color: AppColors.onSurfaceAlt,
            ),
          ),
          const SizedBox(height: 12),
          RichText(
            textAlign: TextAlign.center,
            text: TextSpan(
              style: GoogleFonts.inter(
                fontSize: 15,
                color: AppColors.onSurfaceVariant,
                height: 1.6,
              ),
              children: [
                const TextSpan(text: 'Your payment of '),
                TextSpan(
                  text:
                      '₹${widget.amount.toString().replaceAllMapped(RegExp(r'(\d{1,3})(?=(\d{3})+(?!\d))'), (Match m) => '${m[1]},')}',
                  style: const TextStyle(
                      fontWeight: FontWeight.bold, color: AppColors.onSurfaceAlt),
                ),
                TextSpan(
                    text:
                        ' for ${widget.purpose.replaceAll('_', ' ').toLowerCase()} is being verified by our team.'),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStatusCard() {
    return FadeTransition(
      opacity: CurvedAnimation(
          parent: _mainCtrl, curve: const Interval(0.6, 0.9)),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          boxShadow: AppShadows.card,
        ),
        child: Row(
          children: [
            Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: const Color(0xFFFEF3C7),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.access_time,
                  color: Color(0xFFD97706), size: 20),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Verification in Progress',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w700,
                      color: AppColors.onSurfaceAlt,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    'Estimated time: Within 24 hours',
                    style: GoogleFonts.inter(
                      fontSize: 12,
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
      opacity: CurvedAnimation(
          parent: _mainCtrl, curve: const Interval(0.7, 1.0)),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Icon(Icons.info_outline, color: Color(0xFF0053C1), size: 16),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                'Balance will update after admin approval. You\'ll receive a notification once it\'s done.',
                style: GoogleFonts.inter(
                  fontSize: 12,
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
      opacity: CurvedAnimation(
          parent: _mainCtrl, curve: const Interval(0.8, 1.0)),
      child: GestureDetector(
        onTap: widget.onBackToDashboard,
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            gradient: AppGradients.primary,
            borderRadius: BorderRadius.circular(999),
            boxShadow: AppShadows.primaryButton,
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.home_outlined, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(
                'Back to Dashboard',
                style: GoogleFonts.inter(
                  fontSize: 15,
                  fontWeight: FontWeight.w700,
                  color: Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildParticle(int i) {
    final colors = [
      const Color(0xFF0053C1),
      const Color(0xFF2F6DDE),
      const Color(0xFF16A34A),
      const Color(0xFFF59E0B),
      const Color(0xFF0053C1),
      const Color(0xFF22C55E)
    ];
    final random = math.Random(i);
    final delay = 0.5 + i * 0.1;

    return AnimatedBuilder(
      animation: _mainCtrl,
      builder: (context, child) {
        if (_mainCtrl.value < delay) return const SizedBox();
        final progress = (_mainCtrl.value - delay) / (1.0 - delay);
        if (progress > 1.0) return const SizedBox();

        final x = (random.nextDouble() - 0.5) * 300 * progress;
        final y = -100 * progress - (random.nextDouble() * 200 * progress);
        final opacity = 1.0 - progress;

        return Transform.translate(
          offset: Offset(x, y),
          child: Opacity(
            opacity: opacity,
            child: Container(
              width: 8,
              height: 8,
              decoration: BoxDecoration(
                color: colors[i % colors.length],
                shape: BoxShape.circle,
              ),
            ),
          ),
        );
      },
    );
  }
}
