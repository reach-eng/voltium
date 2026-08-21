// library directive omitted — using Dart 3 default library.
// (R4.3c-4: the `library;` directive was hiding the new exports.)

import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:voltium_rider/core/network/connectivity_provider.dart';
import 'package:voltium_rider/features/notifications/presentation/providers/notification_provider.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/services/emergency_contacts_service.dart';
import 'package:voltium_rider/features/auth/domain/repository.dart';
import 'package:voltium_rider/features/auth/data/repository_impl.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';

// Note: The exports below make the migrated feature providers
// visible to anyone who imports `riverpod_providers.dart`.

// R4.3c-4: Re-export the migrated feature providers so call sites
// that import `riverpod_providers.dart` keep working with the same
// symbol names.
export 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart'
    show walletProvider, filesRepositoryProvider, walletRepositoryProvider;
export 'package:voltium_rider/features/wallet/presentation/providers/top_up_flow_provider.dart'
    show topUpFlowProvider;
export 'package:voltium_rider/features/support/presentation/providers/support_provider.dart'
    show supportProvider, supportRepositoryProvider;
export 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart'
    show engagementProvider, engagementApiProvider;
export 'package:voltium_rider/core/network/connectivity_provider.dart'
    show connectivityProvider;
export 'package:voltium_rider/features/notifications/presentation/providers/notification_provider.dart'
    show notificationProvider;
export 'package:voltium_rider/services/emergency_contacts_service.dart'
    show emergencyContactsServiceProvider;
export 'package:voltium_rider/core/localization/locale_provider.dart'
    show localeProvider;
export 'package:voltium_rider/theme/theme_provider.dart' show themeProvider;
export 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart'
    show devicePolicyProvider;
export 'package:voltium_rider/core/state/rider_provider.dart'
    show riderProvider, DataState;

// PR-3 (2026-08-21): removed the AppProvider shim. Every notifier is now
// wired directly through Riverpod. The legacy `appProvider` stub and the
// `_createDefaultRiderProvider`/`_createDefaultWalletProvider` factories
// are gone — they were allocating a fresh `ProviderContainer` per
// feature on every `AppProvider()` construction, leaking state across
// tests. Tests that previously did `appProvider.overrideWith(...)` now
// override the underlying feature providers (`riderProvider`,
// `walletProvider`, `supportProvider`, `engagementProvider`,
// `devicePolicyProvider`) directly.

// Legacy alias names — kept so call sites that imported the *Ref suffixed
// names still resolve. The alias points at the same underlying Riverpod
// provider; nothing else to wire.
final connectivityProviderRef = connectivityProvider;
final notificationProviderRef = notificationProvider;
final localeProviderRef = localeProvider;
final themeProviderRef = themeProvider;
final emergencyContactsService = emergencyContactsServiceProvider;

/// Riverpod provider for [AuthRepository].
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final client = ApiClient();
  return AuthRepositoryImpl(client, VoltiumApiClient(client));
});

/// PR-13 (2026-08-22): Riverpod provider for the generated
/// [VoltiumApiClient]. Replaces the `VoltiumApiService` singleton —
/// the wrapper used to own one [VoltiumApiClient] per process; now
/// the provider is the canonical place to get one. Tests can
/// override this to inject a fake.
///
/// Callers in widget/provider contexts should prefer
/// `ref.read(voltiumApiClientProvider).methodName(args)`. Callers
/// in non-widget contexts (singletons, services) can construct
/// `VoltiumApiClient(ApiClient())` ad hoc.
final voltiumApiClientProvider = Provider<VoltiumApiClient>((ref) {
  return VoltiumApiClient(ApiClient());
});

/// PR-13 (2026-08-22): Riverpod provider for the untyped [ApiClient]
/// (the legacy HTTP transport used for the untyped REST paths
/// that aren't in the generated client). Most notifiers that need
/// this also read [voltiumApiClientProvider]; both are sourced from
/// the same [ApiClient] under the hood so the shared HTTP client
/// (and pinned TLS) is reused.
final apiClientProvider = Provider<ApiClient>((ref) {
  return ApiClient();
});
