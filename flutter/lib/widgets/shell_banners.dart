import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../theme/app_theme.dart';
import '../models/rider_model.dart';

/// Global banners that match the web app's SuspensionBanner and SyncBanner.
/// These should be placed inside the global AppShell to remain visible across screens.

class SyncBanner extends StatelessWidget {
  const SyncBanner({super.key});

  @override
  Widget build(BuildContext context) {
    final provider = context.watch<AppProvider>();
    final isOnline = provider.isOnline;
    final pendingCount = provider.pendingSyncCount;

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
          color: isOnline ? const Color(0xFFDCFCE7) : const Color(0xFFE2E8F0),
        ),
      ),
      child: Row(
        children: [
          Icon(
            isOnline ? Icons.check_circle_outline : Icons.wifi_off_outlined,
            size: 20,
            color: isOnline ? const Color(0xFF22C55E) : const Color(0xFF64748B),
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
                        : const Color(0xFF64748B),
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
                    : const Color(0xFFF1F5F9),
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
    final rider = context.watch<AppProvider>().rider;
    if (rider == null) return const SizedBox.shrink();

    // Mirroring web's getSuspensionReasons logic
    final List<_Reason> reasons = [];
    final status = rider.accountStatus;

    if (status == AccountStatus.ACTIVE) return const SizedBox.shrink();

    if (rider.walletBalance < 0) {
      reasons.add(const _Reason(
        title: 'Wallet Balance Below ₹0',
        description: 'Top up to restore your account.',
        severity: _Severity.critical,
      ));
    } else if (rider.walletBalance < 50) {
      reasons.add(const _Reason(
        title: 'Low Wallet Balance',
        description: 'Daily charges may cause suspension.',
        severity: _Severity.warning,
      ));
    }

    if (rider.kycStatus != KycStatus.VERIFIED) {
      reasons.add(_Reason(
        title: 'KYC Verification Pending',
        description: 'Complete verification to activate.',
        severity: rider.kycStatus == KycStatus.REJECTED
            ? _Severity.critical
            : _Severity.warning,
      ));
    }

    if (rider.planStatus == 'EXPIRED') {
      reasons.add(const _Reason(
        title: 'Subscription Expired',
        description: 'Select a new plan to continue.',
        severity: _Severity.critical,
      ));
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
                  ? const Color(0xFFEF4444)
                  : const Color(0xFFF59E0B),
            ),
            title: Text(
              'Action Required',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: isCritical
                    ? const Color(0xFF991B1B)
                    : const Color(0xFF92400E),
              ),
            ),
            subtitle: Text(
              topReason.title +
                  (reasons.length > 1 ? ' + ${reasons.length - 1} more' : ''),
              style: TextStyle(
                fontSize: 12,
                color: isCritical
                    ? const Color(0xFFDC2626)
                    : const Color(0xFFD97706),
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
                          ? const Color(0xFFFEE2E2)
                          : const Color(0xFFFEF3C7),
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      '${reasons.length}',
                      style: TextStyle(
                        fontSize: 10,
                        fontWeight: FontWeight.bold,
                        color: isCritical
                            ? const Color(0xFFB91C1C)
                            : const Color(0xFFB45309),
                      ),
                    ),
                  ),
                Icon(
                  _expanded ? Icons.expand_less : Icons.expand_more,
                  color: isCritical
                      ? const Color(0xFF991B1B)
                      : const Color(0xFF92400E),
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
                                          fontWeight: FontWeight.bold),
                                    ),
                                    Text(
                                      r.description,
                                      style: const TextStyle(
                                          fontSize: 12, color: Colors.black54),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ))
                    .toList(),
              ),
            ),
        ],
      ),
    );
  }
}

enum _Severity { critical, warning, info }

class _Reason {
  final String title;
  final String description;
  final _Severity severity;
  const _Reason(
      {required this.title, required this.description, required this.severity});
}
