import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../services/cache_service.dart';

// Import all sequence screens
import 'splash_screen.dart';
import 'legal_screen.dart';
import 'permissions_screen.dart';
import 'login_screen.dart';
import 'otp_verification_screen.dart';
import 'intent_of_use_screen.dart';
import 'user_onboarding_screen.dart';
import 'pre_dashboard_screen.dart';
import 'choose_plan_screen.dart';
import 'plan_success_screen.dart';
import 'pickup_hub_screen.dart';
import 'pickup_vehicle_screen.dart';
import 'pickup_inspection_screen.dart';
import 'pickup_verification_screen.dart';
import 'pickup_success_screen.dart';
import 'auth_choice_screen.dart';
import 'guarantor_onboarding_screen.dart';
import '../main.dart';
import '../providers/app_provider.dart';

enum AuthState {
  splash,
  legal,
  permissions,
  login,
  otp,
  intent,
  userForm,
  guarantorForm,
  authChoice,
  dashboard,
  preDashboard,
  choosePlan,
  planSuccess,
  pickupHub,
  pickupVehicle,
  pickupInspection,
  pickupVerification,
  pickupSuccess,
  tlDetails,
  endRental,
  faq,
  vehiclePhotos,
  topUpPurpose,
  topUpUpi,
  topUpReceipt,
  referralDetails,
  legalPage,
  myDocuments
}

class AuthWrapper extends StatefulWidget {
  const AuthWrapper({super.key});

  @override
  State<AuthWrapper> createState() => _AuthWrapperState();
}

class _AuthWrapperState extends State<AuthWrapper> {
  // Using an enum to track which screen to show
  AuthState _currentState = AuthState.splash;

  // Determined from cached rider data
  bool _isSignUpFlow = true;

  // Fake Permission Check Flag
  bool _hasGrantedPermissions = false;
  String _phone = '';
  // Current startup screen state (will be set in initState)
  AuthState _startupState = AuthState.splash;

  @override
  void initState() {
    super.initState();
    // Check if user has cached rider data to determine flow
    final cachedRider = CacheService().getCachedRider();
    _isSignUpFlow = cachedRider == null || cachedRider['riderId'] == null;
    // Decide starting screen: auth choice if signup, else splash
    _startupState = _isSignUpFlow ? AuthState.authChoice : AuthState.splash;
    _currentState = _startupState;
  }

  void _navigateToLocal(AuthState nextState) {
    setState(() {
      _currentState = nextState;
      // Let standard transition animation happen nicely via AnimatedSwitcher
    });
  }

  void _finishOnboarding() {
    // Save state to provider/shared preferences indicating logged in
    _navigateToLocal(AuthState.dashboard);
  }

