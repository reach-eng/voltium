import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/models/plan_model.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/services/api_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';

class ChoosePlanScreen extends StatefulWidget {
  final VoidCallback onNext;
  final VoidCallback? onBack;

  const ChoosePlanScreen({super.key, required this.onNext, this.onBack});

  @override
  State<ChoosePlanScreen> createState() => _ChoosePlanScreenState();
}

class _ChoosePlanScreenState extends State<ChoosePlanScreen> {
  List<PlanModel> _plans = [];
  bool _isLoading = true;
  String? _error;
  String? _selectedPlanId;
  bool _isSubmitting = false;

  @override
  void initState() {
    super.initState();
    _fetchPlans();
  }

  Future<void> _fetchPlans() async {
    try {
      final response = await ApiService().fetchPlans();
      if (!mounted) return;
      if (response['success'] == true) {
        final List<dynamic> data = response['data'] ?? [];
        setState(() {
          _plans = data
              .map((e) => PlanModel.fromJson(e as Map<String, dynamic>))
              .toList();
          _isLoading = false;

          // Pre-select the plan matching current plan if any, otherwise default to first plan
          final currentPlanName = context.read<AppProvider>().rider?.currentPlan;
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
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = 'Connection error. Please try again.';
        _isLoading = false;
      });
    }
  }

  Future<void> _subscribe() async {
    if (_selectedPlanId == null) return;

    setState(() => _isSubmitting = true);
    try {
      final provider = context.read<AppProvider>();
      final riderId = provider.rider?.id;
      if (riderId == null) {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            const SnackBar(content: Text('Please log in again.')),
          );
        }
        return;
      }
      final response = await ApiService().subscribePlan(
        riderId: riderId,
        planId: _selectedPlanId!,
      );

      if (response['success'] == true) {
        // Refresh profile to update planDone flag
        await provider.refreshFromApi();
        widget.onNext();
      } else {
        if (mounted) {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
                content: Text(response['message'] ?? 'Subscription failed')),
          );
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
              content: Text('Failed to subscribe. Check your balance.')),
        );
      }
    } finally {
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  String _getDurationLabel(int days) {
    if (days == 1) return 'day';
    if (days == 7) return 'week';
    if (days == 30) return 'month';
    return '$days days';
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
    } else if (f.contains('insurance') || f.contains('liability') || f.contains('coverage') || f.contains('secure')) {
      return Icons.shield_outlined;
    } else if (f.contains('support') || f.contains('24/7') || f.contains('help')) {
      return Icons.headset_mic_outlined;
    } else if (f.contains('airport') || f.contains('concierge') || f.contains('star')) {
      return Icons.star_rounded;
    } else if (f.contains('wash') || f.contains('clean') || f.contains('water')) {
      return Icons.local_car_wash_rounded;
    }
    return Icons.check_circle_outline_rounded; // Default fallback
  }

  Widget _buildBestValueBadge({required bool isSelected}) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: isSelected ? Colors.white.withOpacity(0.2) : const Color(0xFFF3E8FF),
        borderRadius: BorderRadius.circular(6),
      ),
      child: Text(
        'BEST VALUE',
        style: TextStyle(
          fontSize: 9,
          fontWeight: FontWeight.w800,
          color: isSelected ? Colors.white : const Color(0xFF7E22CE),
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
      backgroundColor: const Color(0xFFF8FAFC), // Light Slate 50
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Text(_error!, style: const TextStyle(color: AppColors.error)),
                      const SizedBox(height: 16),
                      ElevatedButton(onPressed: _fetchPlans, child: const Text('Retry')),
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
                                borderRadius: BorderRadius.circular(12),
                                child: Container(
                                  padding: const EdgeInsets.all(12),
                                  decoration: BoxDecoration(
                                    color: Colors.white,
                                    borderRadius: BorderRadius.circular(12),
                                    border: Border.all(color: const Color(0xFFE2E8F0)),
                                  ),
                                  child: const Icon(Icons.arrow_back_ios_new, size: 18, color: Color(0xFF1E293B)),
                                ),
                              ),
                              const SizedBox(width: 16),
                            ],
                            const Expanded(
                              child: Text(
                                'Select a new plan',
                                style: TextStyle(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w900,
                                  color: Color(0xFF1E293B),
                                  letterSpacing: -0.5,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const Padding(
                        padding: EdgeInsets.symmetric(horizontal: 20),
                        child: Text(
                          'Choose the rental duration that best fits your needs. You can change this at any time.',
                          style: TextStyle(
                            fontSize: 14,
                            color: Color(0xFF64748B),
                            height: 1.5,
                          ),
                        ),
                      ),
                      const SizedBox(height: 24),
                      Expanded(
                        child: ListView.builder(
                          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                          physics: const BouncingScrollPhysics(),
                          itemCount: _plans.length,
                          itemBuilder: (context, index) {
                            final plan = _plans[index];
                            final isSelected = _selectedPlanId == plan.id;
                            final currentPlanName = context.read<AppProvider>().rider?.currentPlan;
                            final isCurrentPlan = currentPlanName != null &&
                                plan.name.toLowerCase() == currentPlanName.toLowerCase();
                            final isBestValue = plan.name.toLowerCase().contains('monthly') ||
                                plan.name.toLowerCase().contains('elite');

                            final planFeatures = _getPlanFeatures(plan);

                            return GestureDetector(
                              key: Key('planCard_$index'),
                              onTap: () => setState(() => _selectedPlanId = plan.id),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 250),
                                curve: Curves.easeInOut,
                                margin: const EdgeInsets.only(bottom: 16),
                                decoration: BoxDecoration(
                                  color: isSelected ? const Color(0xFF0053C1) : Colors.white,
                                  borderRadius: BorderRadius.circular(24),
                                  border: Border.all(
                                    color: isSelected ? Colors.transparent : const Color(0xFFE2E8F0),
                                    width: 1.5,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: isSelected
                                          ? const Color(0xFF0053C1).withOpacity(0.2)
                                          : Colors.black.withOpacity(0.02),
                                      blurRadius: 16,
                                      offset: const Offset(0, 8),
                                    ),
                                  ],
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(24),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      // Top Header row of Card
                                      Row(
                                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                        children: [
                                          Expanded(
                                            child: isSelected
                                                ? Column(
                                                    crossAxisAlignment: CrossAxisAlignment.start,
                                                    children: [
                                                      Text(
                                                        isCurrentPlan ? 'CURRENT PLAN' : 'SELECTED PLAN',
                                                        style: TextStyle(
                                                          fontSize: 11,
                                                          fontWeight: FontWeight.w800,
                                                          color: Colors.white.withOpacity(0.8),
                                                          letterSpacing: 0.5,
                                                        ),
                                                      ),
                                                      const SizedBox(height: 6),
                                                      Row(
                                                        children: [
                                                          if (isBestValue) ...[
                                                            _buildBestValueBadge(isSelected: true),
                                                            const SizedBox(width: 8),
                                                          ],
                                                          Expanded(
                                                            child: Text(
                                                              plan.name,
                                                              style: const TextStyle(
                                                                fontSize: 18,
                                                                fontWeight: FontWeight.bold,
                                                                color: Colors.white,
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
                                                        _buildBestValueBadge(isSelected: false),
                                                        const SizedBox(width: 8),
                                                      ],
                                                      Expanded(
                                                        child: Text(
                                                          plan.name,
                                                          style: const TextStyle(
                                                            fontSize: 16,
                                                            fontWeight: FontWeight.bold,
                                                            color: Color(0xFF0F172A),
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
                                                    color: Colors.white.withOpacity(0.15),
                                                    border: Border.all(color: Colors.white, width: 2),
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
                                                      color: const Color(0xFFCBD5E1),
                                                      width: 2,
                                                    ),
                                                  ),
                                                ),
                                        ],
                                      ),
                                      if (plan.description.isNotEmpty) ...[
                                        const SizedBox(height: 6),
                                        Text(
                                          plan.description,
                                          style: TextStyle(
                                            fontSize: 13,
                                            color: isSelected
                                                ? Colors.white.withOpacity(0.8)
                                                : const Color(0xFF64748B),
                                          ),
                                        ),
                                      ],
                                      const SizedBox(height: 16),
                                      // Features list
                                      ...planFeatures.map((feature) => Padding(
                                            padding: const EdgeInsets.only(bottom: 12),
                                            child: Row(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Icon(
                                                  _getFeatureIcon(feature),
                                                  size: 16,
                                                  color: isSelected
                                                      ? Colors.white.withOpacity(0.9)
                                                      : const Color(0xFF94A3B8),
                                                ),
                                                const SizedBox(width: 12),
                                                Expanded(
                                                  child: Text(
                                                    feature,
                                                    style: TextStyle(
                                                      fontSize: 14,
                                                      color: isSelected
                                                          ? Colors.white.withOpacity(0.9)
                                                          : const Color(0xFF475569),
                                                      height: 1.4,
                                                    ),
                                                  ),
                                                ),
                                              ],
                                            ),
                                          )),
                                      const SizedBox(height: 16),
                                      // Divider
                                      Divider(
                                        color: isSelected
                                            ? Colors.white.withOpacity(0.15)
                                            : const Color(0xFFF1F5F9),
                                        height: 1,
                                      ),
                                      const SizedBox(height: 16),
                                      // Pricing
                                      RichText(
                                        text: TextSpan(
                                          children: [
                                            TextSpan(
                                              text: _formatPrice(plan.price),
                                              style: TextStyle(
                                                fontSize: 18,
                                                fontWeight: FontWeight.w900,
                                                color: isSelected ? Colors.white : const Color(0xFF0F172A),
                                              ),
                                            ),
                                            TextSpan(
                                              text: ' / ${_getDurationLabel(plan.durationDays)}',
                                              style: TextStyle(
                                                fontSize: 14,
                                                fontWeight: FontWeight.w600,
                                                color: isSelected
                                                    ? Colors.white.withOpacity(0.7)
                                                    : const Color(0xFF64748B),
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
                        padding: const EdgeInsets.all(24),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          boxShadow: [
                            BoxShadow(
                              color: Colors.black.withOpacity(0.05),
                              blurRadius: 20,
                              offset: const Offset(0, -5),
                            ),
                          ],
                        ),
                        child: ElevatedButton(
                          key: const Key('confirmPlanButton'),
                          onPressed: _selectedPlanId == null || _isSubmitting ? null : _subscribe,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0053C1),
                            disabledBackgroundColor: const Color(0xFFCBD5E1),
                            padding: const EdgeInsets.symmetric(vertical: 18),
                            shape: RoundedRectangleBorder(
                              borderRadius: BorderRadius.circular(24),
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
                                      child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                                  : const Text(
                                      'Confirm New Plan',
                                      style: TextStyle(
                                        fontSize: 16,
                                        fontWeight: FontWeight.w700,
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
    );
  }
}
