import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:permission_handler/permission_handler.dart';

import '../providers/app_provider.dart';
import '../services/cache_service.dart';
import '../main.dart' show AppShell;

// Relocated screens
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/otp_verification_screen.dart';
import '../features/auth/presentation/screens/auth_choice_screen.dart';
import '../features/auth/presentation/rider_lifecycle_gate.dart';

import '../features/onboarding/presentation/screens/splash_screen.dart';
import '../features/onboarding/presentation/screens/legal_screen.dart';
import '../features/onboarding/presentation/screens/legal_page_screen.dart';
import '../features/onboarding/presentation/screens/permissions_screen.dart';

import '../features/kyc/presentation/screens/intent_of_use_screen.dart';
import '../features/kyc/presentation/screens/user_onboarding_screen.dart';
import '../features/kyc/presentation/screens/documents_screen.dart';

import '../features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';

import '../features/wallet/presentation/screens/wallet_screen.dart';
import '../features/wallet/presentation/screens/top_up_amount_screen.dart';
import '../features/wallet/presentation/screens/top_up_purpose_screen.dart';
import '../features/wallet/presentation/screens/top_up_receipt_screen.dart';
import '../features/wallet/presentation/screens/top_up_upi_screen.dart';
import '../features/wallet/presentation/screens/top_up_proof_screen.dart';
import '../features/wallet/presentation/screens/top_up_flow.dart';
import '../features/wallet/presentation/screens/history_screen.dart';

import '../features/rentals/presentation/screens/choose_plan_screen.dart';
import '../features/rentals/presentation/screens/plan_success_screen.dart';
import '../features/rentals/presentation/screens/end_rental_screen.dart';
import '../features/rentals/presentation/screens/rental_details_screen.dart';

import '../features/pickup/presentation/screens/pickup_hub_screen.dart';
import '../features/pickup/presentation/screens/pickup_verification_screen.dart';
import '../features/pickup/presentation/screens/pickup_success_screen.dart';
import '../features/pickup/presentation/screens/tl_details_screen.dart';
import '../features/pickup/presentation/screens/vehicle_photos_screen.dart';

import '../features/dashboard/presentation/screens/active_dashboard_screen.dart';
import '../features/dashboard/presentation/screens/pre_dashboard_screen.dart';

import '../features/support/presentation/screens/support_center_screen.dart';
import '../features/support/presentation/screens/support_checklist_screen.dart';
import '../features/support/presentation/screens/faq_screen.dart';
import '../features/support/presentation/screens/troubleshooter_screen.dart';
import '../features/support/presentation/screens/feedback_screen.dart';

import '../features/notifications/presentation/screens/notification_center_screen.dart';
import '../features/notifications/presentation/screens/notification_preferences_screen.dart';
import '../features/notifications/presentation/screens/smart_notifications_screen.dart';

import '../features/profile/presentation/screens/profile_screen.dart';
import '../features/profile/presentation/screens/edit_profile_screen.dart';
import '../features/profile/presentation/screens/app_settings_screen.dart';
import '../features/profile/presentation/screens/earnings_screen.dart';

import '../features/referrals/presentation/screens/referral_screen.dart';
import '../features/rewards/presentation/screens/rewards_screen.dart';

import '../features/device_compliance/presentation/screens/emergency_contacts_screen.dart';
import '../features/device_compliance/presentation/screens/emergency_sos_screen.dart';

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

  Future<bool> _areAllPermissionsGranted() async {
    final isTestMode = const String.fromEnvironment('TEST_MODE') == 'true';
    if (isTestMode) return true;

    final location = await Permission.location.isGranted;
    final camera = await Permission.camera.isGranted;
    final microphone = await Permission.microphone.isGranted;
    final contacts = await Permission.contacts.isGranted;
    final phone = await Permission.phone.isGranted;
    final ignoreBattery = await Permission.ignoreBatteryOptimizations.isGranted;

    final appProvider = context.read<AppProvider>();
    final displayOverApps = appProvider.canDrawOverlays;
    final deviceAdmin = appProvider.isAdminActive;

    return location &&
        camera &&
        microphone &&
        contacts &&
        phone &&
        ignoreBattery &&
        displayOverApps &&
        deviceAdmin;
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
    if (state == AppLifecycleState.resumed) {
      _checkPermissionsOnResume();
    }
  }

  Future<void> _checkPermissionsOnResume() async {
    if (!mounted) return;
    final provider = context.read<AppProvider>();
    await provider.checkSystemPermissions();
    final allGranted = await _areAllPermissionsGranted();
    if (!allGranted &&
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
        _currentState == AuthState.otp ||
        _currentState == AuthState.authChoice;

    if (provider.rider != null && !isUnauthenticatedState) {
      final r = provider.rider!;
      
      // Delegate lifecycle routing to RiderLifecycleGate
      final correctState = _lifecycleTargetToAuthState(RiderLifecycleGate.redirect(r));

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
            CacheService().setString('voltium_saved_auth_state', correctState.name);
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
          CacheService().setString('voltium_saved_auth_state', AuthState.login.name);
        }
      });
    }
  }

  void _navigateToLocal(AuthState nextState) {
    setState(() {
      _isTransitioning = true;
      _currentState = nextState;
      if (nextState == AuthState.preDashboard) _isOnboarding = true;
      if (nextState == AuthState.dashboard) _isOnboarding = false;
    });

    if (nextState != AuthState.splash) {
      CacheService().setString('voltium_saved_auth_state', nextState.name);
    }

    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) {
        setState(() {
          _isTransitioning = false;
        });
      }
    });
  }

  AuthState _lifecycleTargetToAuthState(LifecycleTarget target) {
    switch (target) {
      case LifecycleTarget.intent:
        return AuthState.intent;
      case LifecycleTarget.kycForm:
        return AuthState.userForm;
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
