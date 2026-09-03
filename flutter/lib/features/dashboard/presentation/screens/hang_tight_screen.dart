// PR-ONBOARDING-FLOW-2026-08-11: async wait state in the new active
// onboarding path.
//
// The rider lands here after submitting the pickup form (pickupVerification
// → hangTight) and waits for admin to flip them to ACTIVE. Replaces the
// synchronous pre-dashboard wait at the tail of the new flow. The screen
// shows what's done (Guarantor, Plan, Pickup), what's in progress (KYC
// review), and what's pending (vehicle assignment), plus a "we'll notify
// you" hint so the rider doesn't feel stranded.
//
// No design changes to existing screens (pre-dashboard, pickup-success,
// etc.) — this is a brand-new surface, designed in the same brand language
// (brand blue gradient hero, Plus Jakarta Sans typography, 4px spacing
// grid) and reusing the existing AppColors / AppTypography / Spacing /
// AppRadius tokens.

import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';

/// Async wait state shown after the rider submits the pickup form in the
/// new active onboarding path. The lifecycle gate keeps the rider here
/// while `lifecycleStatus == PICKUP_SCHEDULED` (rank 10) and `pickupDone`
/// is false; the rider is moved to the dashboard when admin activates
/// them (rank >= 11 or pickupDone = true).
///
/// Auto-redirect: the screen watches the rider provider (which is
/// polled centrally by [RiderNotifier._onboardingPoller]), and calls
/// [onActivated] the moment the rider's `pickupDone` boolean flips to true.
/// The lifecycle gate is the primary mover; this auto-redirect is a
/// safety net for the case where the gate fails to fire (e.g., the
/// rider data is already up-to-date but the router hasn't been rebuilt).
class HangTightScreen extends ConsumerStatefulWidget {
  /// Invoked when the rider becomes active (pickupDone = true). The
  /// router wires this to its own navigation. The screen does not
  /// navigate directly — the router is the single source of truth.
  final VoidCallback? onActivated;

  /// PR-ONBOARDING-FLOW-2026-08-13: invoked when the polling refresh
  /// returns a 401 (session expired). The router wires this to its
  /// `logout()` so the rider is sent back to the phone-entry screen
  /// instead of being stranded on a screen that polls forever and
  /// never gets fresh data. Without this callback the rider was
  /// stuck — the catch-all in `_safeRefresh` swallowed the 401 and
  /// every subsequent 15s tick was the same dead-poll.
  final VoidCallback? onSessionExpired;

  /// PR-K.1 (2026-08-27): invoked when the rider taps "Fix KYC" on the
  /// KYC rejection / correction card. The router wires this to
  /// `_navigateToLocal(AuthState.intent)` so the rider can re-do the
  /// KYC flow from the top.
  final VoidCallback? onFixKyc;

  const HangTightScreen({
    super.key,
    this.onActivated,
    this.onSessionExpired,
    this.onFixKyc,
  });

  @override
  ConsumerState<HangTightScreen> createState() => _HangTightScreenState();
}

class _HangTightScreenState extends ConsumerState<HangTightScreen> {
  bool _redirected = false;

  @override
  void initState() {
    super.initState();
    PostHogService.capture('hang_tight_viewed');
    // Polling is managed centrally by RiderNotifier._onboardingPoller when
    // in AppState HangTight. Manual refresh is available via the refresh button.
  }

