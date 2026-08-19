import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/features/dashboard/widgets/dashboard_sheets.dart';

/// Full-screen view showing assigned Team Leader details, contact information,
/// and change request flow.
class TlDetailsScreen extends ConsumerStatefulWidget {
  final VoidCallback? onBack;
  const TlDetailsScreen({super.key, this.onBack});

  @override
  ConsumerState<TlDetailsScreen> createState() => _TlDetailsScreenState();
}

class _TlDetailsScreenState extends ConsumerState<TlDetailsScreen> {
  @override
  void initState() {
    super.initState();
    PostHogService.capture('team_leader_details_viewed');
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final rider = ref.watch(riderProvider).rider;
    final isUnassigned = rider?.teamLeader == null ||
        rider!.teamLeader!.isEmpty ||
        rider.teamLeader == 'Not Assigned';
    final tlName = isUnassigned
        ? (l10n?.txtnotAssigned ?? 'Not assigned')
        : rider.teamLeader!;
    final tlPhone =
        (rider?.teamLeaderPhone == null || rider!.teamLeaderPhone!.isEmpty)
            ? ''
            : rider.teamLeaderPhone!;

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(context),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 32),
                child: Column(
                  children: [
                    _buildTLProfileCard(context, tlName, isUnassigned),
                    const SizedBox(height: 20),
                    if (tlPhone.isNotEmpty) _buildContactCard(context, tlPhone),
                    const SizedBox(height: 16),
                    _buildInfoCard(context),
                    const SizedBox(height: 32),
                    _buildActions(context),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 16, 20, 8),
      child: Row(
        children: [
          GestureDetector(
            key: const Key('backButton'),
            onTap: () {
              HapticService.light();
              if (widget.onBack != null) {
                widget.onBack!();
              } else if (Navigator.canPop(context)) {
                Navigator.pop(context);
              }
            },
            child: Container(
              width: 40,
              height: 40,
              decoration: BoxDecoration(
                color: colors.card,
                shape: BoxShape.circle,
                boxShadow: AppShadows.glass,
              ),
              child: Icon(
                Icons.arrow_back,
                size: 18,
                color: colors.onSurface,
              ),
            ),
          ),
          const SizedBox(width: 16),
          Text(
            l10n?.txtteamLeader ?? 'Team Leader',
            style: AppTypography.titleLarge
                .copyWith(fontSize: 21, color: colors.onSurface),
          ),
        ],
      ),
    );
  }

  Widget _buildTLProfileCard(
      BuildContext context, String name, bool isUnassigned) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: Spacing.paddingLg,
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        children: [
          CircleAvatar(
            radius: 48,
            backgroundColor: colors.iconBackground,
            child: Icon(
              Icons.person,
              size: 48,
              color: isUnassigned
                  ? colors.onSurfaceMuted
                  : colors.onSurfaceVariant,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            name,
            style: AppTypography.headingSmall.copyWith(color: colors.onSurface),
            textAlign: TextAlign.center,
          ),
          const SizedBox(height: 4),
          Text(
            l10n?.txtassignedTeamLeader ?? 'Assigned Team Leader',
            style: AppTypography.bodyMedium
                .copyWith(fontSize: 13, color: colors.onSurfaceVariant),
          ),
          if (isUnassigned) ...[
            const SizedBox(height: 8),
            Text(
              l10n?.txttlPendingNotice ??
                  'Your hub will assign a team leader shortly',
              style: AppTypography.bodySmall
                  .copyWith(color: colors.onSurfaceMuted),
              textAlign: TextAlign.center,
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildContactCard(BuildContext context, String phone) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.surfaceBright,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.outlineVariant),
      ),
      child: Row(
        children: [
          const Icon(Icons.phone_outlined, color: AppColors.primary, size: 20),
          const SizedBox(width: 16),
          Expanded(
            child: Text(
              phone,
              style: AppTypography.bodyLarge.copyWith(color: colors.onSurface),
            ),
          ),
          IconButton(
            key: const Key('callTeamLeaderButton'),
            tooltip: l10n?.txtcall ?? 'Call',
            onPressed: () async {
              HapticService.light();
              PostHogService.capture('team_leader_call_clicked');
              final sanitized = phone.replaceAll(RegExp(r'[^\d+]'), '');
              if (sanitized.isEmpty) {
                if (context.mounted) {
                  Toast.warning(
                    context,
                    l10n?.txtnoContactNumberTl ??
                        'No contact number available for your Team Leader.',
                  );
                }
                return;
              }
              final uri = Uri.parse('tel:$sanitized');
              try {
                if (!await launchUrl(uri)) {
                  throw Exception('Could not launch dialer');
                }
              } catch (e) {
                if (context.mounted) {
                  Toast.error(
                    context,
                    l10n?.txtcouldNotOpenDialer ??
                        'Could not open the phone dialer. Please try again.',
                  );
                }
              }
            },
            icon: Container(
              padding: Spacing.paddingSm,
              decoration: BoxDecoration(
                color: colors.successSurface,
                borderRadius: BorderRadius.circular(AppRadius.sm),
              ),
              child: const Icon(Icons.call, color: AppColors.success, size: 18),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInfoCard(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    return Container(
      padding: Spacing.paddingMd,
      decoration: BoxDecoration(
        color: colors.primarySurface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors.outlineVariant),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(Icons.info_outline, size: 18, color: AppColors.primary),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              l10n?.txtteamLeaderInfoDescription ??
                  'Your team leader is your primary point of contact for daily operations, route guidance, and on-ground support.',
              style: AppTypography.bodySmall.copyWith(
                color: colors.onSurface,
                height: 1.5,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActions(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return Column(
      children: [
        _buildActionBtn(
          label: l10n?.txtrequestTlChange ?? 'Request Team Leader change',
          icon: Icons.swap_horiz,
          color: AppColors.error,
          onTap: () {
            HapticService.light();
            PostHogService.capture('team_leader_change_requested');
            showChangeTLReasonSheet(context);
          },
        ),
        const SizedBox(height: 12),
        _buildActionBtn(
          label: l10n?.txtbackToDashboard ?? 'Back to Dashboard',
          icon: Icons.home_outlined,
          color: AppColors.primary,
          onTap: () {
            HapticService.light();
            if (widget.onBack != null) {
              widget.onBack!();
            } else if (Navigator.canPop(context)) {
              Navigator.pop(context);
            }
          },
        ),
      ],
    );
  }

  Widget _buildActionBtn({
    required String label,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 52,
        width: double.infinity,
        decoration: BoxDecoration(
          color: color,
          borderRadius: BorderRadius.circular(AppRadius.full),
          boxShadow: [
            BoxShadow(
              color: color.withValues(alpha: 0.25),
              blurRadius: 10,
              offset: const Offset(0, 4),
            ),
          ],
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, size: 18, color: Colors.white),
            const SizedBox(width: 8),
            Text(
              label,
              style: AppTypography.labelLarge.copyWith(color: Colors.white),
            ),
          ],
        ),
      ),
    );
  }
}
