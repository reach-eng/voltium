import 'package:flutter/foundation.dart';
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

RiderProvider _createDefaultRiderProvider() {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  return RiderProvider(
    riderRepository: RiderRepositoryImpl(client, vClient),
    rentalRepository: RentalRepositoryImpl(vClient),
    filesRepository: FilesRepository(client, vClient),
  );
}

WalletProvider _createDefaultWalletProvider() {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  return WalletProvider(
    walletRepository: WalletRepositoryImpl(client, vClient),
    filesRepository: FilesRepository(client, vClient),
  );
}

SupportProvider _createDefaultSupportProvider() {
  final client = ApiClient();
  final vClient = VoltiumApiClient(client);
  return SupportProvider(repository: SupportRepositoryImpl(vClient));
}

/// Compatibility facade layer for AppProvider (PR-L / Ticket #65).
///
/// Unblocks `flutter analyze` and tests that transitively import [AppProvider].
/// New code should prefer reading individual Riverpod providers or [RiderModel] directly.
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

  bool get isReady => _rider != null;
  bool get isOnboarded => _rider?.pickupDone ?? false;
  bool get isPickupDone => _rider?.isPickupDone ?? false;
  bool get isRegistrationDone => _rider?.registrationDone ?? false;
  String? get lifecycleStatus => _rider?.lifecycleStatus;

  RiderModel? get rider => _rider;
}
