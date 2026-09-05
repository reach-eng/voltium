// PR-ONBOARDING-FLOW-2026-08-11: async wait state in the new active
// onboarding path.
//
// The rider lands here after submitting the pickup form (pickupVerification
// → hangTight) and waits for admin to approve their KYC and their wallet
// top-up (security deposit). PR-HANGTIGHT-2026-09-06: these are the ONLY
// two approvals that gate activation — plan selection, guarantor
// submission, and pickup/vehicle assignment are completed by the rider
// during onboarding and need no admin sign-off, so the screen shows just
// the two approval rows plus a "we'll notify you" hint so the rider
// doesn't feel stranded.
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
import 'package:voltium_rider/features/kyc/data/kyc_fields.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_navigator.dart';
import 'package:voltium_rider/features/support/presentation/screens/support_center_screen.dart';

/// Async wait state shown after the rider submits the pickup form in the
/// new active onboarding path. The lifecycle gate keeps the rider here
/// while `lifecycleStatus == PICKUP_SCHEDULED` (rank 10) and the KYC +
/// security-deposit approvals are pending; the rider is moved to the
/// dashboard when both approvals land (or the server flips them to
/// ACTIVE, rank >= 11).
///
/// Auto-redirect: the screen watches the rider provider (which is
/// polled centrally by [RiderNotifier._onboardingPoller]), and calls
/// [onActivated] the moment both approvals are complete (or the rider's
/// lifecycleStatus is ACTIVE). The lifecycle gate is the primary mover;
/// this auto-redirect is a safety net for the case where the gate fails
/// to fire (e.g., the rider data is already up-to-date but the router
/// hasn't been rebuilt).
class HangTightScreen extends ConsumerStatefulWidget {
  /// Invoked when both admin approvals (KYC + security deposit) are
  /// complete, or the rider's lifecycleStatus reaches ACTIVE. The
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

  /// PR-K.1 / PR-KYC-CORRECTION: invoked when the rider taps the
  /// "Correct the details" button on the KYC rejection / correction
  /// card. The router deep-links to the onboarding step owning the
  /// first admin-flagged field (user_onboarding_screen.dart).
  final VoidCallback? onFixKyc;

  /// PR-HANGTIGHT-2026-09-06: invoked when the rider taps "Retry payment"
  /// on a rejected security-deposit row. The router wires this to
  /// `_navigateToLocal(AuthState.topUpAmount)` so the rider can re-enter
  /// the amount + proof-upload flow. Safe at rank 10: the server keeps
  /// the rider at PICKUP_SCHEDULED on resubmission and admin approval of
  /// the new transaction credits the deposit and self-heals them to
  /// ACTIVE.
  final VoidCallback? onRetryDeposit;

