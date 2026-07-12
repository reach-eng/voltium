library;

import 'package:flutter_riverpod/legacy.dart';

import 'package:voltium_rider/core/state/rider_provider.dart';
import 'package:voltium_rider/core/state/app_provider.dart';
import 'package:voltium_rider/features/wallet/presentation/providers/wallet_provider.dart';
import 'package:voltium_rider/features/support/presentation/providers/support_provider.dart';
import 'package:voltium_rider/features/dashboard/presentation/providers/engagement_provider.dart';
import 'package:voltium_rider/features/device_compliance/presentation/providers/device_policy_provider.dart';
import 'package:voltium_rider/core/network/connectivity_provider.dart';
import 'package:voltium_rider/features/notifications/presentation/providers/notification_provider.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/theme_provider.dart';
import 'package:voltium_rider/services/emergency_contacts_service.dart';
// ── Domain providers ──────────────────────────────────────────────────────

/// Riverpod provider for [AppProvider] (composite god provider).
/// Must be overridden in ProviderScope with the real instance from main.dart.
final appProvider = ChangeNotifierProvider<AppProvider>((ref) {
  throw UnimplementedError('appProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [RiderProvider].
/// Must be overridden in ProviderScope with the real instance from main.dart.
final riderProvider = ChangeNotifierProvider<RiderProvider>((ref) {
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