  Future<void> _safeRefresh() async {
    if (!mounted || _redirected) return;
    try {
      await ref.read(riderProvider.notifier).refreshFromApi();
    } on ApiException catch (e) {
      // PR-ONBOARDING-FLOW-2026-08-13: surface 401 to the router so
      // the rider is sent to the login screen instead of being
      // stranded on a forever-polling HangTight. Every other Api
      // exception (network drop, 500, etc.) is swallowed — the next
      // onboarding poller tick will retry.
      if (e.statusCode == 401) {
        if (mounted) widget.onSessionExpired?.call();
        return;
      }
    } catch (_) {
      // Offline / transient — the next poller tick will retry.
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final rider = ref.watch(riderProvider.select((p) => p.rider));

    // Auto-redirect to the dashboard the moment the rider becomes active
    // (admin flipped them, pickupDone landed via sync, or they re-entered
    // the app post-activation). Mirrors the pre-dashboard redirect logic
    // — both screens are wait states, just for different lifecycle ranks.
    //
    // NOTE: we read the raw `pickupDone` boolean, NOT the derived
    // `isPickupDone` getter. The getter returns true for any rider with
    // lifecycleRank >= 10 (PICKUP_SCHEDULED and above) — which would
    // cause an infinite redirect loop on hangTight (rank 10 → isPickupDone
    // is true → redirect immediately). The raw flag is the only
    // authoritative signal that the server has flipped the rider to
    // ACTIVE.
    if (rider != null && rider.pickupDone && !_redirected) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _redirected) return;
        _redirected = true;
        widget.onActivated?.call();
      });
    } else if (rider != null && !rider.pickupDone && _redirected) {
      // Defensive: the rider went back to PICKUP_SCHEDULED (rare — admin
      // reversed approval). Re-arm so the next activation re-redirects.
      _redirected = false;
    }

    return Scaffold(
      backgroundColor: colors.surface,
      body: SafeArea(
        child: Column(
          children: [
            _buildHero(context),
            Expanded(
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.fromLTRB(
                  Spacing.lg,
                  Spacing.lg,
                  Spacing.lg,
                  Spacing.xl,
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    if (_isKycAttention(rider)) ...[
                      _KycRejectionCard(
                        kycStatus: rider!.kycStatus,
                        rejectionReason: rider.kycRejectionReason,
                        onFixKyc: widget.onFixKyc,
                      ),
                      const SizedBox(height: Spacing.lg),
                    ],
                    _buildStatusList(rider),
                    const SizedBox(height: Spacing.lg),
                    _buildNotificationHint(context),
                  ],
                ),
              ),
            ),
            _buildBottomBar(context),
          ],
        ),
      ),
    );
  }

  /// Brand-blue gradient hero with a spinning hourglass icon. Same visual
  /// vocabulary as the pre-dashboard polling banner and the pickup-success
  /// screen — readers see the brand color and instantly know it's a
  /// Voltium onboarding state.
  Widget _buildHero(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.fromLTRB(
        Spacing.lg,
        Spacing.xl,
        Spacing.lg,
        Spacing.xl,
      ),
      decoration: const BoxDecoration(
        gradient: AppGradients.primary,
      ),
      child: Column(
        children: [
          const SizedBox(height: Spacing.md),
          Container(
            width: 80,
            height: 80,
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.18),
              shape: BoxShape.circle,
            ),
            child: const _SpinningIcon(
              icon: Icon(
                Icons.hourglass_top_rounded,
                color: Colors.white,
                size: 40,
              ),
            ),
          ),
          const SizedBox(height: Spacing.md),
          Text(
            l10n.hangTightTitle,
            style: AppTypography.headingLarge
                .copyWith(color: Colors.white, letterSpacing: -0.5),
          ),
          const SizedBox(height: Spacing.xs),
          Text(
            l10n.hangTightSettingUpBody,
            textAlign: TextAlign.center,
            style: AppTypography.bodyMedium.copyWith(
              color: Colors.white.withValues(alpha: 0.88),
              height: 1.4,
            ),
          ),
          const SizedBox(height: Spacing.md),
        ],
      ),
    );
  }

  /// 5-row status list. Rows are derived from the live rider model so
  /// they reflect the actual server-side state, not a hard-coded
  /// "everything's done" lie.
  ///
  /// ONBOARDING-AUDIT 2026-08-14 (fix #2): the previous version
  /// hardcoded Guarantor / Plan / Pickup as done regardless of the
  /// rider's actual state. A rider who reached rank 10 with
  /// guarantor still SUBMITTED (e.g., admin review in flight) was
  /// shown a green check for "Guarantor approved" and had no way to
  /// tell something was still pending. Now every row reads from the
  /// rider model: `guarantorStatus`, `currentPlan`, `pickupDone`,
  /// `kycStatus`, `assignedVehicle`. The same logic also fixes
  /// the prior inconsistency where the docstring claimed "KYC and
  /// vehicle rows are actually derived from live rider state" but
  /// the three hardcoded rows were not.
  Widget _buildStatusList(RiderModel? rider) {
    final guarantorRow = _guarantorRow(context, rider?.guarantorStatus, () {
      AppNavigator.push(context, const SupportCenterScreen());
    });
    final planRow =
        _planRow(context, rider?.currentPlan, rider?.planStatus, () {
      AppNavigator.push(context, const SupportCenterScreen());
    });
    final pickupRow = _pickupRow(context, rider?.pickupDone);
    // PR-ONBOARDING-FLOW-2026-08-12: vehicle assignment is now driven
    // by the rider data, not a hardcoded `_StatusState.waiting`. If the
    // syncPickup step wrote `assignedVehicle`, flip the row to done.
    final hasVehicle = rider?.assignedVehicle?.isNotEmpty ?? false;
    final kycState = _kycState(rider?.kycStatus);
    final items = <_StatusRow>[
      guarantorRow,
      planRow,
      pickupRow,
      _StatusRow(
        icon: _kycIcon(rider?.kycStatus),
        iconColor: _kycColor(rider?.kycStatus),
        label: _kycLabel(context, rider?.kycStatus),
        state: kycState,
        onTap: kycState == _StatusState.attention
            ? (widget.onFixKyc ??
                () => AppNavigator.push(context, const SupportCenterScreen()))
            : null,
      ),
      _StatusRow(
        icon: hasVehicle
            ? Icons.check_circle_rounded
            : Icons.directions_car_rounded,
        iconColor: hasVehicle ? AppColors.success : colors().onSurfaceMuted,
        // PR-E (i18n sweep): the row label was hardcoded English; route
        // through `hangTightVehicleAssignment` so Hindi renders.
        label: AppLocalizations.of(context)?.hangTightVehicleAssignment ??
            'Vehicle assignment',
        state: hasVehicle ? _StatusState.done : _StatusState.waiting,
      ),
    ];

    return Container(
      decoration: BoxDecoration(
        color: colors().card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        boxShadow: AppShadows.soft,
      ),
      padding: const EdgeInsets.symmetric(
        vertical: Spacing.sm,
        horizontal: Spacing.sm,
      ),
      child: Column(
        children: [
          for (int i = 0; i < items.length; i++) ...[
            if (i > 0)
              Divider(
                height: 1,
                thickness: 1,
                color: colors().outlineVariant,
                indent: Spacing.md,
                endIndent: Spacing.md,
              ),
            _StatusRowTile(row: items[i]),
          ],
        ],
      ),
    );
  }

  ThemeColors colors() => AppColors.of(context);

  /// "We'll send a notification when ready" hint card. Mirrors the
  /// notification-hint pattern used by the pre-dashboard polling banner
  /// and the support banner. Designed to be informational, not
  /// actionable — the rider should not feel they need to keep the app
  /// open.
  Widget _buildNotificationHint(BuildContext context) {
    final l10n = AppLocalizations.of(context)!;
    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: colors().primarySurface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: colors().infoLight, width: 1),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.notifications_active_outlined,
            color: AppColors.primary,
            size: 20,
          ),
          const SizedBox(width: Spacing.sm),
          Expanded(
            child: Text(
              l10n.hangTightNotificationHint,
              style: AppTypography.bodySmall.copyWith(
                color: colors().onSurfaceVariant,
                height: 1.4,
              ),
            ),
          ),
        ],
      ),
    );
  }

  /// Sticky bottom bar: primary "Contact support" (most likely the
  /// rider's only affordance — they may be confused about why they
  /// can't ride yet) and a secondary "Refresh" for the impatient.
  /// No "Logout" here — the pre-dashboard header owns that pattern,
  /// and the rider is mid-onboarding, not in a "leave" state.
  Widget _buildBottomBar(BuildContext context) {
    return Container(
      padding: EdgeInsets.fromLTRB(
        Spacing.lg,
        Spacing.md,
        Spacing.lg,
        Spacing.md + MediaQuery.of(context).padding.bottom,
      ),
      decoration: BoxDecoration(
        color: colors().card,
        boxShadow: AppShadows.soft,
      ),
      child: Row(
        children: [
          Expanded(
            child: OutlinedButton.icon(
              key: const Key('hangTightRefreshButton'),
              onPressed: _safeRefresh,
              icon: const Icon(Icons.refresh_rounded, size: 18),
              // T-66: hardcoded English "Refresh" button label.
              // Localised via the new `txtrefresh` ARB key.
              label:
                  Text(AppLocalizations.of(context)?.txtrefresh ?? 'Refresh'),
              style: OutlinedButton.styleFrom(
                foregroundColor: AppColors.primary,
                side: const BorderSide(color: AppColors.primary, width: 1.5),
                padding: const EdgeInsets.symmetric(vertical: Spacing.md),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                textStyle: AppTypography.labelLarge.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
          const SizedBox(width: Spacing.sm),
          Expanded(
            flex: 2,
            child: FilledButton.icon(
              key: const Key('hangTightSupportButton'),
              onPressed: () {
                AppNavigator.push(
                  context,
                  const SupportCenterScreen(),
                );
              },
              icon: const Icon(Icons.support_agent_rounded, size: 18),
              // T-66: hardcoded English "Contact support" button
              // label. Localised via the existing
              // `suspension_contactSupport` ARB key (the closest
              // semantic match — "contact support" as a verb in
              // an error-state button).
              label: Text(
                  AppLocalizations.of(context)?.suspension_contactSupport ??
                      'Contact support'),
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: Spacing.md),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                textStyle: AppTypography.labelLarge.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

// ── Internal helpers ───────────────────────────────────────────────────

/// ONBOARDING-AUDIT 2026-08-14 (fix #2): derive the guarantor row
/// from the rider's actual `GuarantorStatus`, not a hardcoded "done".
/// Mirrors the `KycStatus` helpers below — same shape, same intent.
_StatusRow _guarantorRow(
  BuildContext context,
  GuarantorStatus? status, [
  VoidCallback? onAttention,
]) {
  final l10n = AppLocalizations.of(context)!;
  switch (status) {
    case GuarantorStatus.approved:
    case GuarantorStatus.verified:
      return _StatusRow(
        icon: Icons.check_circle_rounded,
        iconColor: AppColors.success,
        label: l10n.hangTightGuarantorApproved,
        state: _StatusState.done,
      );
    case GuarantorStatus.rejected:
    case GuarantorStatus.infoRequired:
      return _StatusRow(
        icon: Icons.error_rounded,
        iconColor: AppColors.error,
        label: l10n.hangTightGuarantorNeedsAttention,
        state: _StatusState.attention,
        onTap: onAttention,
      );
    case GuarantorStatus.replaced:
      return _StatusRow(
        icon: Icons.autorenew_rounded,
        iconColor: AppColors.primary,
        label: l10n.hangTightGuarantorReplacedPendingReview,
        state: _StatusState.inProgress,
      );
    case GuarantorStatus.submitted:
    case GuarantorStatus.draft:
    case GuarantorStatus.pending:
    case null:
      return _StatusRow(
        icon: Icons.hourglass_top_rounded,
        iconColor: AppColors.slate400,
        label: l10n.hangTightGuarantorUnderReview,
        state: _StatusState.inProgress,
      );
  }
}

/// ONBOARDING-AUDIT 2026-08-14 (fix #2): plan row driven by
/// `currentPlan` + `planStatus`. The active path is plan → deposit →
/// pickup → hangTight, so by the time the rider lands here the plan
/// is always set; but we still derive it to keep the contract
/// honest (a forced-deposit-failed flow could land here without a
/// plan and we shouldn't show a green check).
_StatusRow _planRow(
    BuildContext context, String? currentPlan, String? planStatus,
    [VoidCallback? onAttention]) {
  final l10n = AppLocalizations.of(context)!;
  final hasPlan =
      currentPlan != null && currentPlan.isNotEmpty && currentPlan != 'NONE';
  if (!hasPlan) {
    return _StatusRow(
      icon: Icons.hourglass_top_rounded,
      iconColor: AppColors.slate400,
      label: l10n.hangTightPlanSelection,
      state: _StatusState.waiting,
    );
  }
  // Mirror the canonical mapping from `web/src/lib/admin-ui.ts`:
  // a "REJECTED" plan status means admin declined; show attention.
  final rejected = (planStatus ?? '').toUpperCase() == 'REJECTED';
  if (rejected) {
    return _StatusRow(
      icon: Icons.error_rounded,
      iconColor: AppColors.error,
      label: l10n.hangTightPlanNeedsAttention,
      state: _StatusState.attention,
      onTap: onAttention,
    );
  }
  return _StatusRow(
    icon: Icons.check_circle_rounded,
    iconColor: AppColors.success,
    // PR-E (i18n sweep): route through `hangTightPlanSelected` so
    // Hindi renders.
    label:
        AppLocalizations.of(context)?.hangTightPlanSelected ?? 'Plan selected',
    state: _StatusState.done,
  );
}

/// ONBOARDING-AUDIT 2026-08-14 (fix #2): pickup row driven by the
/// raw `pickupDone` boolean. The auto-redirect above uses the same
/// field, so they will flip together — a rider cannot see
/// "Pickup confirmed: ✅" without also being routed to the
/// dashboard on the next frame.
_StatusRow _pickupRow(BuildContext context, bool? pickupDone) {
  if (pickupDone == true) {
    return _StatusRow(
      icon: Icons.check_circle_rounded,
      iconColor: AppColors.success,
      // PR-E (i18n sweep): was hardcoded 'Pickup confirmed'.
      // The label is the "done" state, so route through
      // `hangTightPickupConfirmation` and let the post-completion copy
      // fall back to a future `hangTightPickupConfirmed` key if/when
      // product wants the explicit done-state copy.
      label: AppLocalizations.of(context)?.hangTightPickupConfirmation ??
          'Pickup confirmation',
      state: _StatusState.done,
    );
  }
  return _StatusRow(
    icon: Icons.hourglass_top_rounded,
    iconColor: AppColors.slate400,
    // PR-E (i18n sweep): was hardcoded 'Pickup confirmation'.
    label: AppLocalizations.of(context)?.hangTightPickupConfirmation ??
        'Pickup confirmation',
    state: _StatusState.waiting,
  );
}

IconData _kycIcon(KycStatus? status) {
  switch (status) {
    case KycStatus.approved:
    case KycStatus.verified:
      return Icons.check_circle_rounded;
    case KycStatus.rejected:
    case KycStatus.expired:
      return Icons.error_rounded;
    case KycStatus.infoRequired:
      return Icons.help_outline_rounded;
    case KycStatus.submitted:
    case KycStatus.draft:
    case KycStatus.pending:
    default:
      return Icons.autorenew_rounded;
  }
}

Color _kycColor(KycStatus? status) {
  switch (status) {
    case KycStatus.approved:
    case KycStatus.verified:
      return AppColors.success;
    case KycStatus.rejected:
    case KycStatus.expired:
      return AppColors.error;
    case KycStatus.infoRequired:
      return AppColors.warning;
    case KycStatus.submitted:
    case KycStatus.draft:
    case KycStatus.pending:
    default:
      return AppColors.primary;
  }
}

/// Label for the KYC row. Mirrors the icon helper — kept separate
/// because a single label can't be derived from a single color.
String _kycLabel(BuildContext context, KycStatus? status) {
  final l10n = AppLocalizations.of(context)!;
  switch (status) {
    case KycStatus.approved:
    case KycStatus.verified:
      return l10n.hangTightKycApproved;
    case KycStatus.rejected:
      return l10n.hangTightKycRejectedResubmit;
    case KycStatus.expired:
      return l10n.hangTightKycExpired;
    case KycStatus.infoRequired:
      return l10n.hangTightKycNeedsMoreInfo;
    case KycStatus.submitted:
    case KycStatus.draft:
    case KycStatus.pending:
    default:
      return l10n.hangTightKycUnderReview;
  }
}

_StatusState _kycState(KycStatus? status) {
  switch (status) {
    case KycStatus.approved:
    case KycStatus.verified:
      return _StatusState.done;
    case KycStatus.rejected:
    case KycStatus.expired:
    case KycStatus.infoRequired:
      return _StatusState.attention;
    case KycStatus.submitted:
    case KycStatus.draft:
    case KycStatus.pending:
    default:
      return _StatusState.inProgress;
  }
}

enum _StatusState { done, inProgress, attention, waiting }

class _StatusRow {
  final IconData icon;
  final Color iconColor;
  final String label;
  final _StatusState state;
  final VoidCallback? onTap;

  const _StatusRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.state,
    this.onTap,
  });
}

class _StatusRowTile extends StatelessWidget {
  final _StatusRow row;
  const _StatusRowTile({required this.row});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context)!;
    final isWaiting = row.state == _StatusState.waiting;
    final isAttention = row.state == _StatusState.attention;

    final tileContent = Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: Spacing.md,
        vertical: Spacing.md,
      ),
      child: Row(
        children: [
          // The in-progress icon is a spinning one; the others are static.
          // Spinning the icon draws the eye to what's actively moving.
          if (row.state == _StatusState.inProgress)
            const _SpinningIcon(
              icon: SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2.5,
                  valueColor: AlwaysStoppedAnimation<Color>(AppColors.primary),
                ),
              ),
            )
          else
            Icon(row.icon, color: row.iconColor, size: 22),
          const SizedBox(width: Spacing.md),
          Expanded(
            child: Text(
              row.label,
              style: AppTypography.bodyMedium.copyWith(
                color: isWaiting ? colors.onSurfaceVariant : colors.onSurface,
                fontWeight: isWaiting ? FontWeight.w500 : FontWeight.w600,
              ),
            ),
          ),
          if (isWaiting)
            Text(
              l10n.hangTightStatusPending,
              style: AppTypography.labelSmall.copyWith(
                color: colors.onSurfaceVariant,
                letterSpacing: 0.2,
              ),
            )
          else if (isAttention)
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  l10n.hangTightStatusActionNeeded,
                  style: AppTypography.labelSmall.copyWith(
                    color: AppColors.warning,
                    letterSpacing: 0.2,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (row.onTap != null) ...[
                  const SizedBox(width: 4),
                  const Icon(
                    Icons.chevron_right_rounded,
                    size: 16,
                    color: AppColors.warning,
                  ),
                ],
              ],
            ),
        ],
      ),
    );

    if (row.onTap != null) {
      return InkWell(
        onTap: row.onTap,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        child: tileContent,
      );
    }
    return tileContent;
  }
}

