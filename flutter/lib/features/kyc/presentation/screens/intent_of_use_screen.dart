import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import '../../../../utils/app_logger.dart';

enum IntentType { delivery, personal }

class IntentOfUseScreen extends ConsumerStatefulWidget {
  final VoidCallback? onNext;
  final VoidCallback? onBack;

  const IntentOfUseScreen({super.key, this.onNext, this.onBack});

  @override
  ConsumerState<IntentOfUseScreen> createState() => _IntentOfUseScreenState();
}

class _IntentOfUseScreenState extends ConsumerState<IntentOfUseScreen> {
  IntentType? _selectedIntent;
  // PR-ONBOARDING-2026-08-11 (audit 2.1): double-tap guard for the in-flight
  // PUT /api/rider/profile. The previous implementation had no _isLoading
  // flag, so rapid double-tap issued a second PUT before the first returned.
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    // AUDIT FIX (P2 data-population): pre-select the intent the rider
    // already chose on a previous visit — a returning/partially-completed
    // rider shouldn't have to re-select from scratch.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final savedIntent = ref.read(riderProvider).rider?.intent;
      if (savedIntent == 'deliver') {
        setState(() => _selectedIntent = IntentType.delivery);
      } else if (savedIntent == 'personal') {
        setState(() => _selectedIntent = IntentType.personal);
      }
    });
  }

  /// AUDIT FIX (5a): the PUT and the provider refresh now live in separate
  /// try/catch blocks. Previously a successful PUT followed by a refresh
  /// failure showed "couldn't save" (false) and a retry issued a duplicate
  /// PUT. A refresh failure is now a non-blocking warning — the selection
  /// WAS saved.
  Future<void> _submit() async {
    // ONBOARDING-AUDIT 2026-08-14 P1-4:
    // double-tap race guard. The button's onPressed is gated on
    // `_isSubmitting`, but the framework may not have repainted yet when
    // the second tap arrives — a fast double-tap can fire onPressed twice
    // and call putRiderProfile() + refresh() twice. Bail early on the
    // second tap.
    if (_isSubmitting) return;
    final intentStr =
        _selectedIntent == IntentType.delivery ? 'deliver' : 'personal';
    // AUDIT FIX (MINOR, 5c): read once instead of subscribing inside the
    // submit closure.
    final provider = ref.read(riderProvider.notifier);
    final riderId =
        ref.read(riderProvider).riderId ?? ref.read(riderProvider).rider?.id;
    if (riderId == null) {
      Toast.info(
        context,
        'Rider session not ready. Please try again.',
      );
      return;
    }
    setState(() => _isSubmitting = true);
    try {
      // 1. The actual save.
      try {
        await VoltiumApiClient(ApiClient()).putRiderProfile(
          UpdateProfileRequest(intent: intentStr),
        );
      } catch (e) {
        // AUDIT FIX (MINOR, 5b): never discard the exception silently.
        appDebug('Intent of use save failed: $e');
        if (!mounted) return;
        Toast.error(
          context,
          'Couldn\'t save your selection. Please try again.',
        );
        return;
      }

      // 2. Post-save refresh — best-effort, never reported as a save
      // failure and never retried with a duplicate PUT.
      try {
        await provider.refresh();
      } catch (e) {
        appDebug('Intent of use: refresh failed after save success: $e');
        if (mounted) {
          Toast.info(
            context,
            'Saved. We could not refresh your profile just now — '
            'pull to refresh later.',
          );
        }
      }

      await PostHogService.capture(
        'intent_of_use_submitted',
        properties: {'intent': intentStr},
      );
      if (!mounted) return;
      widget.onNext?.call();
    } finally {
      if (mounted) {
        setState(() => _isSubmitting = false);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    // DARK-MODE-AUDIT 2026-08-14 P0-4: the previous version used
    // the static `AppColors.surface` (#F7F9FB) — the LIGHT
    // surface. In dark mode the scaffold stayed light even
    // though the rest of the app was dark. Read from the
    // brightness-aware theme extension so the scaffold flips
    // with the user's theme.
    return Scaffold(
      backgroundColor: AppColors.of(context).surface,
      appBar: AppBar(
        backgroundColor: Colors.transparent,
        elevation: 0,
        surfaceTintColor: Colors.transparent,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back, color: AppColors.primary),
          onPressed: () => widget.onBack?.call(),
        ),
        title: Text(
          'Intent of Use',
          style: AppTypography.titleMedium
              .copyWith(color: AppColors.of(context).onSurface),
        ),
        centerTitle: false,
        titleSpacing: 0,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: SingleChildScrollView(
                padding:
                    const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: [
                    // Header text
                    RichText(
                      textAlign: TextAlign.center,
                      text: TextSpan(
                        style: AppTypography.headingMedium.copyWith(
                            color: AppColors.of(context).onSurface,
                            height: 1.1,
                            letterSpacing: -0.5),
                        children: [
                          const TextSpan(text: 'How will you use\n'),
                          TextSpan(
                            text: 'Voltium',
                            style: GoogleFonts.plusJakartaSans(
                                color: AppColors.primary),
                          ),
                          const TextSpan(text: '?'),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Select your primary usage to help us customize your experience and support.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.plusJakartaSans(
                        color: AppColors.of(context).onSurfaceVariant,
                        fontSize: 15,
                        height: 1.4,
                        fontWeight: FontWeight.w500,
                      ),
                    ),
                    const SizedBox(height: 32),

                    // Delivery Card
                    _buildIntentCard(
                      key: const Key('deliverWithUsCard'),
                      type: IntentType.delivery,
                      title: 'Deliver with Us',
                      description:
                          'Rent an EV for logistics, delivery, or commercial needs. Includes hub support.',
                      iconData: Icons.bolt,
                      iconBgColor: AppColors.primary,
                      iconColor: Colors.white,
                    ),
                    const SizedBox(height: 16),

                    // Personal Card
                    _buildIntentCard(
                      key: const Key('personalUsageCard'),
                      type: IntentType.personal,
                      title: 'Personal Usage',
                      description:
                          'Daily commutes, weekend trips, or general city riding.',
                      iconData: Icons.directions_car,
                      iconBgColor: AppColors.of(context).primarySurface,
                      iconColor: AppColors.primary,
                    ),
                    const SizedBox(height: 32),

                    // Info banner
                    Container(
                      padding: Spacing.paddingMd,
                      decoration: BoxDecoration(
                        color: AppColors.of(context).primarySurface,
                        borderRadius: BorderRadius.circular(AppRadius.lg),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.2),
                          width: 1,
                        ),
                      ),
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Icon(
                            Icons.info,
                            color: AppColors.primary,
                            size: 20,
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Text(
                              'Switching between types is possible later through account settings, though commercial access may require additional verification.',
                              style: GoogleFonts.plusJakartaSans(
                                color: AppColors.of(context).onSurfaceVariant,
                                fontSize: 13,
                                height: 1.4,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 24),
                  ],
                ),
              ),
            ),

            // Bottom Continue Button
            Padding(
              padding: const EdgeInsets.only(
                left: 24,
                right: 24,
                bottom: 24,
              ),
              child: SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  key: const Key('confirmIntentButton'),
                  onPressed:
                      _selectedIntent == null || _isSubmitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    disabledBackgroundColor:
                        AppColors.of(context).outlineVariant,
                    foregroundColor: Colors.white,
                    disabledForegroundColor: Colors.white70,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius:
                          BorderRadius.circular(AppRadius.radiusModal),
                    ),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 22,
                          height: 22,
                          child: CircularProgressIndicator(
                            strokeWidth: 2.5,
                            valueColor:
                                AlwaysStoppedAnimation<Color>(Colors.white),
                          ),
                        )
                      : Text(
                          'Confirm Selection',
                          style: AppTypography.titleSmall,
                        ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildIntentCard({
    Key? key,
    required IntentType type,
    required String title,
    required String description,
    required IconData iconData,
    required Color iconBgColor,
    required Color iconColor,
  }) {
    final colors = AppColors.of(context);
    final isSelected = _selectedIntent == type;

    // AUDIT FIX (MINOR, 5d): bare GestureDetectors are invisible to screen
    // readers. Expose the card as a selectable button and merge the radio
    // state into the accessible label.
    return Semantics(
      selected: isSelected,
      button: true,
      label: isSelected ? '$title, selected' : title,
      child: GestureDetector(
        key: key,
        onTap: () {
          setState(() {
            _selectedIntent = type;
          });
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.all(Spacing.md),
          decoration: BoxDecoration(
            color: isSelected ? AppColors.primary : colors.card,
            borderRadius: BorderRadius.circular(AppRadius.radiusModal),
            border: Border.all(
              color: isSelected ? AppColors.primary : colors.outlineVariant,
              width: 2,
            ),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.03),
                blurRadius: 15,
                offset: const Offset(0, 5),
              ),
            ],
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Icon
              Container(
                width: 56,
                height: 56,
                decoration: BoxDecoration(
                  color: isSelected ? Colors.white : iconBgColor,
                  shape: BoxShape.circle,
                ),
                child: Icon(
                  iconData,
                  color: isSelected ? AppColors.primary : iconColor,
                  size: 28,
                ),
              ),
              const SizedBox(width: 16),

              // Text Content
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: AppTypography.titleMedium.copyWith(
                          color: isSelected ? Colors.white : colors.onSurface),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      description,
                      style: GoogleFonts.plusJakartaSans(
                        color: isSelected
                            ? Colors.white.withValues(alpha: 0.85)
                            : colors.onSurfaceVariant,
                        fontSize: 14,
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),

              // Radio Indicator
              Container(
                width: 24,
                height: 24,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: isSelected ? Colors.white : null,
                  border: Border.all(
                    color: isSelected ? Colors.white : colors.outlineVariant,
                    width: isSelected ? 6 : 2,
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
