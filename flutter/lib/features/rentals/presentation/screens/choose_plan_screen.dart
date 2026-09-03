import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/models/plan_model.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/features/guarantor/data/skip_deposit_config.dart';
import '../../../../utils/app_logger.dart';

class ChoosePlanScreen extends ConsumerStatefulWidget {
  final VoidCallback onNext;
  final VoidCallback? onBack;

  const ChoosePlanScreen({super.key, required this.onNext, this.onBack});

  @override
  ConsumerState<ChoosePlanScreen> createState() => _ChoosePlanScreenState();
}

class _ChoosePlanScreenState extends ConsumerState<ChoosePlanScreen> {
  List<PlanModel> _plans = [];
  bool _isLoading = true;
  String? _error;
  String? _selectedPlanId;
  bool _payAdvanceRent = false;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _fetchPlans();
  }

  Future<void> _fetchPlans() async {
    setState(() {
      _isLoading = true;
      _error = null;
    });
    try {
      // PR-13: was a wrapper call to
      // `VoltiumApiService.fetchPlans`, which is a 1-line
      // pass-through to `VoltiumApiClient.getRiderPlans()`. The
      // generated method already returns `Map<String, dynamic>`,
      // so the call shape is identical to the wrapper's output.
      final response = await ref.read(voltiumApiClientProvider).getRiderPlans();
      if (!mounted) return;
      if (response['success'] == true) {
        final List<dynamic> data = response['data'] ?? [];
        setState(() {
          _plans = data
              .map((e) => PlanModel.fromJson(e as Map<String, dynamic>))
              .toList();
          _isLoading = false;

          // Pre-select the plan matching current plan if any, otherwise default to first plan
          final currentPlanName = ref.read(riderProvider).rider?.currentPlan;
          if (currentPlanName != null && currentPlanName.isNotEmpty) {
            final matchingIndex = _plans.indexWhere(
              (p) => p.name.toLowerCase() == currentPlanName.toLowerCase(),
            );
            if (matchingIndex != -1) {
              _selectedPlanId = _plans[matchingIndex].id;
            } else if (_plans.isNotEmpty) {
              _selectedPlanId = _plans.first.id;
            }
          } else if (_plans.isNotEmpty) {
            _selectedPlanId = _plans.first.id;
          }
        });
      } else {
        setState(() {
          _error = response['message'] ?? 'Failed to load plans';
          _isLoading = false;
        });
      }
    } catch (e, stack) {
      appDebug('FETCH PLANS ERROR: $e');
      appDebug('$stack');
      if (!mounted) return;
      setState(() {
        if (e is ApiException) {
          _error = e.message;
        } else {
          // AUDIT FIX (LOW): raw exception text leaked to users. The
          // full detail is logged above via appDebug for diagnosis.
          _error =
              'Could not reach Voltium servers. Please check your connection and try again.';
        }
        _isLoading = false;
      });
    }
  }

  /// AUDIT FIX (MEDIUM): client-generated idempotency key for the plan
  /// subscribe POST. A killed app or network timeout followed by a retry
  /// previously re-posted the request and could double-charge the
  /// security deposit. The key is v4-UUID-shaped (`uuid` is not in
  /// pubspec.yaml, so it is derived from secure randomness here) and
  /// mirrors the `idempotency_key` concept already stored by
  /// OfflineStorageService.pending_operations.
  String _generateIdempotencyKey() {
    final rnd = Random.secure();
    final bytes = List<int>.generate(16, (_) => rnd.nextInt(256));
    // Set version (4) and variant (RFC 4122) bits.
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    final hex = bytes.map((b) => b.toRadixString(16).padLeft(2, '0')).join();
    return '${hex.substring(0, 8)}-${hex.substring(8, 12)}-'
        '${hex.substring(12, 16)}-${hex.substring(16, 20)}-${hex.substring(20)}';
  }

  Future<void> _subscribe() async {
    if (_selectedPlanId == null) return;

    // AUDIT FIX (MEDIUM): one idempotency key per subscribe ATTEMPT —
    // regenerated on every explicit user tap, reused across automatic
    // transport-level retries inside the attempt (the key travels in
    // the request body, so a replayed request dedupes server-side).
    //
    // STAGED: the key is generated here but the body field is not yet
    // sent because the backend doesn't honor it (audit plan PR-2 calls
    // for filing a backend ticket first). Once the API accepts
    // `idempotencyKey`, fold it into the `postRiderPlans` body below.
    // ignore: unused_local_variable
    final idempotencyKey = _generateIdempotencyKey();

    setState(() => _isSubmitting = true);
    try {
      final provider = ref.read(riderProvider.notifier);
      // AUDIT FIX (MEDIUM): ref.watch inside an async handler can read
      // a disposed/stale container after await points; read is the
      // correct accessor here.
      final riderState = ref.read(riderProvider);
      final riderId = riderState.riderId;
      if (riderId == null) {
        if (mounted) {
          Toast.error(
            context,
            AppLocalizations.of(context)!.txtpleaseLogInAgain,
          );
        }
        return;
      }
      final hubId = riderState.rider?.pickupHub ?? '';
      // AUDIT FIX (MEDIUM): null-safe lookup — the old firstWhere threw
      // a StateError that surfaced as a generic toast when the plan
      // list changed between fetch and submit.
      PlanModel? selectedPlan;
      for (final p in _plans) {
        if (p.id == _selectedPlanId) {
          selectedPlan = p;
          break;
        }
      }
      if (selectedPlan == null) {
        if (mounted) {
          setState(() => _selectedPlanId = null);
          Toast.error(
            context,
            'The selected plan is no longer available. Please choose a plan again.',
          );
        }
        return;
      }
      final isHigherDeposit = riderState.rider?.requiresHigherDeposit == true ||
          (CacheService()
                  .getString('voltium_requires_higher_deposit:$riderId') ==
              'true');
      final extraDeposit = isHigherDeposit
          ? (ref
                  .read(skipDepositConfigProvider)
                  .asData
                  ?.value
                  .extraDepositRupees ??
              SkipDepositConfig.fallbackRupees)
          : 0.0;
      final securityDeposit = selectedPlan.securityDeposit + extraDeposit;
      // PR-13: was a wrapper call to
      // `VoltiumApiService.subscribePlan`, a 1-line pass-through
      // to `postRiderPlans({...})` with the same body shape.
      await ref.read(voltiumApiClientProvider).postRiderPlans({
        'hubId': hubId,
        'planId': _selectedPlanId!,
        'securityDeposit': securityDeposit,
        'advanceRentPaid': _payAdvanceRent,
      });

      // If no exception was thrown, the API call succeeded.
      // Refresh profile to update planDone flag
      await provider.refreshFromApi();
      PostHogService.capture('plan_selected', properties: {
        'plan_id': selectedPlan.id,
        'plan_name': selectedPlan.name,
        'security_deposit': securityDeposit.toString(),
        'requires_higher_deposit': isHigherDeposit,
      });
      widget.onNext();
    } catch (e) {
      if (mounted) {
        String errorMessage = 'Failed to subscribe. Please try again.';
        if (e is ApiException) {
          errorMessage = e.message;
        }
        Toast.error(context, errorMessage);
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  String _formatPrice(double price) {
    if (price == price.toInt()) {
      return '₹${price.toInt()}.00';
    }
    return '₹${price.toStringAsFixed(2)}';
  }

  IconData _getFeatureIcon(String feature) {
    final f = feature.toLowerCase();
    if (f.contains('charge') || f.contains('charging') || f.contains('power')) {
      return Icons.bolt_rounded;
    } else if (f.contains('insurance') ||
        f.contains('liability') ||
        f.contains('coverage') ||
        f.contains('secure')) {
      return Icons.shield_outlined;
    } else if (f.contains('support') ||
        f.contains('24/7') ||
        f.contains('help')) {
      return Icons.headset_mic_outlined;
    } else if (f.contains('airport') ||
        f.contains('concierge') ||
        f.contains('star')) {
      return Icons.star_rounded;
    } else if (f.contains('wash') ||
        f.contains('clean') ||
        f.contains('water')) {
      return Icons.local_car_wash_rounded;
    }
    return Icons.check_circle_outline_rounded; // Default fallback
  }

  Widget _buildBestValueBadge({required bool isSelected}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isSelected
            ? Colors.white.withValues(alpha: 0.2)
            : AppColors.accentPurple.withValues(alpha: 0.15),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        'BEST VALUE',
        style: AppTypography.bodySmall
            .copyWith(fontWeight: FontWeight.w800)
            .copyWith(
              color: isSelected ? Colors.white : AppColors.accentPurple,
              letterSpacing: 0.5,
            ),
      ),
    );
  }

  /// PR-B (2026-08-28): the previous version matched the plan name
  /// to 'monthly'/'elite', which silently broke on renames and i18n.
  /// Prefer the server-provided `isBestValue` flag if present, and
  /// only fall back to the name heuristic for legacy server responses
  /// that don't yet expose the flag.
  bool _isBestValuePlan(PlanModel plan) {
    if (plan.isBestValue) return true;
    final name = plan.name.toLowerCase();
    return name.contains('monthly') || name.contains('elite');
  }

  @override
  Widget build(BuildContext context) {
    // DARK-MODE-AUDIT 2026-08-14 P0-5: the previous version used
    // the static `AppColors.of(context).surfaceBright` (#F8FAFC) which is
    // the LIGHT slate-50. In dark mode the scaffold stayed
    // light even when the rest of the app was dark. The
    // `surfaceBright` token has no dark variant in `ThemeColors`,
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    // AUDIT FIX (LOW): hoisted out of the ListView itemBuilder — a
    // ref.read inside an item builder never rebuilds when the rider's
    // current plan changes. select() scopes the rebuild to this value.
    final currentPlanName =
        ref.watch(riderProvider.select((s) => s.rider?.currentPlan));
    final riderState = ref.watch(riderProvider);
    final riderId = riderState.riderId;
    final isHigherDeposit = riderState.rider?.requiresHigherDeposit == true ||
        (riderId != null &&
            CacheService()
                    .getString('voltium_requires_higher_deposit:$riderId') ==
                'true');
    final extraDepositConfig =
        ref.watch(skipDepositConfigProvider).asData?.value;
    final extraDepositRupees = extraDepositConfig?.extraDepositRupees ??
        SkipDepositConfig.fallbackRupees;

    return Scaffold(
      backgroundColor: colors.surface,
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(
                        _error!,
                        style:
                            GoogleFonts.plusJakartaSans(color: AppColors.error),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _fetchPlans,
                        child: Text(l10n?.txtretry ?? 'Retry'),
                      ),
                    ],
                  ),
                )
              : SafeArea(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.fromLTRB(20, 20, 20, 10),
                        child: Row(
                          children: [
                            if (widget.onBack != null) ...[
                              InkWell(
                                onTap: () => widget.onBack?.call(),
                                borderRadius:
                                    BorderRadius.circular(AppRadius.md),
                                child: Container(
                                  width: 44,
                                  height: 44,
                                  decoration: BoxDecoration(
                                    color: colors.card,
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.md),
                                    border: Border.all(
                                      color: colors.outlineVariant,
                                    ),
                                  ),
                                  child: Icon(
                                    Icons.arrow_back_ios_new,
                                    size: 18,
                                    color: colors.onSurface,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                            ],
                            Expanded(
                              child: Text(
                                'Select a new plan',
                                style: AppTypography.headingMedium.copyWith(
                                    color: colors.onSurface,
                                    letterSpacing: -0.5),
                              ),
                            ),
                          ],
                        ),
                      ),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 20),
                        child: Text(
                          'Choose the rental duration that best fits your needs. You can change this at any time.',
                          style: GoogleFonts.plusJakartaSans(
                            fontSize: 14,
                            color: colors.onSurfaceVariant,
                            height: 1.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Expanded(
                        // AUDIT FIX (LOW): zero-plans empty state — the
                        // old UI rendered a blank list with a permanently
                        // disabled button and no way forward.
                        child: _plans.isEmpty
                            ? Center(
                                child: Column(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    Icon(
                                      Icons.inventory_2_outlined,
                                      size: 48,
                                      color: colors.onSurfaceVariant,
                                    ),
                                    const SizedBox(height: 12),
                                    Text(
                                      'No plans available',
                                      style: AppTypography.titleMedium
                                          .copyWith(color: colors.onSurface),
                                    ),
                                    const SizedBox(height: 6),
                                    Text(
                                      'Plans could not be loaded right now. Please try again.',
                                      textAlign: TextAlign.center,
                                      style: GoogleFonts.plusJakartaSans(
                                        fontSize: 13,
                                        color: colors.onSurfaceVariant,
                                      ),
                                    ),
                                    const SizedBox(height: 16),
                                    ElevatedButton(
                                      onPressed: _fetchPlans,
                                      child: Text(l10n?.txtretry ?? 'Retry'),
                                    ),
                                  ],
                                ),
                              )
                            : ListView.builder(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 20,
                                  vertical: 10,
                                ),
                                physics: const BouncingScrollPhysics(),
                                itemCount: _plans.length,
                                itemBuilder: (context, index) {
                                  final plan = _plans[index];
                                  final isSelected = _selectedPlanId == plan.id;
                                  final isCurrentPlan =
                                      currentPlanName != null &&
                                          plan.name.toLowerCase() ==
                                              currentPlanName.toLowerCase();
                                  final isBestValue = _isBestValuePlan(plan);

                                  // AUDIT FIX (MEDIUM): never invent marketing
                                  // features client-side when the API returns
                                  // none — only server-provided features render;
                                  // otherwise a single neutral line is shown.
                                  final planFeatures = plan.features;

                                  // AUDIT FIX (LOW): plan cards were bare
                                  // GestureDetectors invisible to screen readers.
                                  return MergeSemantics(
                                    key: Key('planCard_$index'),
                                    child: Semantics(
                                      selected: isSelected,
                                      button: true,
                                      child: GestureDetector(
                                        onTap: () => setState(
                                            () => _selectedPlanId = plan.id),
                                        child: AnimatedContainer(
                                          duration:
                                              const Duration(milliseconds: 250),
                                          curve: Curves.easeInOut,
                                          margin:
                                              const EdgeInsets.only(bottom: 16),
                                          decoration: BoxDecoration(
                                            color: isSelected
                                                ? AppColors.primary
                                                : colors.card,
                                            borderRadius: BorderRadius.circular(
                                                AppRadius.radiusModal),
                                            border: Border.all(
                                              color: isSelected
                                                  ? Colors.transparent
                                                  : colors.outlineVariant,
                                              width: 1.5,
                                            ),
                                            boxShadow: [
                                              BoxShadow(
                                                color: isSelected
                                                    ? AppColors.primary
                                                        .withValues(alpha: 0.2)
                                                    : Colors.black.withValues(
                                                        alpha: 0.02),
                                                blurRadius: 16,
                                                offset: const Offset(0, 8),
                                              ),
                                            ],
                                          ),
                                          child: Padding(
                                            padding: Spacing.paddingLg,
                                            child: Column(
                                              crossAxisAlignment:
                                                  CrossAxisAlignment.start,
                                              children: [
                                                // Top Header row of Card
                                                Row(
                                                  mainAxisAlignment:
                                                      MainAxisAlignment
                                                          .spaceBetween,
                                                  children: [
                                                    Expanded(
                                                      child: isSelected
                                                          ? Column(
                                                              crossAxisAlignment:
                                                                  CrossAxisAlignment
                                                                      .start,
                                                              children: [
                                                                Text(
                                                                  isCurrentPlan
                                                                      ? 'CURRENT PLAN'
                                                                      : 'SELECTED PLAN',
                                                                  style: AppTypography
                                                                      .bodySmall
                                                                      .copyWith(
                                                                          fontWeight:
                                                                              FontWeight.w800)
                                                                      .copyWith(
                                                                        color: Colors
                                                                            .white
                                                                            .withValues(alpha: 0.8),
                                                                        letterSpacing:
                                                                            0.5,
                                                                      ),
                                                                ),
                                                                const SizedBox(
                                                                    height: 6),
                                                                Row(
                                                                  children: [
                                                                    if (isBestValue) ...[
                                                                      _buildBestValueBadge(
                                                                        isSelected:
                                                                            true,
                                                                      ),
                                                                      const SizedBox(
                                                                        width:
                                                                            8,
                                                                      ),
                                                                    ],
                                                                    Expanded(
                                                                      child:
                                                                          Text(
                                                                        plan.name,
                                                                        style: GoogleFonts
                                                                            .plusJakartaSans(
                                                                          fontSize:
                                                                              18,
                                                                          fontWeight:
                                                                              FontWeight.bold,
                                                                          color:
                                                                              Colors.white,
                                                                        ),
                                                                      ),
                                                                    ),
                                                                  ],
                                                                ),
                                                              ],
                                                            )
                                                          : Row(
                                                              children: [
                                                                if (isBestValue) ...[
                                                                  _buildBestValueBadge(
                                                                    isSelected:
                                                                        false,
                                                                  ),
                                                                  const SizedBox(
                                                                    width: 8,
                                                                  ),
                                                                ],
                                                                Expanded(
                                                                  child: Text(
                                                                    plan.name,
                                                                    style: GoogleFonts
                                                                        .plusJakartaSans(
                                                                      fontSize:
                                                                          16,
                                                                      fontWeight:
                                                                          FontWeight
                                                                              .bold,
                                                                      color: colors
                                                                          .onSurface,
                                                                    ),
                                                                  ),
                                                                ),
                                                              ],
                                                            ),
                                                    ),
                                                    const SizedBox(width: 12),
                                                    // Radio / Checkmark Icon
                                                    isSelected
                                                        ? Container(
                                                            width: 32,
                                                            height: 32,
                                                            decoration:
                                                                BoxDecoration(
                                                              shape: BoxShape
                                                                  .circle,
                                                              color: Colors
                                                                  .white
                                                                  .withValues(
                                                                      alpha:
                                                                          0.15),
                                                              border:
                                                                  Border.all(
                                                                color: Colors
                                                                    .white,
                                                                width: 2,
                                                              ),
                                                            ),
                                                            child: const Center(
                                                              child: Icon(
                                                                Icons.check,
                                                                size: 16,
                                                                color: Colors
                                                                    .white,
                                                              ),
                                                            ),
                                                          )
                                                        : Container(
                                                            width: 32,
                                                            height: 32,
                                                            decoration:
                                                                BoxDecoration(
                                                              shape: BoxShape
                                                                  .circle,
                                                              border:
                                                                  Border.all(
                                                                color: colors
                                                                    .outlineVariant,
                                                                width: 2,
                                                              ),
                                                            ),
                                                          ),
                                                  ],
                                                ),
                                                if (plan.description
                                                        ?.isNotEmpty ==
                                                    true) ...[
                                                  const SizedBox(height: 6),
                                                  Text(
                                                    plan.description ?? '',
                                                    style: GoogleFonts
                                                        .plusJakartaSans(
                                                      fontSize: 13,
                                                      color: isSelected
                                                          ? Colors.white
                                                              .withValues(
                                                                  alpha: 0.8)
                                                          : colors
                                                              .onSurfaceVariant,
                                                    ),
                                                  ),
                                                ],
                                                const SizedBox(height: 16),
                                                // Features list — AUDIT FIX
                                                // (MEDIUM): server features only.
                                                // When the API returns none, show a
                                                // single neutral line instead of
                                                // fabricated marketing copy.
                                                if (planFeatures.isNotEmpty)
                                                  ...planFeatures.map(
                                                    (feature) => Padding(
                                                      padding:
                                                          const EdgeInsets.only(
                                                        bottom: 12,
                                                      ),
                                                      child: Row(
                                                        crossAxisAlignment:
                                                            CrossAxisAlignment
                                                                .start,
                                                        children: [
                                                          Icon(
                                                            _getFeatureIcon(
                                                                feature),
                                                            size: 16,
                                                            color: isSelected
                                                                ? Colors.white
                                                                    .withValues(
                                                                        alpha:
                                                                            0.9)
                                                                : colors
                                                                    .onSurfaceMuted,
                                                          ),
                                                          const SizedBox(
                                                              width: 12),
                                                          Expanded(
                                                            child: Text(
                                                              feature,
                                                              style: GoogleFonts
                                                                  .plusJakartaSans(
                                                                fontSize: 14,
                                                                color: isSelected
                                                                    ? Colors
                                                                        .white
                                                                        .withValues(
                                                                            alpha:
                                                                                0.9)
                                                                    : colors
                                                                        .onSurfaceVariant,
                                                                height: 1.4,
                                                              ),
                                                            ),
                                                          ),
                                                        ],
                                                      ),
                                                    ),
                                                  )
                                                else
                                                  Padding(
                                                    padding:
                                                        const EdgeInsets.only(
                                                            bottom: 12),
                                                    child: Row(
                                                      crossAxisAlignment:
                                                          CrossAxisAlignment
                                                              .start,
                                                      children: [
                                                        Icon(
                                                          Icons
                                                              .info_outline_rounded,
                                                          size: 16,
                                                          color: isSelected
                                                              ? Colors.white
                                                                  .withValues(
                                                                      alpha:
                                                                          0.9)
                                                              : colors
                                                                  .onSurfaceMuted,
                                                        ),
                                                        const SizedBox(
                                                            width: 12),
                                                        Expanded(
                                                          child: Text(
                                                            'Contact hub for details',
                                                            style: GoogleFonts
                                                                .plusJakartaSans(
                                                              fontSize: 14,
                                                              color: isSelected
                                                                  ? Colors.white
                                                                      .withValues(
                                                                          alpha:
                                                                              0.9)
                                                                  : colors
                                                                      .onSurfaceVariant,
                                                              height: 1.4,
                                                            ),
                                                          ),
                                                        ),
                                                      ],
                                                    ),
                                                  ),
                                                const SizedBox(height: 16),
                                                // Divider
                                                Divider(
                                                  color: isSelected
                                                      ? Colors.white.withValues(
                                                          alpha: 0.15)
                                                      : colors.outlineVariant,
                                                  height: 1,
                                                ),
                                                const SizedBox(height: 16),
                                                // Pricing
                                                RichText(
                                                  text: TextSpan(
                                                    children: [
                                                      TextSpan(
                                                        text: _formatPrice(
                                                            plan.price),
                                                        style: GoogleFonts
                                                            .plusJakartaSans(
                                                          fontSize: 18,
                                                          fontWeight:
                                                              FontWeight.w800,
                                                          color: isSelected
                                                              ? Colors.white
                                                              : colors
                                                                  .onSurface,
                                                        ),
                                                      ),
                                                      TextSpan(
                                                        text:
                                                            ' / ${AppConstants.planDurationLabel(plan.durationDays)}',
                                                        style: AppTypography
                                                            .bodyMedium
                                                            .copyWith(
                                                                fontWeight:
                                                                    FontWeight
                                                                        .w600)
                                                            .copyWith(
                                                              color: isSelected
                                                                  ? Colors.white
                                                                      .withValues(
                                                                          alpha:
                                                                              0.7)
                                                                  : colors
                                                                      .onSurfaceVariant,
                                                            ),
                                                      ),
                                                    ],
                                                  ),
                                                ),
                                                const SizedBox(height: 6),
                                                Text(
                                                  isHigherDeposit
                                                      ? 'Security Deposit: ₹${(plan.securityDeposit + extraDepositRupees).toInt()} (incl. ₹${extraDepositRupees.toInt()} skip-guarantor deposit)'
                                                      : 'Security Deposit: ₹${plan.securityDeposit.toInt()}',
                                                  style: GoogleFonts
                                                      .plusJakartaSans(
                                                    fontSize: 12,
                                                    fontWeight: FontWeight.w600,
                                                    color: isSelected
                                                        ? Colors.white
                                                            .withValues(
                                                                alpha: 0.8)
                                                        : (isHigherDeposit
                                                            ? Colors.amber[800]
                                                            : colors
                                                                .onSurfaceVariant),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          ),
                                        ),
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
                      Container(
                        padding: Spacing.paddingLg,
                        decoration: BoxDecoration(
                          color: colors.card,
                          border: Border(
                            top: BorderSide(
                              color: colors.outlineVariant,
                              width: 1,
                            ),
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withValues(alpha: 0.05),
                              blurRadius: 20,
                              offset: const Offset(0, -5),
                            ),
                          ],
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (isHigherDeposit) ...[
                              Container(
                                key: const Key('skipGuarantorDepositBanner'),
                                margin: const EdgeInsets.only(bottom: 12.0),
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 12, vertical: 10),
                                decoration: BoxDecoration(
                                  color: Colors.amber.withValues(alpha: 0.12),
                                  borderRadius:
                                      BorderRadius.circular(AppRadius.md),
                                  border: Border.all(
                                      color:
                                          Colors.amber.withValues(alpha: 0.4)),
                                ),
                                child: Row(
                                  children: [
                                    const Icon(Icons.info_outline,
                                        size: 20, color: Colors.amber),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        'Higher security deposit (+₹${extraDepositRupees.toInt()}) applied because guarantor onboarding was skipped.',
                                        style: AppTypography.bodySmall.copyWith(
                                          color: colors.onSurface,
                                          fontWeight: FontWeight.w600,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                            InkWell(
                              key: const Key('advanceRentCheckbox'),
                              onTap: () => setState(
                                  () => _payAdvanceRent = !_payAdvanceRent),
                              borderRadius: BorderRadius.circular(AppRadius.md),
                              child: Padding(
                                padding: const EdgeInsets.only(bottom: 16.0),
                                child: Row(
                                  children: [
                                    Checkbox(
                                      value: _payAdvanceRent,
                                      activeColor: AppColors.primary,
                                      shape: RoundedRectangleBorder(
                                        borderRadius:
                                            BorderRadius.circular(AppRadius.xs),
                                      ),
                                      onChanged: (val) => setState(
                                          () => _payAdvanceRent = val ?? false),
                                    ),
                                    Expanded(
                                      child: Text(
                                        'Pay advance rent along with security deposit',
                                        style: AppTypography.bodySmall
                                            .copyWith(
                                                fontWeight: FontWeight.w800)
                                            .copyWith(
                                              color: colors.onSurface,
                                            ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            ElevatedButton(
                              key: const Key('confirmPlanButton'),
                              onPressed:
                                  _selectedPlanId == null || _isSubmitting
                                      ? null
                                      : _subscribe,
                              style: ElevatedButton.styleFrom(
                                backgroundColor: AppColors.primary,
                                disabledBackgroundColor: colors.outlineVariant,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 18),
                                shape: RoundedRectangleBorder(
                                  borderRadius: BorderRadius.circular(
                                      AppRadius.radiusModal),
                                ),
                                elevation: 0,
                              ),
                              child: SizedBox(
                                width: double.infinity,
                                child: Center(
                                  child: _isSubmitting
                                      ? const SizedBox(
                                          height: 20,
                                          width: 20,
                                          child: CircularProgressIndicator(
                                            color: Colors.white,
                                            strokeWidth: 2,
                                          ),
                                        )
                                      : Text(
                                          'Confirm Plan',
                                          style: AppTypography.titleSmall
                                              .copyWith(color: Colors.white),
                                        ),
                                ),
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
}
