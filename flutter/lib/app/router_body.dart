part of 'router.dart';

Widget _buildRouterBody(BuildContext context, _AppRouterState state) {
  debugPrint('AppRouter: Building with state: ${state._currentState}');
  Widget currentScreen;

  switch (state._currentState) {
    case AuthState.splash:
      currentScreen = SplashScreen(
        key: const ValueKey('splash'),
        onComplete: () async {
          // Capture provider reference BEFORE any await so we don't
          // touch BuildContext across an async gap (lint guard).
          final provider = ProviderScope.containerOf(context).read(appProvider);
          final cachedRider = CacheService().getCachedRider();
          final allRequiredGranted =
              await state._areAllRequiredPermissionsGranted();

          if (cachedRider != null && cachedRider['id'] != null) {
            if (!allRequiredGranted) {
              state._navigateToLocal(AuthState.permissions);
              return;
            }
            // F-001: Validate cached auth state against current rider data
            // before restoring. The rider object held by AppProvider is
            // the source of truth and reflects any backend-side changes
            // since the last cached snapshot (e.g., pickup flipped to
            // false, lifecycle status terminated, etc.).
            final liveRider = provider.rider;
            final cachedPickupDone = cachedRider['pickupDone'] == true ||
                cachedRider['pickupDone'] == 'true';
            final livePickupDone = liveRider?.pickupDone == true;

            // If the cached rider says dashboard but the live rider has
            // terminal/non-onboarded lifecycle, drop the cached target —
            // let the lifecycle gate reroute from a known safe screen.
            const cachedStateStrEnumProblemLifecycles = {
              'SUSPENDED',
              'TERMINATED',
            };
            final isStaleLifecycle = liveRider != null &&
                cachedStateStrEnumProblemLifecycles
                    .contains(liveRider.lifecycleStatus.toUpperCase());

            // If intake data has materially drifted, drop any saved state.
            final cacheIsStale = (cachedPickupDone != livePickupDone) ||
                liveRider == null ||
                isStaleLifecycle;

            final savedStateStr =
                CacheService().getString('voltium_saved_auth_state');
            AuthState? restoredState;
            if (savedStateStr != null && !cacheIsStale) {
              try {
                restoredState = AuthState.values.firstWhere(
                  (e) => e.name == savedStateStr,
                );
              } catch (e) {
                debugPrint('AppRouter: failed to restore saved auth state: $e');
              }
            } else if (cacheIsStale) {
              debugPrint(
                  'AppRouter: discarding stale cached state — pickupDone: '
                  'cached=$cachedPickupDone live=$livePickupDone, '
                  'lifecycle=${liveRider?.lifecycleStatus ?? 'null'}');
            }

            if (restoredState != null &&
                restoredState != AuthState.splash &&
                restoredState != AuthState.login &&
                restoredState != AuthState.otp) {
              state._navigateToLocal(restoredState);
            } else {
              if (isPickupDone(liveRider, cachedRider)) {
                state._navigateToLocal(AuthState.dashboard);
              } else {
                state._navigateToLocal(AuthState.preDashboard);
              }
            }
          } else {
            state._navigateToLocal(AuthState.legal);
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
            state.updatePostOtpTarget(null);
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
        onNext: (bool isNewRider) {
          final provider = ProviderScope.containerOf(context).read(appProvider);
          final rider = provider.rider;

          if (rider == null) {
            Toast.error(context, 'Rider not found. Please contact support.');
            return;
          }

          final nextState = state
              ._lifecycleTargetToAuthState(RiderLifecycleGate.redirect(rider));

          if (isNewRider) {
            // Brand-new rider: they already saw legal before login.
            // Go straight to their lifecycle target (intent/userForm).
            state._navigateToLocal(nextState);
          } else {
            // Returning rider: bypass legal (already accepted) and
            // go straight to their lifecycle target.
            state._navigateToLocal(nextState);
          }
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
        onStepNavigation: (targetState) {
          state._navigateToLocal(targetState);
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
        onNext: (
          hubId,
          vehicleId,
          teamLeader,
          emergencyContact,
          photoFront,
          photoBack,
          photoLeft,
          photoRight,
          photoWithVehicle,
        ) {
          state.updatePickupData(
            hubId: hubId,
            vehicleId: vehicleId,
            teamLeader: teamLeader,
            emergencyContact: emergencyContact,
            photoFront: photoFront,
            photoBack: photoBack,
            photoLeft: photoLeft,
            photoRight: photoRight,
            photoWithVehicle: photoWithVehicle,
          );
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
        onFinish: () {
          state._navigateToLocal(AuthState.dashboard);
          // Show feedback prompt after onboarding completes
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text(
                      'Welcome to Voltium! How was your experience?'),
                  action: SnackBarAction(
                    label: 'Rate Us',
                    textColor: Colors.white,
                    onPressed: () {
                      AppNavigator.push(
                          context,
                          FeedbackScreen(
                              onSubmit: () => Navigator.pop(context)));
                    },
                  ),
                ),
              );
            }
          });
        },
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

    case AuthState.topUpAmount:
      final rider = ProviderScope.containerOf(context).read(appProvider).rider;
      currentScreen = TopUpAmountScreen(
        key: const ValueKey('topUpAmount'),
        securityDeposit: rider?.activeRentalPlanSecurityDeposit.toInt(),
        rentalPrice: rider?.activeRentalPlanPrice.toInt(),
        onBack: () => state._navigateToLocal(
          state._isOnboarding ? AuthState.preDashboard : AuthState.dashboard,
        ),
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
        purpose: state._isOnboarding ? 'SECURITY_DEPOSIT' : 'TOP_UP',
        onBack: () => state._navigateToLocal(AuthState.topUpAmount),
        onSubmit: () => state._navigateToLocal(AuthState.topUpProof),
        onEditAmount: () => state._navigateToLocal(AuthState.topUpAmount),
      );
      break;

    case AuthState.topUpProof:
      currentScreen = TopUpProofScreen(
        key: const ValueKey('topUpProof'),
        amount: state._topUpAmount,
        onBack: () => state._navigateToLocal(AuthState.topUpUpi),
        onEditAmount: () => state._navigateToLocal(AuthState.topUpAmount),
        onSubmit: (_) async {
          state._navigateToLocal(AuthState.topUpReceipt);
        },
      );
      break;

    case AuthState.topUpReceipt:
      currentScreen = TopUpReceiptScreen(
        key: const ValueKey('topUpReceipt'),
        amount: state._topUpAmount,
        purpose: state._isOnboarding ? 'SECURITY_DEPOSIT' : 'TOP_UP',
        onBackToDashboard: () {
          state._navigateToLocal(
            state._isOnboarding ? AuthState.preDashboard : AuthState.dashboard,
          );
          // Show feedback prompt after wallet top-up
          WidgetsBinding.instance.addPostFrameCallback((_) {
            if (context.mounted) {
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(
                  content: const Text('How was your top-up experience?'),
                  action: SnackBarAction(
                    label: 'Rate Us',
                    textColor: Colors.white,
                    onPressed: () {
                      AppNavigator.push(
                          context,
                          FeedbackScreen(
                              onSubmit: () => Navigator.pop(context)));
                    },
                  ),
                ),
              );
            }
          });
        },
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

  return PopScope(
    canPop: state._canPop,
    onPopInvoked: (didPop) {
      if (didPop) return;
      state._handleSystemBack();
    },
    child: Scaffold(
      body: state.childScreenWrapper(currentScreen),
    ),
  );
}

/// Returns true when the rider has, by either cached snapshot or live
/// provider data, completed vehicle pickup. Used by the splash-screen
/// callback when deciding whether to land on dashboard or pre-dashboard.
bool isPickupDone(dynamic liveRider, Map<String, dynamic> cachedRider) {
  if (liveRider != null && liveRider.pickupDone == true) return true;
  return cachedRider['pickupDone'] == true ||
      cachedRider['pickupDone'] == 'true';
}
