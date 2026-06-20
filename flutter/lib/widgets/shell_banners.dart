import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../models/rider_model.dart';
import '../theme/app_theme.dart';

/// Global banners that match the web app's SuspensionBanner and SyncBanner.
/// These should be placed inside the global AppShell to remain visible across screens.

class SyncBanner extends StatelessWidget {
  const SyncBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final isOnline = context.select<AppProvider, bool>((p) => p.isOnline);
    final pendingCount = context.select<AppProvider, int>((p) => p.pendingSyncCount);

    if (isOnline && pendingCount == 0) return const SizedBox.shrink();

    return AnimatedContainer(
      duration: const Duration(milliseconds: 300),
      curve: Curves.easeInOut,
      width: double.infinity,
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: isOnline ? const Color(0xFFF0FDF4) : const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isOnline ? const Color(0xFFDCFCE7) : AppColors.outlineVariant,
        ),
      ),
      child: Row(
        children: [
          Icon(
            isOnline ? Icons.check_circle_outline : Icons.wifi_off_outlined,
            size: 20,
            color: isOnline ? const Color(0xFF22C55E) : AppColors.slate500,
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  isOnline ? 'Syncing...' : 'You\'re Offline',
                  style: TextStyle(
                    fontSize: 14,
                    fontWeight: FontWeight.bold,
                    color: isOnline
                        ? const Color(0xFF166534)
                        : const Color(0xFF1E293B),
                  ),
                ),
                Text(
                  pendingCount > 0
                      ? '$pendingCount action${pendingCount > 1 ? 's' : ''} will sync ${isOnline ? 'now' : 'later'}'
                      : 'Data shown may be outdated',
                  style: TextStyle(
                    fontSize: 12,
                    color: isOnline
                        ? const Color(0xFF16A34A)
                        : AppColors.slate500,
                  ),
                ),
              ],
            ),
          ),
          if (pendingCount > 0)
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: isOnline
                    ? const Color(0xFFDCFCE7)
                    : AppColors.iconBackground,
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                '$pendingCount',
                style: TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                  color: isOnline
                      ? const Color(0xFF15803D)
                      : const Color(0xFF475569),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class SuspensionBanner extends StatefulWidget {
  const SuspensionBanner({super.key});

  @override
  State<SuspensionBanner> createState() => _SuspensionBannerState();
}

class _SuspensionBannerState extends State<SuspensionBanner> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final rider = context.select<AppProvider, RiderModel?>((p) => p.rider);
    if (rider == null) return const SizedBox.shrink();

    // Mirroring web's getSuspensionReasons logic
    final List<_Reason> reasons = [];
    final status = rider.accountStatus;

    if (status == AccountStatus.active &&
        (rider.lifecycleStatus.isEmpty || _lifecycleRank(rider) < 12)) {
      return const SizedBox.shrink();
    }

    if (rider.walletBalance < 0) {
      reasons.add(const _Reason(
        title: 'Wallet Balance Below ₹0',
        description: 'Top up to restore your account.',
        severity: _Severity.critical,
      ),);
    } else if (rider.walletBalance < 50) {
      reasons.add(const _Reason(
        title: 'Low Wallet Balance',
        description: 'Daily charges may cause suspension.',
        severity: _Severity.warning,
      ),);
    }

    if (rider.kycStatus != KycStatus.verified) {
      reasons.add(_Reason(
        title: 'KYC Verification Pending',
        description: 'Complete verification to activate.',
        severity: rider.kycStatus == KycStatus.rejected
            ? _Severity.critical
            : _Severity.warning,
      ),);
    }

    if (rider.planStatus == 'EXPIRED' ||
        (rider.lifecycleStatus.isNotEmpty && _lifecycleRank(rider) >= 13)) {
      reasons.add(const _Reason(
        title: 'Subscription Expired',
        description: 'Select a new plan to continue.',
        severity: _Severity.critical,
      ),);
    }

    if (reasons.isEmpty) return const SizedBox.shrink();

    // Sort: critical first
    reasons.sort((a, b) => a.severity == _Severity.critical ? -1 : 1);

    final topReason = reasons.first;
    final isCritical = topReason.severity == _Severity.critical;

    return Container(
      margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: isCritical ? const Color(0xFFFEF2F2) : const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: isCritical ? const Color(0xFFFECACA) : const Color(0xFFFDE68A),
        ),
      ),
      child: Column(
        children: [
          ListTile(
            onTap: () => setState(() => _expanded = !_expanded),
            leading: Icon(
              isCritical ? Icons.error_outline : Icons.warning_amber_outlined,
              color: isCritical
                  ? AppColors.error
                  : AppColors.warning,
            ),
            title: Text('Action Required',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: isCritical
                    ? const Color(0xFF991B1B)
                    : AppColors.warningText,
              ),
            ),
            subtitle: Text(
              topReason.title +
                  (reasons.length > 1 ? ' + ${reasons.length - 1} more' : ''),
              style: TextStyle(
                fontSize: 12,
                color: isCritical
                    ? const Color(0xFFDC2626)
                    : AppColors.warningDark,
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
                      color: isCritical
                          ? AppColors.errorLight
                          : AppColors.warningLight,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${reasons.length}',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: isCritical
                            ? AppColors.errorDark
                            : const Color(0xFFB45309),
                      ),
                    ),
                  ),
                Icon(
                  _expanded ? Icons.expand_less : Icons.expand_more,
                  color: isCritical
                      ? const Color(0xFF991B1B)
                      : AppColors.warningText,
                ),
              ],
            ),
          ),
          if (_expanded)
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
              child: Column(
                children: reasons
                    .map((r) => Padding(
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
                                      ? Colors.red
                                      : Colors.orange,
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      r.title,
                                      style: const TextStyle(
                                          fontSize: 13,
                                          fontWeight: FontWeight.bold,),
                                    ),
                                    Text(
                                      r.description,
                                      style: const TextStyle(
                                          fontSize: 12, color: Colors.black54,),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),)
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
  const _Reason(
      {required this.title, required this.description, required this.severity,});
}

int _lifecycleRank(RiderModel rider) {
  const rank = <String, int>{
    'NEW': 0,
    'PHONE_VERIFIED': 1,
    'PROFILE_SUBMITTED': 2,
    'KYC_SUBMITTED': 3,
    'KYC_APPROVED': 4,
    'GUARANTOR_SUBMITTED': 5,
    'GUARANTOR_APPROVED': 6,
    'DEPOSIT_PENDING': 7,
    'DEPOSIT_APPROVED': 8,
    'PLAN_SELECTED': 9,
    'PICKUP_SCHEDULED': 10,
    'ACTIVE': 11,
    'SUSPENDED': 12,
    'RETURN_PENDING': 13,
    'CLOSED': 14,
  };
  return rank[rider.lifecycleStatus] ?? 0;
}
