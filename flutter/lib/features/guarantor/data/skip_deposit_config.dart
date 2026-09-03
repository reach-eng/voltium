// PR-GUARANTOR-SKIP (2026-08-28): the "Skip guarantor" path on the
// guarantor onboarding screen requires a higher security deposit, whose
// amount is admin-managed from the admin panel's Configurations section.
// The admin panel writes the amount to `/api/admin/config/skip-guarantor`
// (key: `extraDepositRupees`); the rider app reads it via this provider.
//
// The provider returns a `SkipDepositConfig` with a `source` field so the
// UI can label the amount as "(configured by Voltium)" or "(default —
// admin has not set a value yet)".

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';

/// How the deposit amount was resolved. Surfaced in the dialog so the
/// rider can see whether the value is admin-curated or a fallback.
enum SkipDepositSource {
  /// Served by `/api/admin/config/skip-guarantor` (admin-curated).
  admin,

  /// Endpoint not reachable or returned no value; using a sensible default.
  fallback,
}

class SkipDepositConfig {
  final double extraDepositRupees;
  final SkipDepositSource source;

  const SkipDepositConfig({
    required this.extraDepositRupees,
    required this.source,
  });

  /// Fallback amount (rupees) used when the admin endpoint is unreachable
  /// or hasn't been seeded yet. 1000 ₹ is the post-launch default; the
  /// admin panel can override it at any time without an app release.
  static const double fallbackRupees = 1000;
}

/// Reads the admin-configured skip-guarantor deposit amount via rider config endpoint.
final skipDepositConfigProvider =
    FutureProvider<SkipDepositConfig>((ref) async {
  try {
    final client = ref.read(apiClientProvider);
    final response = await client.get('/api/rider/config/skip-deposit');
    final data = response['data'] ?? response;
    final amount = data is Map && data['extraDepositRupees'] is num
        ? (data['extraDepositRupees'] as num).toDouble()
        : SkipDepositConfig.fallbackRupees;
    return SkipDepositConfig(
      extraDepositRupees: amount,
      source: SkipDepositSource.admin,
    );
  } catch (_) {
    return const SkipDepositConfig(
      extraDepositRupees: SkipDepositConfig.fallbackRupees,
      source: SkipDepositSource.fallback,
    );
  }
});
