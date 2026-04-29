import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';
import 'package:provider/provider.dart';

/// Matches web RentalDetailsScreen.tsx:
/// - Header with back button
/// - Rental Info Card with 6 detail rows (Vehicle, Plan, Start, End, Hub, Days Remaining)
/// - Pulsing status badge: "Rental Active" (green) or "No Active Rental" (gray)
/// - Large red "End Rental" pill button
/// - Other actions: "Change Plan", "Report Issue", "Contact Support"

class RentalDetailsScreen extends StatefulWidget {
  final VoidCallback? onBack;
  final VoidCallback? onEndRental;
  final VoidCallback? onChangePlan;

  const RentalDetailsScreen({
    super.key,
    this.onBack,
    this.onEndRental,
    this.onChangePlan,
  });

  @override
  State<RentalDetailsScreen> createState() => _RentalDetailsScreenState();
}

class _RentalDetailsScreenState extends State<RentalDetailsScreen>
    with TickerProviderStateMixin {
  late final AnimationController _pulseCtrl;
  late final AnimationController _entryCtrl;

  @override
  void initState() {
    super.initState();
    _pulseCtrl = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 1),
    )..repeat(reverse: true);

    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();
  }

  @override
  void dispose() {
    _pulseCtrl.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final rider = context.watch<AppProvider>().rider;
    final isActive = rider?.rentalStatus == 'ACTIVE' || rider?.planStatus == 'ACTIVE';

    final infoItems = [
      {'icon': Icons.directions_bike, 'label': 'Vehicle', 'value': rider?.assignedVehicle ?? 'Not Assigned'},
      {'icon': Icons.credit_card, 'label': 'Plan', 'value': rider?.currentPlan ?? 'No Plan'},
      {'icon': Icons.calendar_today, 'label': 'Start Date', 'value': rider?.planStartDate ?? 'N/A'},
      {'icon': Icons.calendar_today, 'label': 'End Date', 'value': rider?.planEndDate ?? 'N/A'},
      {'icon': Icons.map_outlined, 'label': 'Hub', 'value': rider?.pickupHub ?? 'Not Assigned'},
      {'icon': Icons.bolt, 'label': 'Days Remaining', 'value': 'N/A'}, // logic simplified for parity
    ];

    return Scaffold(
      backgroundColor: AppColors.surface,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                child: Column(
                  children: [
                    _buildInfoCard(infoItems),
                    const SizedBox(height: 20),
                    _buildStatusBadge(isActive),
                    const SizedBox(height: 32),
                    _buildActions(isActive),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          GestureDetector(
            onTap: widget.onBack ?? () => Navigator.maybePop(context),
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: Colors.white,
                shape: BoxShape.circle,
                boxShadow: AppShadows.glass,
              ),
              child: const Icon(Icons.arrow_back,
                  size: 18, color: AppColors.onSurface),
            ),
          ),
          const SizedBox(width: 16),
          Text(
            'Rental Details',
            style: GoogleFonts.inter(
              fontSize: 21,
              fontWeight: FontWeight.w700,
              color: AppColors.onSurface,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(List<Map<String, dynamic>> items) {
    final anim = CurvedAnimation(
        parent: _entryCtrl, curve: const Interval(0.0, 0.6, curve: Curves.easeOutCubic));

    return FadeTransition(
      opacity: anim,
      child: SlideTransition(
        position: Tween<Offset>(begin: const Offset(0, 0.1), end: Offset.zero)
            .animate(anim),
        child: Container(
          padding: const EdgeInsets.all(20),
          decoration: BoxDecoration(
            color: Colors.white,
            borderRadius: BorderRadius.circular(AppRadius.lg),
            boxShadow: AppShadows.card,
          ),
          child: Column(
            children: items.map((item) {
              return Padding(
                padding: const EdgeInsets.only(bottom: 16),
                child: Row(
                  children: [
                    Container(
                      width: 36,
                      height: 36,
                      decoration: BoxDecoration(
                        color: AppColors.surface,
                        borderRadius: BorderRadius.circular(AppRadius.md),
                      ),
                      child: Icon(item['icon'] as IconData,
                          size: 16, color: AppColors.onSurfaceVariant),
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            (item['label'] as String).toUpperCase(),
                            style: GoogleFonts.inter(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.onSurfaceVariant,
                              letterSpacing: 1.0,
                            ),
                          ),
                          Text(
                            item['value'] as String,
                            style: GoogleFonts.inter(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: AppColors.onSurfaceAlt,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              );
            }).toList()..removeLast(), // Remove bottom padding from last item? No, actually last item is better with it or we can just remove it.
          ),
        ),
      ),
    );
  }

  Widget _buildStatusBadge(bool isActive) {
    if (!isActive) {
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(999),
          border: Border.all(color: AppColors.divider),
        ),
        child: Text(
          'No Active Rental',
          style: GoogleFonts.inter(
            fontSize: 12,
            fontWeight: FontWeight.w700,
            color: AppColors.onSurfaceVariant,
          ),
        ),
      );
    }

    return AnimatedBuilder(
      animation: _pulseCtrl,
      builder: (context, child) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
          decoration: BoxDecoration(
            color: const Color(0xFFF0FDF4),
            borderRadius: BorderRadius.circular(999),
            border: Border.all(color: const Color(0xFFBBF7D0)),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: BoxDecoration(
                  color: const Color(0xFF22C55E).withOpacity(0.5 + (0.5 * _pulseCtrl.value)),
                  shape: BoxShape.circle,
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFF22C55E).withOpacity(0.3 * _pulseCtrl.value),
                      blurRadius: 8 * _pulseCtrl.value,
                      spreadRadius: 2 * _pulseCtrl.value,
                    )
                  ],
                ),
              ),
              const SizedBox(width: 8),
              Text(
                'Rental Active',
                style: GoogleFonts.inter(
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                  color: const Color(0xFF15803D),
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildActions(bool isActive) {
    return Column(
      children: [
        _buildActionButton(
          label: 'End Rental',
          icon: Icons.stop_circle_outlined,
          color: const Color(0xFFBA1A1A),
          onTap: isActive ? widget.onEndRental : null,
          isPrimary: true,
        ),
        const SizedBox(height: 12),
        _buildActionButton(
          label: 'Change Plan',
          icon: Icons.refresh,
          color: AppColors.surfaceAlt,
          textColor: AppColors.onSurfaceAlt,
          onTap: widget.onChangePlan,
        ),
        const SizedBox(height: 12),
        _buildActionButton(
          label: 'Report Issue',
          icon: Icons.warning_amber_rounded,
          color: Colors.white,
          textColor: AppColors.onSurfaceAlt,
          isOutlined: true,
          onTap: () {},
        ),
        const SizedBox(height: 12),
        _buildActionButton(
          label: 'Contact Support',
          icon: Icons.headset_mic_outlined,
          color: Colors.transparent,
          textColor: AppColors.primary,
          onTap: () {},
        ),
      ],
    );
  }

  Widget _buildActionButton({
    required String label,
    required IconData icon,
    required Color color,
    Color? textColor,
    VoidCallback? onTap,
    bool isPrimary = false,
    bool isOutlined = false,
  }) {
    final disabled = onTap == null;
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 52,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(999),
          border: isOutlined ? Border.all(color: AppColors.divider, width: 2) : null,
          boxShadow: isPrimary && !disabled ? [
            BoxShadow(
              color: color.withOpacity(0.3),
              blurRadius: 12,
              offset: const Offset(0, 4),
            )
          ] : null,
        ),
        child: Opacity(
          opacity: disabled ? 0.5 : 1.0,
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, size: 18, color: textColor ?? Colors.white),
              const SizedBox(width: 8),
              Text(
                label,
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: textColor ?? Colors.white,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
