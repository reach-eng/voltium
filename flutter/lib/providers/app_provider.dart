import 'dart:async';
import 'dart:io';
import 'package:flutter/foundation.dart';
import '../models/rider_model.dart';
import '../models/support_model.dart';
import '../models/transaction_model.dart';
import '../models/reward_model.dart';
import '../models/notification_model.dart';
import '../services/api_service.dart';
import '../services/performance_service.dart';
import '../app/router.dart';
export 'rider_provider.dart' show DataState;
import 'rider_provider.dart';
import 'wallet_provider.dart';
import 'support_provider.dart';
import 'engagement_provider.dart';
import 'device_policy_provider.dart';
import 'connectivity_provider.dart';

import '../core/network/api_client.dart';
import '../core/network/generated/api_client.dart';
import '../core/network/files_repository.dart';
import '../features/wallet/data/repository_impl.dart';

import '../features/profile/data/repository_impl.dart';
import '../features/support/data/repository_impl.dart';
import '../features/rentals/data/repository_impl.dart';

/// Composite provider that orchestrates all domain providers.
///
/// Provides backward-compatible delegation so existing screens using
/// `context.read<AppProvider>().rider` continue to work without changes.
/// New screens should prefer the specific domain providers directly:
/// `context.read<RiderProvider>()`, `context.read<WalletProvider>()`, etc.
class AppProvider extends ChangeNotifier {
  late final ApiClient apiClient;
  late final VoltiumApiClient voltiumApiClient;
  late final FilesRepository filesRepository;

  AppProvider({String? riderId, String? phone}) {
    apiClient = ApiClient();
    voltiumApiClient = VoltiumApiClient(apiClient);
    filesRepository = FilesRepository(apiClient, voltiumApiClient);
    final walletRepository = WalletRepositoryImpl(apiClient, voltiumApiClient);
    final riderRepository = RiderRepositoryImpl(apiClient, voltiumApiClient);
    final supportRepository = SupportRepositoryImpl(voltiumApiClient);
    final rentalRepository = RentalRepositoryImpl(voltiumApiClient);

    riderProvider = RiderProvider(
      riderId: riderId,
      phone: phone,
      riderRepository: riderRepository,
      rentalRepository: rentalRepository,
      filesRepository: filesRepository,
    );
    walletProvider = WalletProvider(
      walletRepository: walletRepository,
      filesRepository: filesRepository,
    );
    supportProvider = SupportProvider(repository: supportRepository);
    engagementProvider = EngagementProvider();
    devicePolicyProvider = DevicePolicyProvider();
    connectivityProvider = ConnectivityProvider();

    riderProvider.addListener(notifyListeners);
    walletProvider.addListener(notifyListeners);
    supportProvider.addListener(notifyListeners);
    engagementProvider.addListener(notifyListeners);
    devicePolicyProvider.addListener(notifyListeners);
    connectivityProvider.addListener(notifyListeners);
  }

  late final RiderProvider riderProvider;
  late final WalletProvider walletProvider;
  late final SupportProvider supportProvider;
  late final EngagementProvider engagementProvider;
  late final DevicePolicyProvider devicePolicyProvider;
  late final ConnectivityProvider connectivityProvider;

  // ── Backward-compatible delegating getters ────────────────────────────────

  RiderModel? get rider => riderProvider.rider;
  String? get riderId => riderProvider.riderId;
  DataState get dataState => riderProvider.dataState;
  String? get errorMessage => riderProvider.errorMessage;
  bool get isRefreshing => riderProvider.isRefreshing;
  bool get hasFetchedOnce => riderProvider.hasFetchedOnce;
  bool get isPlanActive => riderProvider.isPlanActive;
  bool get isKycDone => riderProvider.isKycDone;
  bool get isActuallyActive => riderProvider.isActuallyActive;

  List<TransactionModel> get transactions => walletProvider.transactions;
  bool get isRefreshingTransactions => walletProvider.isRefreshingTransactions;
  bool get isToppingUp => walletProvider.isToppingUp;
  double get walletMinTopup => walletProvider.walletMinTopup;
  bool get walletBalanceLow => walletProvider.walletBalanceLow;
  double get currentBalance => walletProvider.currentBalance;

  SupportConfig? get supportConfig => supportProvider.supportConfig;
  List<FaqCategory> get faqCategories => supportProvider.faqCategories;
  List<FaqItem> get faqs => supportProvider.faqs;
  List<IssueModel> get tickets => supportProvider.tickets;
  bool get isRefreshingTickets => supportProvider.isRefreshingTickets;

  int get rewardPoints => engagementProvider.rewardPoints;
  int get paymentStreak => engagementProvider.paymentStreak;
  List<RewardItem> get rewards => engagementProvider.rewards;
  Map<String, dynamic>? get referralData => engagementProvider.referralData;
  List<AppNotification> get notifications => engagementProvider.notifications;

  bool get isAdminActive => devicePolicyProvider.isAdminActive;
  bool get canDrawOverlays => devicePolicyProvider.canDrawOverlays;
  bool get lockedByAdmin => devicePolicyProvider.lockedByAdmin;
  String? get lockPassword => devicePolicyProvider.lockPassword;
  bool get forceUpdate => devicePolicyProvider.forceUpdate;
  String? get mandatoryUpdateUrl => devicePolicyProvider.mandatoryUpdateUrl;
  bool get hasPermissionViolation =>
      devicePolicyProvider.hasPermissionViolation;
  String? get violationPermissionId =>
      devicePolicyProvider.violationPermissionId;

  bool get isOnline => connectivityProvider.isOnline;
  int get pendingSyncCount => connectivityProvider.pendingSyncCount;

  // ── Initialization ────────────────────────────────────────────────────────

