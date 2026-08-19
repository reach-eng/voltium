import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';

class KycPreflightScreen extends StatefulWidget {
  final VoidCallback onNext;
  final VoidCallback? onSkip;

  const KycPreflightScreen({
    super.key,
    required this.onNext,
    this.onSkip,
  });

  @override
  State<KycPreflightScreen> createState() => _KycPreflightScreenState();
}

class _KycPreflightScreenState extends State<KycPreflightScreen>
    with SingleTickerProviderStateMixin {
  late final AnimationController _entryCtrl;

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
    PostHogService.capture('kyc_preflight_viewed');
  }

  @override
  void dispose() {
    _entryCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 24.0, vertical: 16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const SizedBox(height: 16),
              // Header Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: colors.card,
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border:
                      Border.all(color: colors.outline.withValues(alpha: 0.2)),
                  boxShadow: AppShadows.card,
                ),
                child: Row(
                  children: [
                    Container(
                      width: 48,
                      height: 48,
                      decoration: BoxDecoration(
                        gradient: AppGradients.primary,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                      child: const Icon(
                        Icons.assignment_ind_outlined,
                        color: Colors.white,
                        size: 24,
                      ),
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            l10n.txtbeforeYouBegin,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 20,
                              fontWeight: FontWeight.w700,
                              color: colors.onSurface,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            l10n.txtquickKycSubtitle,
                            style: GoogleFonts.plusJakartaSans(
                              fontSize: 13,
                              color: colors.onSurfaceVariant,
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 28),

              Text(
                l10n.txtpleaseHaveReady,
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 16,
                  fontWeight: FontWeight.w600,
                  color: colors.onSurface,
                ),
              ),

              const SizedBox(height: 16),

              Expanded(
                child: FadeTransition(
                  opacity: CurvedAnimation(
                    parent: _entryCtrl,
                    curve: Curves.easeOut,
                  ),
                  child: ListView(
                    physics: const BouncingScrollPhysics(),
                    children: [
                      _buildChecklistItem(
                        context,
                        icon: Icons.credit_card,
                        title: l10n.txtaadhaarCard,
                        subtitle: l10n.txtaadhaarCardDesc,
                      ),
                      const SizedBox(height: 12),
                      _buildChecklistItem(
                        context,
                        icon: Icons.badge_outlined,
                        title: l10n.txtpanCard,
                        subtitle: l10n.txtpanCardDesc,
                      ),
                      const SizedBox(height: 12),
                      _buildChecklistItem(
                        context,
                        icon: Icons.timer_outlined,
                        title: l10n.txtthreeMinutesTime,
                        subtitle: l10n.txtfastAutomatedVerification,
                      ),
                    ],
                  ),
                ),
              ),

              // Action buttons
              Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  GestureDetector(
                    key: const Key('imReadyButton'),
                    onTap: () {
                      PostHogService.capture('kyc_preflight_ready_tapped');
                      widget.onNext();
                    },
                    child: Container(
                      height: 56,
                      decoration: BoxDecoration(
                        gradient: AppGradients.primary,
                        borderRadius: BorderRadius.circular(AppRadius.full),
                        boxShadow: AppShadows.primaryButton,
                      ),
                      child: Center(
                        child: Text(
                          l10n.txtimReady,
                          style: AppTypography.bodyLarge.copyWith(
                            fontWeight: FontWeight.w600,
                            color: Colors.white,
                          ),
                        ),
                      ),
                    ),
                  ),
                  if (widget.onSkip != null) ...[
                    const SizedBox(height: 12),
                    Center(
                      child: TextButton(
                        key: const Key('skipPreflightButton'),
                        onPressed: widget.onSkip,
                        child: Text(
                          l10n.txtillDoThisLater,
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 14,
                            fontWeight: FontWeight.w500,
                            color: colors.onSurfaceVariant,
                          ),
                        ),
                      ),
                    ),
                  ],
                ],
              ),
              const SizedBox(height: 12),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildChecklistItem(
    BuildContext context, {
    required IconData icon,
    required String title,
    required String subtitle,
  }) {
    final colors = AppColors.of(context);
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.md),
        border: Border.all(color: colors.outline.withValues(alpha: 0.2)),
        boxShadow: AppShadows.card,
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: AppColors.primary.withValues(alpha: 0.1),
              borderRadius: BorderRadius.circular(AppRadius.sm),
            ),
            child: Icon(icon, color: AppColors.primary, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                    color: colors.onSurface,
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  subtitle,
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
