import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_provider.dart';
import '../services/cache_service.dart';
import '../main.dart';

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
import 'pickup_verification_screen.dart';
import 'pickup_success_screen.dart';
import 'auth_choice_screen.dart';
import 'guarantor_onboarding_screen.dart';
import 'tl_details_screen.dart';
import 'end_rental_screen.dart';
import 'faq_screen.dart';
import 'vehicle_photos_screen.dart';
import 'top_up_purpose_screen.dart';
import 'top_up_amount_screen.dart';
import 'top_up_receipt_screen.dart';
import 'top_up_upi_screen.dart';
import 'referral_screen.dart';
import 'documents_screen.dart';

import 'package:permission_handler/permission_handler.dart';

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
  pickupVerification,
  pickupSuccess,
  tlDetails,
  endRental,
  faq,
  vehiclePhotos,
  topUpPurpose,
  topUpAmount,
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

class _AuthWrapperState extends State<AuthWrapper> with WidgetsBindingObserver {
  // Using an enum to track which screen to show
  AuthState _currentState = AuthState.splash;
  bool _isTransitioning = false;

  // Determined from cached rider data
  bool _isSignUpFlow = true;

  // Fake Permission Check Flag
  String _phone = '';
  // Current startup screen state (will be set in initState)
  AuthState _startupState = AuthState.splash;

  // Tracks whether user is in onboarding flow (vs active dashboard)
  // Controls where to-upp and pickup back buttons route to
  bool _isOnboarding = false;

  // Dynamic routing target after OTP verification
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
    // Check if user has cached rider data to determine flow
    final cachedRider = CacheService().getCachedRider();
    _isSignUpFlow = cachedRider == null || cachedRider['id'] == null;
    // Always show splash screen first for branded intro
    _startupState = AuthState.splash;
    _currentState = _startupState;