/// Spins a child icon continuously (3s per revolution) — used for the
/// hero hourglass and the in-progress status row. Lighter than pulling
/// in `rotation_transition.dart` for two call sites.
class _SpinningIcon extends StatefulWidget {
  final Widget icon;
  const _SpinningIcon({required this.icon});

  @override
  State<_SpinningIcon> createState() => _SpinningIconState();
}

class _SpinningIconState extends State<_SpinningIcon>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RotationTransition(
      turns: _controller,
      child: widget.icon,
    );
  }
}

/// PR-K.1: returns true when the rider's KYC status needs action
/// (rejected by admin OR info request from admin). Used to gate
/// the prominent rejection card and the "Fix KYC" button.
bool _isKycAttention(RiderModel? rider) {
  final s = rider?.kycStatus;
  return s == KycStatus.rejected || s == KycStatus.infoRequired;
}

/// PR-K.1: prominent card shown above the status list when KYC is in
/// the attention state. Two visual variants: red (REJECTED) and amber
/// (INFO_REQUIRED). One primary CTA: "Fix KYC" → `onFixKyc`.
class _KycRejectionCard extends StatelessWidget {
  final KycStatus kycStatus;
  final String? rejectionReason;
  final VoidCallback? onFixKyc;

  const _KycRejectionCard({
    required this.kycStatus,
    required this.rejectionReason,
    required this.onFixKyc,
  });

