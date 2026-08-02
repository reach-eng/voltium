library;

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/legacy.dart';

import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';
import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart';
import 'package:voltium_rider/core/network/connectivity_provider.dart';
import 'package:voltium_rider/features/notifications/presentation/providers/notification_provider.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/services/emergency_contacts_service.dart';
import 'package:voltium_rider/features/auth/domain/repository.dart';
import 'package:voltium_rider/features/auth/data/repository_impl.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/features/profile/data/repository_impl.dart';
import 'package:voltium_rider/features/rentals/data/repository_impl.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
// ── Domain providers ──────────────────────────────────────────────────────

import 'package:universal_io/io.dart';

/// Riverpod provider for [AppProvider] (R4.3b).
///
/// `AppProvider` is still a `ChangeNotifier` shim (kept that way
/// so the legacy `ChangeNotifierProvider<AppProvider>` registration
/// in `main.dart` continues to compile). The new
/// `appStateViewProvider` (in `app_state_provider.dart`) is the
/// preferred modern source of truth — it derives from the
/// `appStateProvider` state machine and avoids the
/// `ChangeNotifier` boilerplate. R4.3c will fully retire the
/// `AppProvider` shim and remove this provider.
final appProvider = ChangeNotifierProvider<AppProvider>((ref) {
  throw UnimplementedError('AppProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [RiderProvider].
/// Must be overridden in ProviderScope with the real instance from main.dart.
final riderProvider = ChangeNotifierProvider<RiderProvider>((ref) {
  if (Platform.environment.containsKey('FLUTTER_TEST')) {
    final client = ApiClient();
    final vClient = VoltiumApiClient(client);
    return RiderProvider(
      riderRepository: RiderRepositoryImpl(client, vClient),
      rentalRepository: RentalRepositoryImpl(vClient),
      filesRepository: FilesRepository(client, vClient),
    );
  }
  throw UnimplementedError('RiderProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [WalletProvider].
final walletProvider = ChangeNotifierProvider<WalletProvider>((ref) {
  throw UnimplementedError(
      'WalletProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [SupportProvider].
final supportProvider = ChangeNotifierProvider<SupportProvider>((ref) {
  throw UnimplementedError(
      'SupportProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [EngagementProvider].
final engagementProvider = ChangeNotifierProvider<EngagementProvider>((ref) {
  throw UnimplementedError(
      'EngagementProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [DevicePolicyProvider].
final devicePolicyProvider =
    ChangeNotifierProvider<DevicePolicyProvider>((ref) {
  throw UnimplementedError(
      'DevicePolicyProvider must be overridden in ProviderScope');
});

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
