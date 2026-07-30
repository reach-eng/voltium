import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/rider_model.dart' show AccountStatus;
import '../theme/app_theme.dart';
import '../theme/app_typography.dart';
import '../utils/app_constants.dart';
import '../utils/app_logger.dart';
import '../utils/toast.dart';

import '../core/state/riverpod_providers.dart';
import '../services/cache_service.dart';
import '../main.dart' show AppShell;

// Relocated screens
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/otp_verification_screen.dart';
import '../features/auth/presentation/rider_lifecycle_gate.dart';

import '../features/onboarding/presentation/screens/splash_screen.dart';
import '../features/onboarding/presentation/screens/legal_screen.dart';
import '../features/onboarding/presentation/screens/legal_page_screen.dart';

import '../features/onboarding/presentation/screens/permissions_screen.dart';

import '../features/kyc/presentation/screens/intent_of_use_screen.dart';
import '../features/kyc/presentation/screens/user_onboarding_screen.dart';
import '../features/kyc/presentation/screens/documents_screen.dart';
import '../features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';

import '../features/wallet/presentation/screens/top_up_amount_screen.dart';

import '../features/wallet/presentation/screens/top_up_receipt_screen.dart';
import '../features/wallet/presentation/screens/top_up_upi_screen.dart';
import '../features/wallet/presentation/screens/top_up_proof_screen.dart';

import '../features/rentals/presentation/screens/choose_plan_screen.dart';
import '../features/rentals/presentation/screens/plan_success_screen.dart';
import '../features/rentals/presentation/screens/end_rental_screen.dart';

import '../features/pickup/presentation/screens/pickup_hub_screen.dart';
import '../features/pickup/presentation/screens/pickup_verification_screen.dart';
import '../features/pickup/presentation/screens/pickup_success_screen.dart';
import '../features/pickup/presentation/screens/tl_details_screen.dart';
import '../features/pickup/presentation/screens/vehicle_photos_screen.dart';

import '../features/dashboard/presentation/screens/pre_dashboard_screen.dart';

import '../features/support/presentation/screens/faq_screen.dart';
import '../features/support/presentation/screens/feedback_screen.dart';
import '../utils/app_navigator.dart';

import '../features/referrals/presentation/screens/referral_screen.dart';

import 'app_state.dart';

part 'router_body.dart';

class AppRouter extends ConsumerStatefulWidget {
  const AppRouter({super.key});

  @override
  ConsumerState<AppRouter> createState() => _AppRouterState();
}