  @override
  Widget build(BuildContext context) {
    Widget currentScreen;

    // Switch block builds the precise widget dynamically preserving context and styles
    switch (_currentState) {
      case AuthState.authChoice:
        currentScreen = AuthChoiceScreen(
          key: const ValueKey('authChoice'),
          onCreateAccount: () {
            _navigateToLocal(AuthState.legal);
          },
          onLoginWithPhone: () {
            _navigateToLocal(AuthState.login);
          },
        );
        break;

      case AuthState.splash:
        currentScreen = SplashScreen(
          key: const ValueKey('splash'),
          onComplete: () {
            // Once splash finishes, determine where to branch based on mode
            if (_isSignUpFlow) {
              _navigateToLocal(AuthState.legal);
            } else {
              _navigateToLocal(_hasGrantedPermissions
                  ? AuthState.login
                  : AuthState.permissions);
            }
          },
        );
        break;

      case AuthState.legal:
        currentScreen = LegalScreen(
          key: const ValueKey('legal'),
          onNext: () {
            _navigateToLocal(AuthState.permissions);
          },
        );
        break;

      case AuthState.permissions:
        currentScreen = PermissionsScreen(
          key: const ValueKey('permissions'),
          onNext: () {
            // Set flag so next time login skips permissions
            _hasGrantedPermissions = true;
            _navigateToLocal(AuthState.login);
          },
        );
        break;

      case AuthState.login:
        currentScreen = LoginScreen(
          key: const ValueKey('login'),
          isSignUp: _isSignUpFlow,
          onNext: (phone) {
            _phone = phone;
            _navigateToLocal(AuthState.otp);
          },
        );
        break;

      case AuthState.otp:
        currentScreen = OtpVerificationScreen(
          key: const ValueKey('otp'),
          phoneNumber: _phone,
          onNext: () {
            final provider = context.read<AppProvider>();
            final rider = provider.rider;

            if (rider == null) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content:
                        Text('Rider not found. Please contact support.')),
              );
              return;
            }

            // Smart routing based on rider status (mirrors web parity)
            final nextState = provider.routeAfterLogin(rider);
            _navigateToLocal(nextState);
          },
        );
        break;

      case AuthState.intent:
        currentScreen = IntentOfUseScreen(
          key: const ValueKey('intent'),
          onNext: () {
            _navigateToLocal(AuthState.userForm);
          },
        );
        break;

      case AuthState.userForm:
        currentScreen = UserOnboardingScreen(
          key: const ValueKey('userForm'),
          onNext: () {
            _navigateToLocal(AuthState.guarantorForm);
          },
        );
        break;

      case AuthState.guarantorForm:
        currentScreen = GuarantorOnboardingScreen(
          key: const ValueKey('guarantorForm'),
          onNext: () {
            _finishOnboarding();
          },
        );
        break;

      case AuthState.preDashboard:
        currentScreen = PreDashboardScreen(
          key: const ValueKey('preDashboard'),
          onStepNavigation: (state) => _navigateToLocal(state),
        );
        break;

      case AuthState.choosePlan:
        currentScreen = ChoosePlanScreen(
          key: const ValueKey('choosePlan'),
          onNext: () => _navigateToLocal(AuthState.planSuccess),
        );
        break;

      case AuthState.planSuccess:
        currentScreen = PlanSuccessScreen(
          key: const ValueKey('planSuccess'),
          onNext: () => _navigateToLocal(AuthState.preDashboard),
        );
        break;

      case AuthState.pickupHub:
        currentScreen = PickupHubScreen(
          key: const ValueKey('pickupHub'),
          onNext: () => _navigateToLocal(AuthState.pickupVehicle),
        );
        break;

      case AuthState.pickupVehicle:
        currentScreen = PickupVehicleScreen(
          key: const ValueKey('pickupVehicle'),
          onNext: () => _navigateToLocal(AuthState.pickupInspection),
        );
        break;

      case AuthState.pickupInspection:
        currentScreen = PickupInspectionScreen(
          key: const ValueKey('pickupInspection'),
          onNext: () => _navigateToLocal(AuthState.pickupVerification),
        );
        break;

      case AuthState.pickupVerification:
        currentScreen = PickupVerificationScreen(
          key: const ValueKey('pickupVerification'),
          onNext: () => _navigateToLocal(AuthState.pickupSuccess),
        );
        break;

      case AuthState.pickupSuccess:
        currentScreen = PickupSuccessScreen(
          key: const ValueKey('pickupSuccess'),
          onFinish: () => _finishOnboarding(),
        );
        break;

      case AuthState.dashboard:
        // Render the full AppShell including bottom navigation
        currentScreen = const AppShell(key: ValueKey('dashboard'));
        break;

      // Handle extra states by showing dashboard for now (will be direct linked later)
      case AuthState.tlDetails:
      case AuthState.endRental:
      case AuthState.faq:
      case AuthState.vehiclePhotos:
      case AuthState.topUpPurpose:
      case AuthState.topUpUpi:
      case AuthState.topUpReceipt:
      case AuthState.referralDetails:
      case AuthState.legalPage:
      case AuthState.myDocuments:
        currentScreen = const AppShell(key: ValueKey('dashboard_fallback'));
        break;
    }

    return Scaffold(
      body: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        switchInCurve: Curves.easeIn,
        switchOutCurve: Curves.easeOut,
        transitionBuilder: (Widget child, Animation<double> animation) {
          return FadeTransition(
            opacity: animation,
            child: child,
          );
        },
        child: currentScreen,
      ),
      // Floating debug toggler (development only)
      floatingActionButton: kDebugMode &&
              _currentState != AuthState.splash &&
              _currentState != AuthState.dashboard
          ? FloatingActionButton.extended(
              onPressed: () {
                setState(() {
                  _isSignUpFlow = !_isSignUpFlow;
                  _navigateToLocal(AuthState.splash);
                });
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                      content: Text(
                          'Switched to \${_isSignUpFlow ? "Sign Up" : "Login"} Mode')),
                );
              },
              icon: const Icon(Icons.swap_horiz),
              label: Text(_isSignUpFlow ? 'Force Login' : 'Force Sign Up'),
              backgroundColor: Colors.black87,
              foregroundColor: Colors.white,
            )
          : null,
    );
  }
}
