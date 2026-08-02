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
import 'package:voltium_rider/core/state/app_provider.dart';

// Note: The exports below make the migrated feature providers
// visible to anyone who imports `riverpod_providers.dart`. The
// imports above are still required for the file's own scope
// (the `final xxxRef = xxx` aliases below reference the symbols
// defined in those files).

// R4.3c-4: Re-export the migrated feature providers so call sites
// that import `riverpod_providers.dart` keep working with the same
// symbol names.
export 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart'
    show walletProvider, filesRepositoryProvider, walletRepositoryProvider;
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

/// Riverpod provider for [AppProvider] (PR-53).
final appProvider = Provider<AppProvider>((ref) {
  throw UnimplementedError('AppProvider must be overridden in ProviderScope');
});

// R4.3c-6: RiderProvider is now backed by [RiderNotifier] (Riverpod v3) —
// see `lib/core/state/rider_provider.dart` for the canonical definition.
// Re-exported via the export clause at the top of this file. The
// `AppProvider` shim in `app_provider.dart` constructs the notifier
// instance directly via `_createDefaultRiderProvider()` and injects
// it through `ProviderScope.overrides` in `main.dart`.

// R4.3c-4: Wallet/Support/Engagement providers are now defined in
// their own files as Riverpod v3 NotifierProviders. They are
// re-exported here so call sites that import
// `riverpod_providers.dart` keep working with the same names.

// R4.3c-5: DevicePolicyProvider is now backed by
// [DevicePolicyNotifier] (Riverpod v3) — see
// `lib/features/device_compliance/presentation/providers/device_policy_provider.dart`
// for the canonical definition. Re-exported via the export
// clause at the top of this file.

/// Riverpod provider for [ConnectivityProvider] (R4.3c-3).
///
/// Now backed by [ConnectivityNotifier] (Riverpod v3) — see
/// `lib/core/network/connectivity_provider.dart` for the
/// canonical definition. Re-exported under the legacy
/// `connectivityProvider` name so call sites importing
/// `riverpod_providers.dart` keep working.
final connectivityProviderRef = connectivityProvider;

/// Riverpod provider for [NotificationProvider] (R4.3c-2).
///
/// Now backed by [NotificationNotifier] (Riverpod v3) — see
/// `lib/features/notifications/presentation/providers/notification_provider.dart`
/// for the canonical definition. The local name
/// `notificationProvider` (defined in that file) is re-exported
/// here so call sites that import `riverpod_providers.dart` keep
/// working.
final notificationProviderRef = notificationProvider;

/// Riverpod provider for [LocaleProvider] (R4.3c-1).
///
/// Now backed by [LocaleNotifier] (Riverpod v3) — see
/// `lib/core/localization/locale_provider.dart` for the canonical
/// definition. The legacy `localeProviderRef` alias is kept for
/// backwards compat with call sites that haven't migrated yet.
final localeProviderRef = localeProvider;

/// Riverpod provider for [ThemeProvider] (R4.3c-1).
///
/// Now backed by [ThemeNotifier] (Riverpod v3) — see
/// `lib/theme/theme_provider.dart` for the canonical definition.
/// The legacy `themeProviderRef` alias is kept for backwards compat
/// with call sites that haven't migrated yet.
final themeProviderRef = themeProvider;

/// Riverpod provider for [EmergencyContactsService] (R4.3c-2).
///
/// Now backed by [EmergencyContactsNotifier] (Riverpod v3) — see
/// `lib/services/emergency_contacts_service.dart` for the
/// canonical definition. Re-exported under the legacy
/// `emergencyContactsService` name so call sites importing
/// `riverpod_providers.dart` keep working.
final emergencyContactsService = emergencyContactsServiceProvider;

/// Riverpod provider for [AuthRepository].
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final client = ApiClient();
  return AuthRepositoryImpl(client, VoltiumApiClient(client));
});
