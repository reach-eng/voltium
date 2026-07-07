import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';
import '../utils/app_constants.dart';
import '../utils/toast.dart';

import '../providers/app_provider.dart';
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
import '../features/wallet/presentation/screens/top_up_purpose_screen.dart';
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

import '../features/referrals/presentation/screens/referral_screen.dart';

import 'app_state.dart';

part 'router_body.dart';

class AppRouter extends StatefulWidget {
  const AppRouter({super.key});

  @override
  State<AppRouter> createState() => _AppRouterState();
}

class _AppRouterState extends State<AppRouter> with WidgetsBindingObserver {
  AuthState _currentState = AuthState.splash;

  bool _isTransitioning = false;
  bool _isSignUpFlow = true;
  String _phone = '';
  AuthState _startupState = AuthState.splash;
  bool _isOnboarding = false;
  AuthState? _postOtpTargetState;

  // Top-up flow state
  TopUpPurpose _topUpPurpose = TopUpPurpose.topUp;
  int _topUpAmount = 0;

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
        context.read<AppProvider>().init();
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
    final provider = context.read<AppProvider>();
    final riderProvider = provider.riderProvider;

    switch (state) {
      case AppLifecycleState.resumed:
        _checkPermissionsOnResume();
        riderProvider.setPollingActive();
        riderProvider.refreshFromApi();
        if (riderProvider.rider?.id != null) {
          provider.walletProvider.refreshTransactions(
            riderId: riderProvider.rider!.id!,
          );
        }
        break;
      case AppLifecycleState.inactive:
      case AppLifecycleState.hidden:
      case AppLifecycleState.paused:
        riderProvider.setPollingInactive();
        break;
      case AppLifecycleState.detached:
        break;
    }
  }

  Future<void> _checkPermissionsOnResume() async {
    if (!mounted) return;
    final provider = context.read<AppProvider>();
    await provider.checkSystemPermissions();
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
    final provider = context.watch<AppProvider>();

    final isUnauthenticatedState = _currentState == AuthState.splash ||
        _currentState == AuthState.legal ||
        _currentState == AuthState.permissions ||
        _currentState == AuthState.login ||
        _currentState == AuthState.otp;

    if (provider.rider != null && !isUnauthenticatedState) {
      final r = provider.rider!;

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
              _currentState == AuthState.topUpPurpose ||
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
              _isOnboarding = correctState != AuthState.dashboard;
            });
            CacheService()
                .setString('voltium_saved_auth_state', correctState.name);
          }
        });
      }
    }

    if (provider.rider == null &&
        provider.riderId == null &&
        !isUnauthenticatedState) {
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
    updateTransition(true);
    _currentState = nextState;
    if (nextState == AuthState.preDashboard) _isOnboarding = true;
    if (nextState == AuthState.dashboard) _isOnboarding = false;

    if (nextState != AuthState.splash) {
      CacheService().setString('voltium_saved_auth_state', nextState.name);
    }

    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) {
        updateTransition(false);
      }
    });
  }

  void updateTransition(bool value) {
    setState(() => _isTransitioning = value);
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
      case LifecycleTarget.terminated:
        return AuthState.preDashboard;
      case LifecycleTarget.unknown:
        return AuthState.login;
    }
  }

  @override
  Widget build(BuildContext context) {
    return _buildRouterBody(context, this);
  }

  Widget childScreenWrapper(Widget child) => child;
}