  const HangTightScreen({
    super.key,
    this.onActivated,
    this.onSessionExpired,
    this.onFixKyc,
    this.onRetryDeposit,
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

    // PR-HANGTIGHT-2026-09-06: auto-redirect the moment BOTH admin
    // approvals are complete (KYC approved + security deposit approved),
    // or the server has flipped the rider to ACTIVE. Mirrors the
    // lifecycle gate's dashboard condition — the gate is the primary
    // mover and this is the safety net.
    //
    // NOTE: we deliberately do NOT read the raw `pickupDone` boolean
    // here. The server computes it as `isActivated || pickedUpAt`
    // (flatten-rider.ts:115), and syncPickup sets pickedUpAt at rank 10 —
    // so pickupDone is true for every picked-up rider whose approvals are
    // still pending. Keying on it would skip the approval wait entirely.
    // The strict getters read the raw kycStatus / depositStatus fields,
    // which are NOT ORed with rank server-side.
    final bothApproved = rider != null &&
        rider.isKycApprovedByAdmin &&
        rider.isDepositApprovedByAdmin;
    final isActive = rider != null && rider.lifecycleStatus == 'ACTIVE';
    if ((bothApproved || isActive) && !_redirected) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted || _redirected) return;
        _redirected = true;
        widget.onActivated?.call();
      });
    } else if (!(bothApproved || isActive) && _redirected) {
      // Defensive: the rider went back to PICKUP_SCHEDULED with a pending
      // approval (rare — admin reversed approval). Re-arm so the next
      // activation re-redirects.
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
                        flaggedFields: rider.kycEditableFields ?? const [],
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
          const SizedBox(height: Spacing.sm),
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
            decoration: BoxDecoration(
              color: Colors.white.withValues(alpha: 0.16),
              borderRadius: BorderRadius.circular(AppRadius.full),
              border: Border.all(
                color: Colors.white.withValues(alpha: 0.25),
                width: 1,
              ),
            ),
            child: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                const SizedBox(
                  width: 8,
                  height: 8,
                  child: CircularProgressIndicator(
                    strokeWidth: 1.5,
                    valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'Review in progress · Usually 5–10 min',
                  style: AppTypography.labelSmall.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w600,
                    letterSpacing: 0.3,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: Spacing.md),
        ],
      ),
    );
  }

  /// PR-HANGTIGHT-2026-09-06: 2-row status list — the ONLY two admin
  /// approvals that gate activation. Plan selection, guarantor
  /// submission, and pickup/vehicle assignment are completed by the
  /// rider during onboarding and need no admin sign-off, so they are not
  /// shown. Rows derive from the live rider model (raw `kycStatus` /
  /// `depositStatus`), so they flip the moment admin approves — the
  /// RiderModel equality contract includes both fields specifically so
  /// `ref.watch(select)` re-fires on approval.
  Widget _buildStatusList(RiderModel? rider) {
    final kycState = _kycState(rider?.kycStatus);
    final depositState = _depositState(rider?.depositStatus, rider?.securityDeposit);
    final items = <_StatusRow>[
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
      _depositRow(
        context,
        rider?.depositStatus,
        rider?.securityDeposit,
        state: depositState,
        onRetry: widget.onRetryDeposit,
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

/// PR-HANGTIGHT-2026-09-06: security-deposit (wallet top-up) approval
/// row. Keyed on the RAW `depositStatus` — the server's derived
/// `depositDone` flag is ORed to true at rank >= 10 regardless of
/// approval (flatten-rider.ts:110), so it cannot be trusted here. A
/// credited deposit (securityDeposit > 0) counts as approved, mirroring
/// the server's activation input. A rejected deposit gets a Retry
/// Payment action that re-enters the top-up flow.
_StatusRow _depositRow(
  BuildContext context,
  DepositStatus? status,
  double? securityDeposit, {
  required _StatusState state,
  VoidCallback? onRetry,
}) {
  final l10n = AppLocalizations.of(context);
  switch (state) {
    case _StatusState.done:
      return _StatusRow(
        icon: Icons.check_circle_rounded,
        iconColor: AppColors.success,
        label: l10n?.hangTightDepositApproved ?? 'Wallet top-up approved',
        state: _StatusState.done,
      );
    case _StatusState.attention:
      return _StatusRow(
        icon: Icons.error_rounded,
        iconColor: AppColors.error,
        label: l10n?.hangTightDepositRejected ?? 'Wallet top-up rejected',
        state: _StatusState.attention,
        onTap: onRetry,
        // PR-HANGTIGHT-2026-09-06: explicit self-serve affordance — the
        // rider re-enters the top-up flow instead of contacting support.
        actionLabel: l10n?.hangTightRetryPayment ?? 'Retry payment',
      );
    case _StatusState.inProgress:
    case _StatusState.waiting:
      return _StatusRow(
        icon: Icons.hourglass_top_rounded,
        iconColor: AppColors.slate400,
        label: l10n?.hangTightDepositUnderReview ?? 'Wallet top-up under review',
        state: state,
      );
  }
}

/// Deposit row state from the raw fields. `securityDeposit > 0` counts
/// as approved (the server credits the amount and sets APPROVED together;
/// the amount check mirrors flatten-rider.ts's `isDepositApproved`).
_StatusState _depositState(DepositStatus? status, double? securityDeposit) {
  if (status == DepositStatus.approved || (securityDeposit ?? 0) > 0) {
    return _StatusState.done;
  }
  if (status == DepositStatus.rejected) {
    return _StatusState.attention;
  }
  return _StatusState.inProgress;
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

  /// PR-HANGTIGHT-2026-09-06: optional trailing action text for
  /// attention rows (e.g. "Retry payment"). Falls back to the generic
  /// "Action needed" chip when null.
  final String? actionLabel;

  const _StatusRow({
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.state,
    this.onTap,
    this.actionLabel,
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
                  // PR-HANGTIGHT-2026-09-06: rows can carry an explicit
                  // action ("Retry payment"); generic chip otherwise.
                  row.actionLabel ?? l10n.hangTightStatusActionNeeded,
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
/// the prominent correction card and its "Correct the details" CTA.
bool _isKycAttention(RiderModel? rider) {
  final s = rider?.kycStatus;
  return s == KycStatus.rejected || s == KycStatus.infoRequired;
}

/// PR-K.1: prominent card shown above the status list when KYC is in
/// the attention state. Two visual variants: red (REJECTED) and amber
/// (INFO_REQUIRED). One primary CTA — "Correct the details"
/// (PR-KYC-CORRECTION) — routes the rider to the onboarding step that
/// owns the first admin-flagged field.
class _KycRejectionCard extends StatelessWidget {
  final KycStatus kycStatus;
  final String? rejectionReason;

  /// PR-KYC-CORRECTION: canonical field keys the admin ticked in the
  /// Request Correction dialog. Rendered as chips so the rider knows
  /// exactly what to fix before tapping the CTA.
  final List<String> flaggedFields;
  final VoidCallback? onFixKyc;

  const _KycRejectionCard({
    required this.kycStatus,
    required this.rejectionReason,
    required this.flaggedFields,
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
    final buttonLabel = l10n?.hangTightCorrectDetails ?? 'Correct the details';
    // PR-KYC-CORRECTION: normalized flagged fields, form-ordered.
    final flagged = normalizeKycEditableFields(flaggedFields);

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
          if (flagged.isNotEmpty) ...[
            const SizedBox(height: Spacing.sm),
            Text(
              l10n?.hangTightCorrectionNeeded ?? 'Correction needed on:',
              style: AppTypography.labelSmall.copyWith(
                color: fgColor,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: Spacing.xs),
            Wrap(
              spacing: Spacing.xs,
              runSpacing: Spacing.xs,
              children: [
                for (final field in flagged)
                  Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: Spacing.sm,
                      vertical: 4,
                    ),
                    decoration: BoxDecoration(
                      color: colors.onSurface.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(AppRadius.full),
                      border: Border.all(
                        color: AppColors.warning,
                        width: 1,
                      ),
                    ),
                    child: Text(
                      kycCorrectionFieldLabel(field),
                      style: AppTypography.labelSmall.copyWith(
                        color: colors.onSurface,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
              ],
            ),
          ],
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
