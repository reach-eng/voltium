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

/// Riverpod provider for [AppProvider].
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

/// Riverpod provider for [ConnectivityProvider].
final connectivityProvider =
    ChangeNotifierProvider<ConnectivityProvider>((ref) {
  throw UnimplementedError(
      'ConnectivityProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [NotificationProvider].
final notificationProvider =
    ChangeNotifierProvider<NotificationProvider>((ref) {
  throw UnimplementedError(
      'NotificationProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [LocaleProvider].
final localeProviderRef = ChangeNotifierProvider<LocaleProvider>((ref) {
  throw UnimplementedError(
      'LocaleProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [ThemeProvider].
final themeProviderRef = ChangeNotifierProvider<ThemeProvider>((ref) {
  throw UnimplementedError('ThemeProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [EmergencyContactsService].
final emergencyContactsService =
    ChangeNotifierProvider<EmergencyContactsService>((ref) {
  throw UnimplementedError(
      'emergencyContactsService must be overridden in ProviderScope');
});

/// Riverpod provider for [AuthRepository].
final authRepositoryProvider = Provider<AuthRepository>((ref) {
  final client = ApiClient();
  return AuthRepositoryImpl(client, VoltiumApiClient(client));
});
