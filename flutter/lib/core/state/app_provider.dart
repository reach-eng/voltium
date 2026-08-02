// R4.3b — AppProvider shim backed by `appStateViewProvider`.
//
// Previously this file declared a `class AppProvider extends ChangeNotifier`
// with explicit defaults for `RiderProvider`, `WalletProvider`, etc. After
// the Riverpod migration (R4.3b-d) those defaults are no longer needed:
// every provider is now exposed via Riverpod and `main.dart` registers
// them. This file remains as a thin compatibility layer for code that
// still imports `AppProvider` directly (e.g. `injectedAppProvider` test
// hook in `main.dart`).
//
// New code should prefer:
//   - `ref.watch(appStateProvider)` for the state machine
//   - `ref.watch(appStateViewProvider)` for derived view fields
//   - `ref.read(riderProvider)` etc. for individual feature providers

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';
import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart';
import 'package:voltium_rider/core/network/connectivity_provider.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/files_repository.dart';
import 'package:voltium_rider/features/profile/data/repository_impl.dart';
import 'package:voltium_rider/features/rentals/data/repository_impl.dart';
import 'package:voltium_rider/features/support/data/repository_impl.dart';
import 'package:voltium_rider/features/wallet/data/repository_impl.dart';
import 'package:voltium_rider/core/state/app_state_provider.dart';

RiderProvider _createDefaultRiderProvider() {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  return RiderProvider(
    riderRepository: RiderRepositoryImpl(client, vClient),
    rentalRepository: RentalRepositoryImpl(vClient),
    filesRepository: FilesRepository(client, vClient),
  );
}

/// R4.3c-4: WalletProvider is now a Riverpod v3 Notifier. The
/// AppProvider shim holds a [ProviderContainer] that the notifier
/// can read repositories from. We construct the real repositories
/// here and register them as Riverpod providers, then return the
/// notifier instance.
WalletProvider _createDefaultWalletProvider() {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  final container = ProviderContainer(
    overrides: [
      walletRepositoryProvider
          .overrideWithValue(WalletRepositoryImpl(client, vClient)),
      filesRepositoryProvider
          .overrideWithValue(FilesRepository(client, vClient)),
    ],
  );
  return container.read(walletProvider.notifier);
}

SupportProvider _createDefaultSupportProvider() {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  final container = ProviderContainer(
    overrides: [
      supportRepositoryProvider
          .overrideWithValue(SupportRepositoryImpl(vClient)),
    ],
  );
  return container.read(supportProvider.notifier);
}

/// Compatibility facade layer for AppProvider (PR-L / Ticket #65).
///
/// Unblocks `flutter analyze` and tests that transitively import [AppProvider].
/// New code should prefer reading individual Riverpod providers or [RiderModel] directly.
///
/// R4.3b: still a `ChangeNotifier` so the legacy
/// `ChangeNotifierProvider<AppProvider>` registration in `main.dart`
/// continues to compile while we migrate call sites one at a time.
/// The new `appStateViewProvider` (in `app_state_provider.dart`) is
/// the preferred modern source of truth — see that file for details.
class AppProvider extends ChangeNotifier {
  final RiderModel? _rider;
  final RiderProvider riderProvider;
  final WalletProvider walletProvider;
  final SupportProvider supportProvider;
  final EngagementProvider engagementProvider;
  final DevicePolicyProvider devicePolicyProvider;
  final ConnectivityProvider connectivityProvider;

  AppProvider({
    RiderModel? rider,
    RiderProvider? riderProvider,
    WalletProvider? walletProvider,
    SupportProvider? supportProvider,
    EngagementProvider? engagementProvider,
    DevicePolicyProvider? devicePolicyProvider,
    ConnectivityProvider? connectivityProvider,
  })  : _rider = rider,
        riderProvider = riderProvider ?? _createDefaultRiderProvider(),
        walletProvider = walletProvider ?? _createDefaultWalletProvider(),
        supportProvider = supportProvider ?? _createDefaultSupportProvider(),
        engagementProvider = engagementProvider ?? EngagementProvider(),
        devicePolicyProvider = devicePolicyProvider ?? DevicePolicyProvider(),
        connectivityProvider = connectivityProvider ?? ConnectivityProvider();

  /// Modern: derive these from the [AppStateView] passed in.
  AppProvider.fromView({
    required AppStateView view,
    RiderProvider? riderProvider,
    WalletProvider? walletProvider,
    SupportProvider? supportProvider,
    EngagementProvider? engagementProvider,
    DevicePolicyProvider? devicePolicyProvider,
    ConnectivityProvider? connectivityProvider,
  })  : _rider = view.rider,
        riderProvider = riderProvider ?? _createDefaultRiderProvider(),
        walletProvider = walletProvider ?? _createDefaultWalletProvider(),
        supportProvider = supportProvider ?? _createDefaultSupportProvider(),
        engagementProvider = engagementProvider ?? EngagementProvider(),
        devicePolicyProvider = devicePolicyProvider ?? DevicePolicyProvider(),
        connectivityProvider = connectivityProvider ?? ConnectivityProvider();

  bool get isReady => _rider != null;
  bool get isOnboarded => _rider?.pickupDone ?? false;
  bool get isPickupDone => _rider?.isPickupDone ?? false;
  bool get isRegistrationDone => _rider?.registrationDone ?? false;
  String? get lifecycleStatus => _rider?.lifecycleStatus;

  RiderModel? get rider => _rider;
}