    // Proactively initialize all providers on startup to sync API data
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
      if (provider.rider?.pickupDone == true &&
          _currentState != AuthState.dashboard) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            setState(() {
              _currentState = AuthState.dashboard;
              _isOnboarding = false;
            });
          }
        });
      } else if (provider.rider?.pickupDone != true &&
          _currentState != AuthState.preDashboard &&
          _currentState != AuthState.dashboard &&
          _currentState != AuthState.intent &&
          _currentState != AuthState.userForm &&
          _currentState != AuthState.guarantorForm &&
          _currentState != AuthState.choosePlan &&
          _currentState != AuthState.planSuccess &&
          _currentState != AuthState.pickupHub &&
          _currentState != AuthState.pickupVerification &&
          _currentState != AuthState.pickupSuccess &&
          _currentState != AuthState.topUpPurpose &&
          _currentState != AuthState.topUpAmount &&
          _currentState != AuthState.topUpUpi &&
          _currentState != AuthState.topUpReceipt) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            setState(() {
              _currentState = AuthState.preDashboard;
              _isOnboarding = true;
            });
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
    Future.delayed(const Duration(milliseconds: 400), () {
      if (mounted) {
        setState(() {
          _isTransitioning = false;
        });
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    debugPrint('AuthWrapper: Building with state: $_currentState');
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
            _navigateToLocal(AuthState.permissions);
          },
        );
        break;

      case AuthState.splash:
        currentScreen = SplashScreen(
          key: const ValueKey('splash'),
          onComplete: () async {
            final allGranted = await _areAllPermissionsGranted();
            if (!allGranted) {
              _navigateToLocal(AuthState.permissions);
              return;
            }
            final cachedRider = CacheService().getCachedRider();
            if (cachedRider != null && cachedRider['id'] != null) {
              final isPickupDone = cachedRider['pickupDone'] == true ||
                  cachedRider['pickupDone'] == 'true';
              if (isPickupDone) {
                _navigateToLocal(AuthState.dashboard);
              } else {
                _navigateToLocal(AuthState.preDashboard);
              }
            } else {
              _navigateToLocal(AuthState.login);
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
            if (_postOtpTargetState != null) {
              final target = _postOtpTargetState!;
              setState(() {
                _postOtpTargetState = null;
              });
              _navigateToLocal(target);
            } else {
              final cachedRider = CacheService().getCachedRider();
              if (cachedRider != null && cachedRider['id'] != null) {
                final isPickupDone = cachedRider['pickupDone'] == true ||
                    cachedRider['pickupDone'] == 'true';
                if (isPickupDone) {
                  _navigateToLocal(AuthState.dashboard);
                } else {
                  _navigateToLocal(AuthState.preDashboard);
                }
              } else {
                _navigateToLocal(AuthState.login);
              }
            }
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
          onBack: () => _navigateToLocal(AuthState.login),
          onNext: () {
            final provider = context.read<AppProvider>();
            final rider = provider.rider;

            if (rider == null) {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                    content: Text('Rider not found. Please contact support.')),
              );
              return;
            }

            // Smart routing based on rider status (mirrors web parity)
            final nextState = provider.routeAfterLogin(rider);
            setState(() {
              _postOtpTargetState = nextState;
            });
            _navigateToLocal(AuthState.legal);
          },
        );
        break;

      case AuthState.intent:
        currentScreen = IntentOfUseScreen(
          key: const ValueKey('intent'),
          onBack: () => _navigateToLocal(AuthState.preDashboard),
          onNext: () {
            _navigateToLocal(AuthState.userForm);
          },
        );
        break;

      case AuthState.userForm:
        currentScreen = UserOnboardingScreen(
          key: const ValueKey('userForm'),
          onBack: () => _navigateToLocal(AuthState.intent),
          onNext: () {
            _navigateToLocal(AuthState.guarantorForm);
          },
        );
        break;

      case AuthState.guarantorForm:
        currentScreen = GuarantorOnboardingScreen(
          key: const ValueKey('guarantorForm'),
          onBack: () => _navigateToLocal(AuthState.userForm),
          onNext: () {
            _navigateToLocal(AuthState.preDashboard);
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
          onBack: () => _navigateToLocal(AuthState.preDashboard),
          onNext: () => _navigateToLocal(AuthState.preDashboard),
        );
        break;

      case AuthState.planSuccess:
        currentScreen = PlanSuccessScreen(
          key: const ValueKey('planSuccess'),
          onNext: () => _navigateToLocal(AuthState.pickupHub),
        );
        break;

      case AuthState.pickupHub:
        currentScreen = PickupHubScreen(
          key: const ValueKey('pickupHub'),
          onBack: () => _navigateToLocal(AuthState.preDashboard),
          onNext: (hubId, vehicleId, teamLeader, emergencyContact, photoFront,
              photoBack, photoLeft, photoRight, photoWithVehicle) {
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
            _navigateToLocal(AuthState.pickupVerification);
          },
        );
        break;

      case AuthState.pickupVerification:
        currentScreen = PickupVerificationScreen(
          key: const ValueKey('pickupVerification'),
          hubId: _pickupHubId ?? '',
          vehicleId: _pickupVehicleId ?? '',
          emergencyContact: _pickupEmergencyContact ?? '',
          teamLeader: _pickupTeamLeader,
          pickupPhotoFront: _pickupPhotoFront,
          pickupPhotoBack: _pickupPhotoBack,
          pickupPhotoLeft: _pickupPhotoLeft,
          pickupPhotoRight: _pickupPhotoRight,
          pickupPhotoWithVehicle: _pickupPhotoWithVehicle,
          onBack: () => _navigateToLocal(AuthState.pickupHub),
          onNext: () => _navigateToLocal(AuthState.pickupSuccess),
        );
        break;

      case AuthState.pickupSuccess:
        currentScreen = PickupSuccessScreen(
          key: const ValueKey('pickupSuccess'),
          onFinish: () => _navigateToLocal(AuthState.dashboard),
        );
        break;

      case AuthState.dashboard:
        // Render the full AppShell including bottom navigation
        currentScreen = const AppShell(key: ValueKey('dashboard'));
        break;

      case AuthState.tlDetails:
        currentScreen = const TlDetailsScreen(key: ValueKey('tlDetails'));
        break;

      case AuthState.endRental:
        currentScreen = EndRentalScreen(
          key: const ValueKey('endRental'),
          onBack: () => _navigateToLocal(AuthState.dashboard),
          onSuccess: () => _navigateToLocal(AuthState.dashboard),
        );
        break;

      case AuthState.faq:
        currentScreen = const FaqScreen(key: ValueKey('faq'));
        break;

      case AuthState.vehiclePhotos:
        currentScreen =
            const VehiclePhotosScreen(key: ValueKey('vehiclePhotos'));
        break;

      case AuthState.topUpPurpose:
        currentScreen = TopUpPurposeScreen(
          key: const ValueKey('topUpPurpose'),
          onBack: () => _navigateToLocal(
              _isOnboarding ? AuthState.preDashboard : AuthState.dashboard),
          onContinue: (purpose) {
            _topUpPurpose = purpose;
            _navigateToLocal(AuthState.topUpAmount);
          },
        );
        break;

      case AuthState.topUpAmount:
        currentScreen = TopUpAmountScreen(
          key: const ValueKey('topUpAmount'),
          onBack: () => _navigateToLocal(AuthState.topUpPurpose),
          onProceed: (amount) {
            _topUpAmount = amount;
            _navigateToLocal(AuthState.topUpUpi);
          },
        );
        break;

      case AuthState.topUpUpi:
        currentScreen = TopUpUpiScreen(
          key: const ValueKey('topUpUpi'),
          amount: _topUpAmount,
          purpose: _topUpPurpose == TopUpPurpose.topUp
              ? 'TOP_UP'
              : 'SECURITY_DEPOSIT',
          onBack: () => _navigateToLocal(AuthState.topUpAmount),
          onSubmit: () => _navigateToLocal(AuthState.topUpReceipt),
          onEditAmount: () => _navigateToLocal(AuthState.topUpAmount),
        );
        break;

      case AuthState.topUpReceipt:
        currentScreen = TopUpReceiptScreen(
          key: const ValueKey('topUpReceipt'),
          amount: _topUpAmount,
          purpose: _topUpPurpose == TopUpPurpose.topUp
              ? 'TOP_UP'
              : 'SECURITY_DEPOSIT',
          onBackToDashboard: () => _navigateToLocal(
              _isOnboarding ? AuthState.preDashboard : AuthState.dashboard),
        );
        break;

      case AuthState.referralDetails:
        currentScreen = const ReferralScreen(key: ValueKey('referralDetails'));
        break;

      case AuthState.legalPage:
        currentScreen = LegalScreen(
          key: const ValueKey('legalPage'),
          onNext: () => _navigateToLocal(AuthState.dashboard),
        );
        break;

      case AuthState.myDocuments:
        currentScreen = const MyDocumentsScreen(key: ValueKey('myDocuments'));
        break;
    }

    return Scaffold(
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: () {
          FocusManager.instance.primaryFocus?.unfocus();
        },
        child: Stack(
          children: [
            AnimatedSwitcher(
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
            if (_isTransitioning)
              Container(
                color: Colors.black26,
                child: const Center(
                  child: CircularProgressIndicator(),
                ),
              ),
          ],
        ),
      ),
      // Floating debug toggler (development only)
      floatingActionButton: kDebugMode && (_currentState == AuthState.login)
          ? FloatingActionButton.extended(
              onPressed: () {
                final provider = context.read<AppProvider>();
                provider.forceLogin();
                final nextState = provider.routeAfterLogin(provider.rider!);
                _navigateToLocal(nextState);
              },
              icon: const Icon(Icons.bolt),
              label: const Text('FORCE LOGIN (DEBUG)'),
              backgroundColor: Colors.redAccent,
              foregroundColor: Colors.white,
            )
          : null,
    );
  }
}