  bool get _isRejected => kycStatus == KycStatus.rejected;

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    final l10n = AppLocalizations.of(context);
    final isRejected = _isRejected;
    final bgColor = isRejected ? colors.errorLight : colors.warningLight;
    final fgColor = isRejected ? colors.error : colors.warningForeground;
    final iconData =
        isRejected ? Icons.error_rounded : Icons.help_outline_rounded;
    final title = l10n?.txtkycRejectionOnHangTightTitle ?? 'KYC rejected';
    final bodyFallback = isRejected
        ? (l10n?.txtkycRejectionOnHangTightBody ??
            'Please review the rejection remarks and re-submit your documents to continue.')
        : (l10n?.txtkycInfoRequiredOnHangTightBody ??
            'We need more information to verify your identity. Please re-submit your documents to continue.');
    final reason = rejectionReason?.trim();
    final body = (reason != null && reason.isNotEmpty) ? reason : bodyFallback;
    final buttonLabel = l10n?.txtfixKycButton ?? 'Fix KYC';

    return Container(
      padding: const EdgeInsets.all(Spacing.md),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
        border: Border.all(color: fgColor.withValues(alpha: 0.4), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(iconData, color: fgColor, size: 24),
              const SizedBox(width: Spacing.sm),
              Expanded(
                child: Text(
                  title,
                  style: AppTypography.titleMedium
                      .copyWith(color: fgColor, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
          const SizedBox(height: Spacing.sm),
          Text(
            body,
            style: AppTypography.bodySmall.copyWith(
              color: colors.onSurface,
              height: 1.4,
            ),
          ),
          const SizedBox(height: Spacing.md),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              key: const Key('hangTightFixKycButton'),
              onPressed: onFixKyc,
              icon: const Icon(Icons.edit_document, size: 18),
              label: Text(buttonLabel),
              style: FilledButton.styleFrom(
                backgroundColor: fgColor,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: Spacing.md),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                textStyle: AppTypography.labelLarge.copyWith(
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
