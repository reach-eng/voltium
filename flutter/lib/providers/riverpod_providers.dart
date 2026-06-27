library;

/// Riverpod provider definitions for Voltium's domain providers.
///
/// These wrap the existing [ChangeNotifier]-based domain providers so screens
/// can gradually migrate from `context.read<AppProvider>()` / `context.read<RiderProvider>()`
/// to `ref.watch(riderProvider)` / `ref.read(riderProvider.notifier)`.
///
/// Migration pattern:
///   1. Import this file + `package:flutter_riverpod/flutter_riverpod.dart`
///   2. Change `extends StatelessWidget` → `extends ConsumerWidget`
///   3. Change `extends StatefulWidget` → `extends ConsumerStatefulWidget`
///   4. Replace `context.read<ProviderClass>()` with `ref.read(providerRef)`
///   5. Replace `context.watch<ProviderClass>()` with `ref.watch(providerRef)`
///
/// When all screens are migrated, delete:
///   - providers/app_provider.dart (the god composite)
///   - The MultiProvider wrapper in main.dart
///   - The `provider` dependency from pubspec.yaml
import 'package:flutter_riverpod/legacy.dart';

import 'rider_provider.dart';
import 'wallet_provider.dart';
import 'support_provider.dart';
import 'engagement_provider.dart';
import 'device_policy_provider.dart';
import 'connectivity_provider.dart';
import 'notification_provider.dart';
import 'locale_provider.dart';
import 'theme_provider.dart';

// ── Domain providers ──────────────────────────────────────────────────────

/// Riverpod provider for [RiderProvider].
/// Must be overridden in ProviderScope with the real instance from main.dart.
final riderProvider = ChangeNotifierProvider<RiderProvider>((ref) {
  throw UnimplementedError('RiderProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [WalletProvider].
final walletProvider = ChangeNotifierProvider<WalletProvider>((ref) {
  throw UnimplementedError('WalletProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [SupportProvider].
final supportProvider = ChangeNotifierProvider<SupportProvider>((ref) {
  throw UnimplementedError('SupportProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [EngagementProvider].
final engagementProvider = ChangeNotifierProvider<EngagementProvider>((ref) {
  throw UnimplementedError('EngagementProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [DevicePolicyProvider].
final devicePolicyProvider = ChangeNotifierProvider<DevicePolicyProvider>((ref) {
  throw UnimplementedError('DevicePolicyProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [ConnectivityProvider].
final connectivityProvider = ChangeNotifierProvider<ConnectivityProvider>((ref) {
  throw UnimplementedError('ConnectivityProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [NotificationProvider].
final notificationProvider = ChangeNotifierProvider<NotificationProvider>((ref) {
  throw UnimplementedError('NotificationProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [LocaleProvider].
final localeProviderRef = ChangeNotifierProvider<LocaleProvider>((ref) {
  throw UnimplementedError('LocaleProvider must be overridden in ProviderScope');
});

/// Riverpod provider for [ThemeProvider].
final themeProviderRef = ChangeNotifierProvider<ThemeProvider>((ref) {
  throw UnimplementedError('ThemeProvider must be overridden in ProviderScope');
});
