import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/models/plan_model.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/utils/app_constants.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
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
      final response = await VoltiumApiService().fetchPlans();
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
          _error = 'Connection error: $e';
        }
        _isLoading = false;
      });
    }
  }

  Future<void> _subscribe() async {
    if (_selectedPlanId == null) return;

    setState(() => _isSubmitting = true);
    try {
      final provider = ref.read(riderProvider);
      final riderId = ref.watch(riderProvider).riderId;
      if (riderId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please log in again.')),
          );
        }
        return;
      }
      final hubId = ref.watch(riderProvider).rider?.pickupHub ?? '';
      final selectedPlan = _plans.firstWhere((p) => p.id == _selectedPlanId);
      final securityDeposit =
          AppConstants.getPlanSecurityDeposit(selectedPlan.name);
      await VoltiumApiService().subscribePlan(
        hubId: hubId,
        planId: _selectedPlanId!,
        securityDeposit: securityDeposit,
        advanceRentPaid: _payAdvanceRent,
      );

      // If no exception was thrown, the API call succeeded.
      // Refresh profile to update planDone flag
      await provider.refreshFromApi();
      PostHogService.capture('plan_selected', properties: {
        'plan_id': selectedPlan.id,
        'plan_name': selectedPlan.name,
        'security_deposit': securityDeposit.toString(),
      });
      widget.onNext();
    } catch (e) {
      if (mounted) {
        String errorMessage = 'Failed to subscribe. Please try again.';
        if (e is ApiException) {
          errorMessage = e.message;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMessage),
          ),
        );
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
            : AppColors.purpleIconSurface,
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        'BEST VALUE',
        style: AppTypography.bodySmallStrong.copyWith(
          color: isSelected ? Colors.white : AppColors.purpleIcon,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  List<String> _getPlanFeatures(PlanModel plan) {
    if (plan.features.isNotEmpty) return plan.features;
    final name = plan.name.toLowerCase();
    if (name.contains('weekly')) {
      return [
        'Unlimited Supercharging',
        'Premium Insurance Included',
        'Priority 24/7 Support',
      ];
    } else if (name.contains('daily')) {
      return [
        'Standard Charging Rates',
        'Basic Liability Coverage',
      ];
    } else if (name.contains('monthly')) {
      return [
        'Free Airport Concierge',
        'Unlimited Supercharging',
        'Weekly Full Wash',
      ];
    }
    return [
      'Standard Charging Rates',
      'Basic Liability Coverage',
    ];
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surfaceBright, // Light Slate 50
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
                        child: const Text('Retry'),
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
                                    color: Colors.white,
                                    borderRadius:
                                        BorderRadius.circular(AppRadius.md),
                                    border: Border.all(
                                      color: AppColors.outlineVariant,
                                    ),
                                  ),
                                  child: const Icon(
                                    Icons.arrow_back_ios_new,
                                    size: 18,
                                    color: AppColors.slate800,
                                  ),
                                ),
                              ),
                              const SizedBox(width: 16),
                            ],
                            Expanded(
                              child: Text(
                                'Select a new plan',
                                style: AppTypography.headingMedium.copyWith(
                                    color: AppColors.slate800,
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
                            color: AppColors.slate500,
                            height: 1.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Expanded(
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 20,
                            vertical: 10,
                          ),
                          physics: const BouncingScrollPhysics(),
                          itemCount: _plans.length,
                          itemBuilder: (context, index) {
                            final plan = _plans[index];
                            final isSelected = _selectedPlanId == plan.id;
                            final currentPlanName =
                                ref.read(riderProvider).rider?.currentPlan;
                            final isCurrentPlan = currentPlanName != null &&
                                plan.name.toLowerCase() ==
                                    currentPlanName.toLowerCase();
                            final isBestValue =
                                plan.name.toLowerCase().contains('monthly') ||
                                    plan.name.toLowerCase().contains('elite');

                            final planFeatures = _getPlanFeatures(plan);

                            return GestureDetector(
                              key: Key('planCard_$index'),
                              onTap: () =>
                                  setState(() => _selectedPlanId = plan.id),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 250),
                                curve: Curves.easeInOut,
                                margin: const EdgeInsets.only(bottom: 16),
                                decoration: BoxDecoration(
                                  color: isSelected
                                      ? AppColors.primary
                                      : Colors.white,
                                  borderRadius:
                                      BorderRadius.circular(AppRadius.xl),
                                  border: Border.all(
                                    color: isSelected
                                        ? Colors.transparent
                                        : AppColors.outlineVariant,
                                    width: 1.5,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: isSelected
                                          ? AppColors.primary
                                              .withValues(alpha: 0.2)
                                          : Colors.black
                                              .withValues(alpha: 0.02),
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
                                            MainAxisAlignment.spaceBetween,
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
                                                            .bodySmallStrong
                                                            .copyWith(
                                                          color: Colors.white
                                                              .withValues(
                                                                  alpha: 0.8),
                                                          letterSpacing: 0.5,
                                                        ),
                                                      ),
                                                      const SizedBox(height: 6),
                                                      Row(
                                                        children: [
                                                          if (isBestValue) ...[
                                                            _buildBestValueBadge(
                                                              isSelected: true,
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
                                                                fontSize: 18,
                                                                fontWeight:
                                                                    FontWeight
                                                                        .bold,
                                                                color: Colors
                                                                    .white,
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
                                                          isSelected: false,
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
                                                            fontSize: 16,
                                                            fontWeight:
                                                                FontWeight.bold,
                                                            color: const Color(
                                                              0xFF0F172A,
                                                            ),
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
                                                  decoration: BoxDecoration(
                                                    shape: BoxShape.circle,
                                                    color: Colors.white
                                                        .withValues(
                                                            alpha: 0.15),
                                                    border: Border.all(
                                                      color: Colors.white,
                                                      width: 2,
                                                    ),
                                                  ),
                                                  child: const Center(
                                                    child: Icon(
                                                      Icons.check,
                                                      size: 16,
                                                      color: Colors.white,
                                                    ),
                                                  ),
                                                )
                                              : Container(
                                                  width: 32,
                                                  height: 32,
                                                  decoration: BoxDecoration(
                                                    shape: BoxShape.circle,
                                                    border: Border.all(
                                                      color: const Color(
                                                        0xFFCBD5E1,
                                                      ),
                                                      width: 2,
                                                    ),
                                                  ),
                                                ),
                                        ],
                                      ),
                                      if (plan.description?.isNotEmpty ==
                                          true) ...[
                                        SizedBox(height: 6),
                                        Text(
                                          plan.description ?? '',
                                          style: GoogleFonts.plusJakartaSans(
                                            fontSize: 13,
                                            color: isSelected
                                                ? Colors.white
                                                    .withValues(alpha: 0.8)
                                                : AppColors.slate500,
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 16),
                                      // Features list
                                      ...planFeatures.map(
                                        (feature) => Padding(
                                          padding: const EdgeInsets.only(
                                            bottom: 12,
                                          ),
                                          child: Row(
                                            crossAxisAlignment:
                                                CrossAxisAlignment.start,
                                            children: [
                                              Icon(
                                                _getFeatureIcon(feature),
                                                size: 16,
                                                color: isSelected
                                                    ? Colors.white
                                                        .withValues(alpha: 0.9)
                                                    : AppColors.slate400,
                                              ),
                                              SizedBox(width: 12),
                                              Expanded(
                                                child: Text(
                                                  feature,
                                                  style: GoogleFonts
                                                      .plusJakartaSans(
                                                    fontSize: 14,
                                                    color: isSelected
                                                        ? Colors.white
                                                            .withValues(
                                                                alpha: 0.9)
                                                        : const Color(
                                                            0xFF475569,
                                                          ),
                                                    height: 1.4,
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                      const SizedBox(height: 16),
                                      // Divider
                                      Divider(
                                        color: isSelected
                                            ? Colors.white
                                                .withValues(alpha: 0.15)
                                            : AppColors.iconBackground,
                                        height: 1,
                                      ),
                                      const SizedBox(height: 16),
                                      // Pricing
                                      RichText(
                                        text: TextSpan(
                                          children: [
                                            TextSpan(
                                              text: _formatPrice(plan.price),
                                              style:
                                                  GoogleFonts.plusJakartaSans(
                                                fontSize: 18,
                                                fontWeight: FontWeight.w800,
                                                color: isSelected
                                                    ? Colors.white
                                                    : AppColors.slate900,
                                              ),
                                            ),
                                            TextSpan(
                                              text:
                                                  ' / ${AppConstants.planDurationLabel(plan.durationDays)}',
                                              style: AppTypography
                                                  .bodyMediumEmphasis
                                                  .copyWith(
                                                color: isSelected
                                                    ? Colors.white
                                                        .withValues(alpha: 0.7)
                                                    : AppColors.slate500,
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                    ],
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
                          color: Colors.white,
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
                                        style: AppTypography.bodySmallStrong
                                            .copyWith(
                                          color: AppColors.slate800,
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
                                disabledBackgroundColor: AppColors.borderMedium,
                                padding:
                                    const EdgeInsets.symmetric(vertical: 18),
                                shape: RoundedRectangleBorder(
                                  borderRadius:
                                      BorderRadius.circular(AppRadius.xl),
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