class _AppRouterState extends ConsumerState<AppRouter>
    with WidgetsBindingObserver {
  AuthState _currentState = AuthState.splash;

  bool _isSignUpFlow = true;
  String _phone = '';
  String? _referralCode;
  AuthState _startupState = AuthState.splash;
  bool _isOnboarding = false;
  AuthState? _postOtpTargetState;

  // Top-up flow state
  int _topUpAmount = 2000;

  // Pickup flow state
  String? _pickupHubId;
  String? _pickupVehicleId;
  String? _pickupTeamLeader;
  String? _pickupEmergencyContact;
  String? _pickupPhotoFront;
  String? _pickupPhotoBack;
  String? _pickupPhotoLeft;
  String? _pickupPhotoRight;
  String? _pickupPhotoWithVehicle;

  /// Required permissions gate. `ignoreBatteryOptimizations` is NOT
  /// included here because it requires a multi-tap detour into Android
  /// Settings and is only a recommendation. Users who skip it on the
  /// permissions screen can still use the app; the app just won't be
  /// excluded from battery optimization.
  ///
  /// `phone` is also optional — it is shown in the permissions UI for
  /// ride-safety transparency but the app degrades gracefully when the
  /// runner grants location/camera/notifications only.
  Future<bool> _areAllRequiredPermissionsGranted() async {
    final isTestMode = AppConstants.isTestMode;
    if (isTestMode || kIsWeb) return true;

    final location = await Permission.location.isGranted;
    final camera = await Permission.camera.isGranted;
    final notifications = await Permission.notification.isGranted;

    return location && camera && notifications;
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    final cachedRider = CacheService().getCachedRider();
    _isSignUpFlow = cachedRider == null || cachedRider['id'] == null;
    _startupState = AuthState.splash;
    _currentState = _startupState;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(riderProvider).init();
        ref.read(supportProvider).initSupportData();
        ref.read(engagementProvider).initEngagementData();
        ref.read(devicePolicyProvider).checkSystemPermissions();
      }
    });
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (!mounted) return;
    final rProvider = ref.read(riderProvider);
    final wProvider = ref.read(walletProvider);

    switch (state) {
      case AppLifecycleState.resumed:
        _checkPermissionsOnResume();
        // R11 — polling lifecycle (active/inactive cadence + location-sync
        // timer) is now owned by `RiderProvider` itself. The router only
        // triggers a manual refresh + wallet refresh + permission re-check
        // on resume.
        rProvider.refreshFromApi();
        if (rProvider.riderId != null) {
          wProvider.refreshTransactions(
            riderId: rProvider.riderId!,
          );
        }
        break;
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
      case AppLifecycleState.detached:
        // No-op: RiderProvider handles its own polling pause + timer cancel.
        break;
    }
  }

  Future<void> _checkPermissionsOnResume() async {
    if (!mounted) return;
    await ref.read(devicePolicyProvider).checkSystemPermissions();
    if (!mounted) return;
    final allRequiredGranted = await _areAllRequiredPermissionsGranted();
    if (!allRequiredGranted &&
        _currentState != AuthState.splash &&
        _currentState != AuthState.permissions &&
        _currentState != AuthState.legal &&
        _currentState != AuthState.otp) {
      _navigateToLocal(AuthState.permissions);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final riderProv = ref.watch(riderProvider);
    final rider = riderProv.rider;

    final isUnauthenticatedState = _currentState == AuthState.splash ||
        _currentState == AuthState.legal ||
        _currentState == AuthState.permissions ||
        _currentState == AuthState.login ||
        _currentState == AuthState.otp;

    if (rider != null && !isUnauthenticatedState) {
      final r = rider;

      // Delegate lifecycle routing to RiderLifecycleGate
      final correctState =
          _lifecycleTargetToAuthState(RiderLifecycleGate.redirect(r));

      // Check if current state matches correctState, except when inside sub-flow screens of that phase
      bool stateMatches = _currentState == correctState;
      if (!stateMatches) {
        // Allow sub-screens of pre-dashboard / pickup / plan
        if (correctState == AuthState.preDashboard) {
          stateMatches = _currentState == AuthState.preDashboard ||
              _currentState == AuthState.choosePlan ||
              _currentState == AuthState.planSuccess ||
              _currentState == AuthState.pickupHub ||
              _currentState == AuthState.pickupVerification ||
              _currentState == AuthState.pickupSuccess ||
              _currentState == AuthState.topUpAmount ||
              _currentState == AuthState.topUpUpi ||
              _currentState == AuthState.topUpProof ||
              _currentState == AuthState.topUpReceipt;
        }
      }

      if (!stateMatches) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            setState(() {
              _currentState = correctState;
              // accountClosed is terminal — never treat as onboarding
              _isOnboarding = correctState != AuthState.dashboard &&
                  correctState != AuthState.accountClosed;
            });
            CacheService()
                .setString('voltium_saved_auth_state', correctState.name);
          }
        });
      }
    }

    if (rider == null && riderProv.riderId == null && !isUnauthenticatedState) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          setState(() {
            _currentState = AuthState.login;
          });
          CacheService()
              .setString('voltium_saved_auth_state', AuthState.login.name);
        }
      });
    }
  }

  void _navigateToLocal(AuthState nextState) {
    setState(() {
      _currentState = nextState;
      if (nextState == AuthState.preDashboard) _isOnboarding = true;
      if (nextState == AuthState.dashboard) _isOnboarding = false;
      if (nextState == AuthState.accountClosed) _isOnboarding = false;
    });

    if (nextState != AuthState.splash) {
      CacheService().setString('voltium_saved_auth_state', nextState.name);
    }
  }

  void updatePostOtpTarget(AuthState? target) {
    setState(() => _postOtpTargetState = target);
  }

  void updatePickupData({
    required String? hubId,
    required String? vehicleId,
    required String? teamLeader,
    required String? emergencyContact,
    required String? photoFront,
    required String? photoBack,
    required String? photoLeft,
    required String? photoRight,
    required String? photoWithVehicle,
  }) {
    setState(() {
      _pickupHubId = hubId;
      _pickupVehicleId = vehicleId;
      _pickupTeamLeader = teamLeader;
      _pickupEmergencyContact = emergencyContact;
      _pickupPhotoFront = photoFront;
      _pickupPhotoBack = photoBack;
      _pickupPhotoLeft = photoLeft;
      _pickupPhotoRight = photoRight;
      _pickupPhotoWithVehicle = photoWithVehicle;
    });
  }

  AuthState _lifecycleTargetToAuthState(LifecycleTarget target) {
    switch (target) {
      case LifecycleTarget.intent:
        return AuthState.intent;
      case LifecycleTarget.guarantorForm:
        return AuthState.guarantorForm;
      case LifecycleTarget.preDashboard:
        return AuthState.preDashboard;
      case LifecycleTarget.dashboard:
        return AuthState.dashboard;
      case LifecycleTarget.suspended:
        // Suspended riders may be reactivated — keep them on pre-dashboard
        // so they see the (already-correct) "your account is suspended"
        // banner handled by PreDashboardScreen.
        return AuthState.preDashboard;
      case LifecycleTarget.terminated:
        // Terminated accounts are terminal: do NOT route to pre-dashboard
        // (which would show onboarding CTAs). Show the dedicated
        // account-closed surface instead.
        return AuthState.accountClosed;
      case LifecycleTarget.unknown:
        return AuthState.login;
    }
  }

  bool get _canPop {
    switch (_currentState) {
      case AuthState.otp:
      case AuthState.userForm:
      case AuthState.guarantorForm:
      case AuthState.choosePlan:
      case AuthState.pickupHub:
      case AuthState.pickupVerification:
      case AuthState.topUpAmount:
      case AuthState.topUpUpi:
      case AuthState.topUpProof:
      case AuthState.topUpReceipt:
      case AuthState.endRental:
      case AuthState.accountClosed:
        // Account-closed is terminal: do not allow back navigation to
        // a pre-onboarding screen, which would let the rider re-enter
        // onboarding with a closed account.
        return false;
      default:
        return true;
    }
  }

  void _handleSystemBack() {
    switch (_currentState) {
      case AuthState.otp:
        _navigateToLocal(AuthState.login);
        break;
      case AuthState.intent:
        // Do nothing, let PopScope handle it or just break
        break;
      case AuthState.userForm:
        _navigateToLocal(AuthState.intent);
        break;
      case AuthState.guarantorForm:
        _navigateToLocal(AuthState.userForm);
        break;
      case AuthState.choosePlan:
        _navigateToLocal(AuthState.preDashboard);
        break;
      case AuthState.pickupHub:
        _navigateToLocal(AuthState.preDashboard);
        break;
      case AuthState.pickupVerification:
        _navigateToLocal(AuthState.pickupHub);
        break;
      case AuthState.topUpAmount:
        _navigateToLocal(
            _isOnboarding ? AuthState.preDashboard : AuthState.dashboard);
        break;
      case AuthState.topUpUpi:
        _navigateToLocal(AuthState.topUpAmount);
        break;
      case AuthState.topUpProof:
        _navigateToLocal(AuthState.topUpUpi);
        break;

      case AuthState.topUpReceipt:
        _navigateToLocal(
            _isOnboarding ? AuthState.preDashboard : AuthState.dashboard);
        break;
      case AuthState.endRental:
        _navigateToLocal(AuthState.dashboard);
        break;
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    return _buildRouterBody(context, this);
  }

  Widget childScreenWrapper(Widget child) => child;
}
