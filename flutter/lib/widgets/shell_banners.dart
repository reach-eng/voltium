import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../models/rider_model.dart';
import '../theme/app_theme.dart';
import '../utils/lifecycle_rank.dart';

import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Global banners that match the web app's SuspensionBanner and SyncBanner.
/// These should be placed inside the global AppShell to remain visible across screens.

class SyncBanner extends ConsumerWidget {
  const SyncBanner({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final isOnline = ref.watch(connectivityProvider.select((p) => p.isOnline));
    final pendingCount =
        ref.watch(connectivityProvider.select((p) => p.pendingSyncCount));

    if (isOnline && pendingCount == 0) return const SizedBox.shrink();

    final colors = AppColors.of(context);
    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isOnline ? colors.successLight : colors.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(
          color: isOnline ? colors.successLight : colors.outlineVariant,
        ),
      ),
      child: Row(
        children: [
          Icon(
            isOnline ? Icons.check_circle_outline : Icons.wifi_off_outlined,
            size: 20,
            color: isOnline
                ? (Theme.of(context).brightness == Brightness.dark
                    ? colors.successLightForeground
                    : AppColors.success)
                : colors.onSurfaceVariant,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isOnline ? 'Syncing...' : 'You\'re Offline',
                  style: AppTypography.bodyMedium
                      .copyWith(fontWeight: FontWeight.w600)
                      .copyWith(
                          color: isOnline
                              ? colors.successLightForeground
                              : colors.onSurface),
                ),
                Text(
                  pendingCount > 0
                      ? '$pendingCount action${pendingCount > 1 ? 's' : ''} will sync ${isOnline ? 'now' : 'later'}'
                      : 'Data shown may be outdated',
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: isOnline
                        ? colors.successLightForeground
                        : colors.onSurfaceVariant,
                  ),
                ),
              ],
            ),
          ),
          if (pendingCount > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isOnline ? colors.successLight : colors.card,
                borderRadius: BorderRadius.circular(AppRadius.lg),
              ),
              child: Text(
                '$pendingCount',
                style: AppTypography.labelSmall.copyWith(
                    color: isOnline
                        ? colors.successLightForeground
                        : colors.onSurfaceVariant),
              ),
            ),
        ],
      ),
    );
  }
}

class SuspensionBanner extends ConsumerStatefulWidget {
  const SuspensionBanner({super.key});

  @override
  ConsumerState<SuspensionBanner> createState() => _SuspensionBannerState();
}

class _SuspensionBannerState extends ConsumerState<SuspensionBanner> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final rider = ref.watch(riderProvider.select((p) => p.rider));
    if (rider == null) return const SizedBox.shrink();

    final colors = AppColors.of(context);

    // Mirroring web's getSuspensionReasons logic
    final List<_Reason> reasons = [];
    final status = rider.accountStatus;

    if (status == AccountStatus.active &&
        (rider.lifecycleStatus.isEmpty || lifecycleRank(rider) < 12)) {
      return const SizedBox.shrink();
    }

    if (rider.walletBalance < 0) {
      reasons.add(
        const _Reason(
          title: 'Wallet Balance Below ₹0',
          description: 'Top up to restore your account.',
          severity: _Severity.critical,
        ),
      );
    } else if (rider.walletBalance < 50) {
      reasons.add(
        const _Reason(
          title: 'Low Wallet Balance',
          description: 'Daily charges may cause suspension.',
          severity: _Severity.warning,
        ),
      );
    }

    if (rider.kycStatus != KycStatus.verified) {
      reasons.add(
        _Reason(
          title: 'KYC Verification Pending',
          description: 'Complete verification to activate.',
          severity: rider.kycStatus == KycStatus.rejected
              ? _Severity.critical
              : _Severity.warning,
        ),
      );
    }

    if (rider.planStatus == 'EXPIRED' ||
        (rider.lifecycleStatus.isNotEmpty && lifecycleRank(rider) >= 13)) {
      reasons.add(
        const _Reason(
          title: 'Subscription Expired',
          description: 'Select a new plan to continue.',
          severity: _Severity.critical,
        ),
      );
    }

    if (reasons.isEmpty) return const SizedBox.shrink();

    // Sort: critical first
    // AUDIT FIX (testing/widgets P1): the old comparator violated the
    // Sort contract (not antisymmetric for critical-vs-critical) and could
    // throw "Comparison method violates its general contract".
    reasons.sort((a, b) => b.severity.index.compareTo(a.severity.index));

    final topReason = reasons.first;
    final isCritical = topReason.severity == _Severity.critical;

    final bannerBg = isCritical ? colors.errorLight : colors.warningLight;
    final bannerFg = isCritical
        ? colors.errorLightForeground
        : colors.warningLightForeground;
    final bannerBorder = isCritical
        ? colors.error.withValues(alpha: 0.3)
        : colors.warning.withValues(alpha: 0.3);

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: bannerBg,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: bannerBorder),
      ),
      child: Column(
        children: [
          ListTile(
            onTap: () => setState(() => _expanded = !_expanded),
            leading: Icon(
              isCritical ? Icons.error_outline : Icons.warning_amber_outlined,
              color: bannerFg,
            ),
            title: Text(
              'Action Required',
              style: AppTypography.bodyMedium
                  .copyWith(fontWeight: FontWeight.w600)
                  .copyWith(color: bannerFg),
            ),
            subtitle: Text(
              topReason.title +
                  (reasons.length > 1 ? ' + ${reasons.length - 1} more' : ''),
              style: GoogleFonts.plusJakartaSans(
                fontSize: 12,
                color: bannerFg.withValues(alpha: 0.9),
              ),
            ),
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                if (reasons.length > 1)
                  Container(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                    decoration: BoxDecoration(
                      color: bannerBg,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${reasons.length}',
                      style: AppTypography.labelSmall
                          .copyWith(fontSize: 10)
                          .copyWith(color: bannerFg),
                    ),
                  ),
                Icon(
                  _expanded ? Icons.expand_less : Icons.expand_more,
                  color: bannerFg,
                ),
              ],
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                children: reasons
                    .map(
                      (r) => Padding(
                        padding: const EdgeInsets.only(top: 12),
                        child: Row(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Container(
                              margin: const EdgeInsets.only(top: 4),
                              width: 6,
                              height: 6,
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: r.severity == _Severity.critical
                                    ? AppColors.error
                                    : AppColors.warning,
                              ),
                            ),
                            const SizedBox(width: 12),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    r.title,
                                    style: AppTypography.bodyMedium.copyWith(
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                      color: colors.onSurface,
                                    ),
                                  ),
                                  Text(
                                    r.description,
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
                      ),
                    )
                    .toList(),
              ),
            ),
        ],
      ),
    );
  }
}

enum _Severity { critical, warning }

class _Reason {
  final String title;
  final String description;
  final _Severity severity;
  const _Reason({
    required this.title,
    required this.description,
    required this.severity,
  });
}