  Future<void> init() async {
    PerformanceService().startTrace('AppProvider_Init');

    await riderProvider.init();
    supportProvider.initSupportData();
    engagementProvider.initEngagementData();
    await devicePolicyProvider.checkSystemPermissions();

    if (rider != null && !rider!.pickupDone) {
      riderProvider.startOnboardingPoll();
    }
    if (rider != null && Platform.isAndroid) {
      devicePolicyProvider.startSecurityFlagsPoll(
        riderId: riderProvider.riderId ?? rider!.id ?? '',
      );
      devicePolicyProvider.startIntegrityCheck();
    }

    await _refreshSupportingData();
    PerformanceService().stopTrace('AppProvider_Init');
  }

  Future<void> _refreshSupportingData() async {
    await engagementProvider.refreshRewards();
    await engagementProvider.refreshReferrals();
    await supportProvider.refreshFaqs();

    try {
      final settingsResponse = await ApiService().fetchSettings();
      if (settingsResponse['success'] == true) {
        final settings =
            settingsResponse['data']?['settings'] as Map<String, dynamic>?;
        if (settings != null) {
          final minTopup =
              (settings['walletMinTopup'] ?? settings['securityDeposit'] ?? 0.0)
                  .toDouble();
          walletProvider.setWalletSettings(minTopup);
        }
      }
    } catch (e) {
      debugPrint('AppProvider: Failed to fetch settings: $e');
    }
  }

  AuthState routeAfterLogin(RiderModel r) => riderProvider.routeAfterLogin(r);
  void setRiderId(String id, {String? phoneNumber}) =>
      riderProvider.setRiderId(id, phoneNumber: phoneNumber);
  void setRider(RiderModel r) => riderProvider.setRider(r);
  void updateRider(RiderModel updated) => riderProvider.updateRider(updated);
  void forceLogin() => riderProvider.forceLogin();

  Future<bool> submitVehicleReturn(
          {required List<File> photos, String? reason}) =>
      riderProvider.submitVehicleReturn(photos: photos, reason: reason);

  Future<void> refresh() => riderProvider.refresh();
  Future<void> refreshFromApi() async {
    await riderProvider.refreshFromApi();
    final rId = riderProvider.riderId ?? rider?.id;
    if (rId != null) {
      await walletProvider.refreshTransactions(riderId: rId);
    }
  }

  Future<void> logout() async {
    await riderProvider.logout();
    walletProvider.logout();
    supportProvider.logout();
    engagementProvider.logout();
    devicePolicyProvider.logout();
    connectivityProvider.logout();
  }

  void setWalletBalanceWarning(bool low, {double balance = 0.0}) =>
      walletProvider.setWalletBalanceWarning(low, balance: balance);

  Future<void> topUpWallet({
    required double amount,
    required String method,
    String? upiRef,
    File? image,
    String? screenshotUrl,
    String purpose = 'TOP_UP',
  }) =>
      walletProvider.topUpWallet(
        amount: amount,
        method: method,
        upiRef: upiRef,
        image: image,
        screenshotUrl: screenshotUrl,
        purpose: purpose,
        riderId: riderProvider.riderId ?? rider?.id ?? '',
      );

  Future<void> deleteTransactionHistory() =>
      walletProvider.deleteTransactionHistory(
          riderId: riderProvider.riderId ?? rider?.id ?? '');

  Future<void> refreshTransactions() => walletProvider.refreshTransactions(
      riderId: riderProvider.riderId ?? rider?.id ?? '');

  Future<void> createTicket({
    required String category,
    required String subject,
    required String message,
  }) =>
      supportProvider.createTicket(
        category: category,
        subject: subject,
        message: message,
        riderId: riderProvider.riderId ?? rider?.id,
      );

  Future<void> refreshTickets() => supportProvider.refreshTickets(
      riderId: riderProvider.riderId ?? rider?.id);

  Future<void> refreshEngagementData() async =>
      engagementProvider.initEngagementData();
  void markNotificationAsRead(String id) =>
      engagementProvider.markNotificationAsRead(id);
  void markAllNotificationsRead() =>
      engagementProvider.markAllNotificationsRead();

  Future<void> checkSystemPermissions() =>
      devicePolicyProvider.checkSystemPermissions();
  void setForceUpdate(bool force, {String? url}) =>
      devicePolicyProvider.setForceUpdate(force, url: url);
  void setLockedByAdmin(bool locked, {String? password}) =>
      devicePolicyProvider.setLockedByAdmin(locked, password: password);
  Future<void> requestDeviceAdmin() =>
      devicePolicyProvider.requestDeviceAdmin();
  Future<void> requestOverlayPermission() =>
      devicePolicyProvider.requestOverlayPermission();
  void startIntegrityCheck() =>
      devicePolicyProvider.startIntegrityCheck();
  void clearViolation() =>
      devicePolicyProvider.clearViolation();

  void setOnline(bool online) => connectivityProvider.setOnline(online);
  void setPendingSyncCount(int count) =>
      connectivityProvider.setPendingSyncCount(count);

  Future<void> registerFcmToken() => riderProvider.registerFcmToken();

  @override
  void dispose() {
    riderProvider.removeListener(notifyListeners);
    walletProvider.removeListener(notifyListeners);
    supportProvider.removeListener(notifyListeners);
    engagementProvider.removeListener(notifyListeners);
    devicePolicyProvider.removeListener(notifyListeners);
    connectivityProvider.removeListener(notifyListeners);

    riderProvider.dispose();
    walletProvider.dispose();
    supportProvider.dispose();
    engagementProvider.dispose();
    devicePolicyProvider.dispose();
    connectivityProvider.dispose();
    super.dispose();
  }
}
