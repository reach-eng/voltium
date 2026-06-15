part of 'router.dart';

Widget _buildRouterBody(BuildContext context, _AppRouterState state) {
  debugPrint('AppRouter: Building with state: ${state._currentState}');
  Widget currentScreen;

  switch (state._currentState) {
    case AuthState.authChoice:
      currentScreen = AuthChoiceScreen(
        key: const ValueKey('authChoice'),
        onCreateAccount: () {
          state._navigateToLocal(AuthState.legal);
        },
        onLoginWithPhone: () {
          state._navigateToLocal(AuthState.permissions);
        },
      );
      break;

    case AuthState.splash:
      currentScreen = SplashScreen(
        key: const ValueKey('splash'),
        onComplete: () async {
          final allGranted = await state._areAllPermissionsGranted();
          if (!allGranted) {
            state._navigateToLocal(AuthState.permissions);
            return;
          }
          final cachedRider = CacheService().getCachedRider();
          if (cachedRider != null && cachedRider['id'] != null) {
            final savedStateStr = CacheService().getString('voltium_saved_auth_state');
            AuthState? restoredState;
            if (savedStateStr != null) {
              try {
                restoredState = AuthState.values.firstWhere(
                  (e) => e.name == savedStateStr,
                );
              } catch (_) {}
            }

            if (restoredState != null &&
                restoredState != AuthState.splash &&
                restoredState != AuthState.login &&
                restoredState != AuthState.otp) {
              state._navigateToLocal(restoredState);
            } else {
              final isPickupDone = cachedRider['pickupDone'] == true ||
                  cachedRider['pickupDone'] == 'true';
              if (isPickupDone) {
                state._navigateToLocal(AuthState.dashboard);
              } else {
                state._navigateToLocal(AuthState.preDashboard);
              }
            }
          } else {
            state._navigateToLocal(AuthState.login);
          }
        },
      );
      break;

    case AuthState.legal:
      currentScreen = LegalScreen(
        key: const ValueKey('legal'),
        onNext: () {
          state._navigateToLocal(AuthState.permissions);
        },
      );
      break;

    case AuthState.permissions:
      currentScreen = PermissionsScreen(
        key: const ValueKey('permissions'),
        onNext: () {
          if (state._postOtpTargetState != null) {
            final target = state._postOtpTargetState!;
            state.setState(() {
              state._postOtpTargetState = null;
            });
            state._navigateToLocal(target);
          } else {
            final cachedRider = CacheService().getCachedRider();
            if (cachedRider != null && cachedRider['id'] != null) {
              final isPickupDone = cachedRider['pickupDone'] == true ||
                  cachedRider['pickupDone'] == 'true';
              if (isPickupDone) {
                state._navigateToLocal(AuthState.dashboard);
              } else {
                state._navigateToLocal(AuthState.preDashboard);
              }
            } else {
              state._navigateToLocal(AuthState.login);
            }
          }
        },
      );
      break;

    case AuthState.login:
      currentScreen = LoginScreen(
        key: const ValueKey('login'),
        isSignUp: state._isSignUpFlow,
        onNext: (phone) {
          state._phone = phone;
          state._navigateToLocal(AuthState.otp);
        },
      );
      break;

    case AuthState.otp:
      currentScreen = OtpVerificationScreen(
        key: const ValueKey('otp'),
        phoneNumber: state._phone,
        onBack: () => state._navigateToLocal(AuthState.login),
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

          final nextState = state._lifecycleTargetToAuthState(RiderLifecycleGate.redirect(rider));
          state.setState(() {
            state._postOtpTargetState = nextState;
          });
          state._navigateToLocal(AuthState.legal);
        },
      );
      break;

    case AuthState.intent:
      currentScreen = IntentOfUseScreen(
        key: const ValueKey('intent'),
        onBack: () => state._navigateToLocal(AuthState.preDashboard),
        onNext: () {
          state._navigateToLocal(AuthState.userForm);
        },
      );
      break;

    case AuthState.userForm:
      currentScreen = UserOnboardingScreen(
        key: const ValueKey('userForm'),
        onBack: () => state._navigateToLocal(AuthState.intent),
        onNext: () {
          state._navigateToLocal(AuthState.guarantorForm);
        },
      );
      break;

    case AuthState.guarantorForm:
      currentScreen = GuarantorOnboardingScreen(
        key: const ValueKey('guarantorForm'),
        onBack: () => state._navigateToLocal(AuthState.userForm),
        onNext: () {
          state._navigateToLocal(AuthState.preDashboard);
        },
      );
      break;

    case AuthState.preDashboard:
      currentScreen = PreDashboardScreen(
        key: const ValueKey('preDashboard'),
        onStepNavigation: (stateStr) {
          try {
            final targetState = AuthState.values.firstWhere((e) => e.name == stateStr);
            state._navigateToLocal(targetState);
          } catch (_) {}
        },
      );
      break;

    case AuthState.choosePlan:
      currentScreen = ChoosePlanScreen(
        key: const ValueKey('choosePlan'),
        onBack: () => state._navigateToLocal(AuthState.preDashboard),
        onNext: () => state._navigateToLocal(AuthState.preDashboard),
      );
      break;

    case AuthState.planSuccess:
      currentScreen = PlanSuccessScreen(
        key: const ValueKey('planSuccess'),
        onNext: () => state._navigateToLocal(AuthState.pickupHub),
      );
      break;

    case AuthState.pickupHub:
      currentScreen = PickupHubScreen(
        key: const ValueKey('pickupHub'),
        onBack: () => state._navigateToLocal(AuthState.preDashboard),
        onNext: (hubId, vehicleId, teamLeader, emergencyContact, photoFront,
            photoBack, photoLeft, photoRight, photoWithVehicle) {
          state.setState(() {
            state._pickupHubId = hubId;
            state._pickupVehicleId = vehicleId;
            state._pickupTeamLeader = teamLeader;
            state._pickupEmergencyContact = emergencyContact;
            state._pickupPhotoFront = photoFront;
            state._pickupPhotoBack = photoBack;
            state._pickupPhotoLeft = photoLeft;
            state._pickupPhotoRight = photoRight;
            state._pickupPhotoWithVehicle = photoWithVehicle;
          });
          state._navigateToLocal(AuthState.pickupVerification);
        },
      );
      break;

    case AuthState.pickupVerification:
      currentScreen = PickupVerificationScreen(
        key: const ValueKey('pickupVerification'),
        hubId: state._pickupHubId ?? '',
        vehicleId: state._pickupVehicleId ?? '',
        emergencyContact: state._pickupEmergencyContact ?? '',
        teamLeader: state._pickupTeamLeader,
        pickupPhotoFront: state._pickupPhotoFront,
        pickupPhotoBack: state._pickupPhotoBack,
        pickupPhotoLeft: state._pickupPhotoLeft,
        pickupPhotoRight: state._pickupPhotoRight,
        pickupPhotoWithVehicle: state._pickupPhotoWithVehicle,
        onBack: () => state._navigateToLocal(AuthState.pickupHub),
        onNext: () => state._navigateToLocal(AuthState.pickupSuccess),
      );
      break;

    case AuthState.pickupSuccess:
      currentScreen = PickupSuccessScreen(
        key: const ValueKey('pickupSuccess'),
        onFinish: () => state._navigateToLocal(AuthState.dashboard),
      );
      break;

    case AuthState.dashboard:
      currentScreen = const AppShell(key: ValueKey('dashboard'));
      break;

    case AuthState.tlDetails:
      currentScreen = const TlDetailsScreen(key: ValueKey('tlDetails'));
      break;

    case AuthState.endRental:
      currentScreen = EndRentalScreen(
        key: const ValueKey('endRental'),
        onBack: () => state._navigateToLocal(AuthState.dashboard),
        onSuccess: () => state._navigateToLocal(AuthState.dashboard),
      );
      break;

    case AuthState.faq:
      currentScreen = const FaqScreen(key: ValueKey('faq'));
      break;

    case AuthState.vehiclePhotos:
      currentScreen = const VehiclePhotosScreen(key: ValueKey('vehiclePhotos'));
      break;

    case AuthState.topUpPurpose:
      currentScreen = TopUpPurposeScreen(
        key: const ValueKey('topUpPurpose'),
        onBack: () => state._navigateToLocal(
            state._isOnboarding ? AuthState.preDashboard : AuthState.dashboard),
        onContinue: (purpose) {
          state._topUpPurpose = purpose;
          state._navigateToLocal(AuthState.topUpAmount);
        },
      );
      break;

    case AuthState.topUpAmount:
      currentScreen = TopUpAmountScreen(
        key: const ValueKey('topUpAmount'),
        onBack: () => state._navigateToLocal(AuthState.topUpPurpose),
        onProceed: (amount) {
          state._topUpAmount = amount;
          state._navigateToLocal(AuthState.topUpUpi);
        },
      );
      break;

    case AuthState.topUpUpi:
      currentScreen = TopUpUpiScreen(
        key: const ValueKey('topUpUpi'),
        amount: state._topUpAmount,
        purpose: state._topUpPurpose == TopUpPurpose.topUp ? 'TOP_UP' : 'SECURITY_DEPOSIT',
        onBack: () => state._navigateToLocal(AuthState.topUpAmount),
        onSubmit: () => state._navigateToLocal(AuthState.topUpReceipt),
        onEditAmount: () => state._navigateToLocal(AuthState.topUpAmount),
      );
      break;

    case AuthState.topUpReceipt:
      currentScreen = TopUpReceiptScreen(
        key: const ValueKey('topUpReceipt'),
        amount: state._topUpAmount,
        purpose: state._topUpPurpose == TopUpPurpose.topUp ? 'TOP_UP' : 'SECURITY_DEPOSIT',
        onBackToDashboard: () => state._navigateToLocal(
            state._isOnboarding ? AuthState.preDashboard : AuthState.dashboard),
      );
      break;

    case AuthState.referralDetails:
      currentScreen = const ReferralScreen(key: ValueKey('referralDetails'));
      break;

    case AuthState.legalPage:
      currentScreen = const LegalPageScreen(key: ValueKey('legalPage'));
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
              return FadeTransition(opacity: animation, child: child);
            },
            child: state.childScreenWrapper(currentScreen),
          ),
          if (state._isTransitioning)
            Container(
              color: Colors.black26,
              child: const Center(child: CircularProgressIndicator()),
            ),
        ],
      ),
    ),
    floatingActionButton: kDebugMode && (state._currentState == AuthState.login)
        ? FloatingActionButton.extended(
            onPressed: () {
              final provider = context.read<AppProvider>();
              provider.forceLogin();
              final nextState = state._lifecycleTargetToAuthState(RiderLifecycleGate.redirect(provider.rider!));
              state._navigateToLocal(nextState);
            },
            icon: const Icon(Icons.bolt),
            label: const Text('FORCE LOGIN (DEBUG)'),
            backgroundColor: Colors.redAccent,
            foregroundColor: Colors.white,
          )
        : null,
  );
}
