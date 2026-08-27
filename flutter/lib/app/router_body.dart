part of 'router.dart';

Widget _buildRouterBody(BuildContext context, _AppRouterState state) {
  appDebug('AppRouter: Building with state: ${state._currentState}');
  Widget currentScreen;

  switch (state._currentState) {
    case AuthState.splash:
      currentScreen = SplashScreen(
        key: const ValueKey('splash'),
        onComplete: () async {
          // Capture provider reference BEFORE any await so we don't
          // touch BuildContext across an async gap (lint guard).
          final provider =
              ProviderScope.containerOf(context).read(riderProvider);
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

            // ONBOARDING-AUDIT 2026-08-14 P2-1: also compare the
            // cached lifecycle rank against the live rank. The
            // previous check only flagged SUSPENDED/TERMINATED —
            // a rider who advanced from KYC_SUBMITTED (rank 3) to
            // KYC_APPROVED (rank 4) while the app was killed would
            // be restored to the old state, see a flash of the
            // wrong surface, then re-route within a frame. Allow
            // advances of up to 2 ranks (admin multi-step actions
            // like KYC + Guarantor approval in one go) to avoid
            // losing the rider's exact position; anything bigger
            // is a stale cache.
            int? cachedRank;
            final cachedLifecycleStatus = cachedRider['lifecycleStatus'];
            if (cachedLifecycleStatus is String &&
                cachedLifecycleStatus.isNotEmpty) {
              cachedRank = _lifecycleRankFromString(cachedLifecycleStatus);
            }
            final liveRank =
                liveRider != null ? lifecycleRank(liveRider) : null;
            final isStaleRankAdvance = cachedRank != null &&
                liveRank != null &&
                liveRank > cachedRank + 2;

            // If intake data has materially drifted, drop any saved state.
            final cacheIsStale = (cachedPickupDone != livePickupDone) ||
                liveRider == null ||
                isStaleLifecycle ||
                isStaleRankAdvance;

            final savedStateStr =
                CacheService().getString('voltium_saved_auth_state');
            AuthState? restoredState;
            if (savedStateStr != null && !cacheIsStale) {
              try {
                restoredState = AuthState.values.firstWhere(
                  (e) => e.name == savedStateStr,
                );
              } catch (e) {
                appDebug('AppRouter: failed to restore saved auth state: $e');
              }
            } else if (cacheIsStale) {
              appDebug('AppRouter: discarding stale cached state — pickupDone: '
                  'cached=$cachedPickupDone live=$livePickupDone, '
                  'lifecycle=${liveRider?.lifecycleStatus ?? 'null'}');
            }

            if (restoredState != null &&
                restoredState != AuthState.splash &&
                restoredState != AuthState.login &&
                restoredState != AuthState.otp &&
                restoredState != AuthState.accountClosed) {
              // PR-7 (PICKUP P0-2): a saved pickup state is only resumable
              // when the draft is still valid against the API (the hub may
              // have been deactivated or the vehicle taken while the app
              // was killed). Revalidate first; fall back to pre-dashboard
              // when the draft is stale so the rider re-picks a vehicle.
              if (restoredState == AuthState.pickupVerification ||
                  restoredState == AuthState.pickupHub) {
                final canResume = await state.revalidatePickupDraft();
                if (!canResume) {
                  state._navigateToLocal(AuthState.preDashboard);
                  return;
                }
                if (restoredState == AuthState.pickupVerification &&
                    !state.hasPickupDraft) {
                  // No (complete) draft to back the verification screen —
                  // start over and drop any partial draft so it cannot
                  // linger in SharedPreferences forever.
                  state.clearPickupDraft();
                  state._navigateToLocal(AuthState.preDashboard);
                  return;
                }
              }
              state._navigateToLocal(restoredState);
            } else {
              // accountClosed is terminal: always re-derive from lifecycle.
              if (liveRider != null &&
                  (liveRider.accountStatus == AccountStatus.terminated ||
                      liveRider.lifecycleStatus.toUpperCase() ==
                          'TERMINATED')) {
                state._navigateToLocal(AuthState.accountClosed);
              } else if (liveRider != null) {
                // PR-ONBOARDING-FLOW-2026-08-12: cold-start fallback for
                // the new active path. Use the lifecycle gate's redirect
                // to land the rider on the exact next active-path step
                // for their rank, not the older pre-dashboard. The
                // didChangeDependencies would re-route within a frame,
                // but landing on the right screen directly avoids a
                // flash of the wrong surface. The redirect already
                // handles rank 10 (hangTight) and rank 11+ (dashboard).
                final target = RiderLifecycleGate.redirect(liveRider);
                state._navigateToLocal(
                    state._lifecycleTargetToAuthState(target));
              } else {
                // No live rider — fall back to the archived pre-dashboard
                // so the rider has somewhere to land. The lifecycle gate
                // will re-route on the first didChangeDependencies once
                // the rider data is available.
                state._navigateToLocal(AuthState.preDashboard);
              }
            }
          } else {
            // PR-A: route through the KYC pre-flight checklist first.
            // Riders see "you'll need Aadhaar, PAN, ~3 minutes" before
            // the legal wall, which reduces onboarding drop-off.
            //
            // Audit #5 P0-2: the legal screen used to re-appear on every
            // cold start because nothing read `legal_accepted_v1`. Once
            // accepted, skip both the checklist and the legal wall on
            // subsequent launches.
            final legalAccepted =
                CacheService().getBool('legal_accepted_v1') ?? false;
            state._navigateToLocal(firstLaunchGateState(legalAccepted));
          }
        },
      );
      break;

    case AuthState.kycPreflight:
      // PR-A: pre-flight checklist shown BEFORE the legal wall.
      // Riders see "you'll need Aadhaar, PAN, ~3 minutes" with an
      // "I'm Ready" CTA. Reduces onboarding drop-off by ~20% per the
      // implementation plan. The legal text is unchanged — only the
      // navigation prefix is new. (Audit #7 P0-3: the misleading
      // "Address Proof" tile was removed in 2026-08-06.)
      currentScreen = KycPreflightScreen(
        key: const ValueKey('kyc_preflight'),
        onNext: () {
          state._navigateToLocal(AuthState.legal);
        },
        onSkip: () {
          // Skip is best-effort: legal is still required (rider must
          // accept the rider agreement), but we let them skip the
          // document-prep hint and come back when they have docs.
          state._navigateToLocal(AuthState.legal);
        },
      );
      break;

    case AuthState.legal:
      currentScreen = LegalScreen(
        key: const ValueKey('legal'),
        onBack: () {
          state._navigateToLocal(AuthState.kycPreflight);
        },
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
        onNext: (phone, referralCode) {
          state._phone = phone;
          state._referralCode = referralCode;
          state._navigateToLocal(AuthState.otp);
        },
      );
      break;

    case AuthState.otp:
      currentScreen = OtpVerificationScreen(
        key: const ValueKey('otp'),
        phoneNumber: state._phone,
        referralCode: state._referralCode,
        onBack: () => state._navigateToLocal(AuthState.login),
        onNext: (bool isNewRider) {
          final provider =
              ProviderScope.containerOf(context).read(riderProvider);
          final rider = provider.rider;

          if (rider == null) {
            final l10n = AppLocalizations.of(context);
            Toast.error(
                context,
                l10n?.txtriderNotFound ??
                    'Rider not found. Please contact support.');
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
        // PR-ONBOARDING-FLOW-2026-08-12: the intent screen is the
        // first step of the active path — there is no previous
        // active-path step to go back to. The back button is a no-op
        // and the screen is non-popable in the router (see _canPop).
        onBack: () {},
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
        // PR-ONBOARDING-FLOW-2026-08-11: in the new active path the
        // guarantor form advances directly to plan selection. The
        // older flow's pre-dashboard is no longer reached from the
        // active path; the screen is preserved in code for the case
        // where a rider in a partial lifecycle state (rank 3-9)
        // needs to re-enter the flow.
        onNext: () {
          state._navigateToLocal(AuthState.choosePlan);
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
        // PR-ONBOARDING-FLOW-2026-08-12: back from plan selection goes
        // to the guarantor form (the previous step in the active
        // path), not the archived pre-dashboard. The active path is
        // guarantor → plan → deposit → pickup → hangTight; the rider
        // cannot jump back to a non-existent pre-dashboard entry point.
        onBack: () => state._navigateToLocal(AuthState.guarantorForm),
        // PR-ONBOARDING-FLOW-2026-08-13: active path now routes
        // plan selection → Enter Amount screen (topUpAmount). The
        // screen auto-fills the required amount from the selected
        // plan: security deposit + advance rental (when the rider
        // ticked the "Pay advance rent" checkbox on this screen).
        // The rider confirms the amount and proceeds through the
        // existing top-up proof flow (purpose: SECURITY_DEPOSIT) to
        // upload payment proof for admin review. After the top-up
        // receipt, the rider advances to planSuccess → pickupHub.
        onNext: () => state._navigateToLocal(AuthState.topUpAmount),
      );
      break;

    // PR-ONBOARDING-FLOW-2026-08-13: the Enter Amount screen is now
    // the deposit entry point in the active path (replaced the
    // dedicated deposit workflow screen). The screen reads the
    // rider's plan + advance-rent flag from the rider provider and
    // auto-fills the required amount — no manual entry needed. The
    // top-up flow that follows (topUpProof → topUpReceipt) creates
    // a SECURITY_DEPOSIT transaction (the receipt screen already
    // switches `purpose` based on `_isOnboarding`).
    //
    // Dual-purpose: this same screen also serves the dashboard's
    // "Add Money" flow when the rider is already active. The back
    // button branches on `_isOnboarding` so onboarding returns to
    // plan selection and the dashboard returns to the dashboard.
    case AuthState.topUpAmount:
      final rider =
          ProviderScope.containerOf(context).read(riderProvider).rider;
      // PR-9 (2026-08-21): the in-flight amount is now in
      // `topUpFlowProvider` instead of `_AppRouterState._topUpAmount`.
      // Backing out of the amount screen and re-entering now resumes
      // the same value rather than re-defaulting to 2000.
      final topUpNotifier =
          ProviderScope.containerOf(context).read(topUpFlowProvider.notifier);
      final topUpAmount =
          ProviderScope.containerOf(context).read(topUpFlowProvider).amount;
      currentScreen = TopUpAmountScreen(
        key: const ValueKey('topUpAmount'),
        initialAmount: topUpAmount > 0 ? topUpAmount : null,
        securityDeposit: rider?.activeRentalPlanSecurityDeposit.toInt(),
        rentalPrice: rider?.activeRentalPlanPrice.toInt(),
        onBack: () => state._navigateToLocal(
          // PR-ONBOARDING-FLOW-2026-08-13: onboarding back returns to
          // plan selection; dashboard back returns to the dashboard.
          // Pre-dashboard is archived and not reachable from the
          // active path.
          state._isOnboarding ? AuthState.choosePlan : AuthState.dashboard,
        ),
        onProceed: (amount) {
          topUpNotifier.setAmount(amount);
          state._navigateToLocal(AuthState.topUpProof);
        },
        // ONBOARDING-AUDIT 2026-08-14 P1-7: previously the active path
        // never wired this callback, so the proof screen would render
        // with a stale amount if the user backed out, edited, then
        // re-proceeded. Capture edits live so the top-up amount
        // always reflects the latest textbox value.
        onAmountChanged: (amount) {
          topUpNotifier.setAmount(amount);
        },
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
        // PR-ONBOARDING-FLOW-2026-08-13: back from the pickup hub
        // goes to the deposit proof screen (the previous step in
        // the active path), not planSuccess (which the rider now
        // skips after submitting the deposit proof). The active
        // path runs choosePlan → topUpAmount → topUpProof →
        // pickupHub; the back chain follows the same order.
        onBack: () => state._navigateToLocal(AuthState.topUpProof),
        // PR-7 (PICKUP P0-2): feed the restored draft back into the form so
        // a rider killed mid-hub-form resumes with hub/vehicle/contact/photo
        // selections intact instead of a blank form.
        // PR-PICKUP-OTP: the emergency-contact OTP receipt is restored too,
        // but only honored while inside the short validity window and only
        // when the receipt phone matches the restored contact — otherwise
        // the rider re-verifies exactly as a fresh session would.
        initialHubId: state._pickupHubId,
        initialVehicleId: state._pickupVehicleId,
        initialTeamLeader: state._pickupTeamLeader,
        initialEmergencyContact: state._pickupEmergencyContact,
        initialEmergencyContactVerifiedPhone:
            state._pickupEmergencyContactVerifiedPhone,
        initialEmergencyContactVerifiedAt:
            state._pickupEmergencyContactVerifiedAt,
        onEmergencyContactVerified: state.markEmergencyContactVerified,
        initialPhotos: {
          if (state._pickupPhotoFront != null) 'front': state._pickupPhotoFront,
          if (state._pickupPhotoBack != null) 'back': state._pickupPhotoBack,
          if (state._pickupPhotoLeft != null) 'left': state._pickupPhotoLeft,
          if (state._pickupPhotoRight != null) 'right': state._pickupPhotoRight,
          if (state._pickupPhotoWithVehicle != null)
            'with_vehicle': state._pickupPhotoWithVehicle,
        },
        onNext: (
          hubId,
          vehicleId,
          teamLeader,
          emergencyContact,
          photoFront,
          photoBack,
          photoLeft,
          photoRight,
          photoWithVehicle, {
          emergencyContactReceipt,
        }) {
          // PR-PICKUP-OTP: forward the server-issued verify-phone receipt so
          // it survives the hub → verification navigation AND an app kill
          // (it is persisted with the draft in updatePickupData).
          state.updatePickupData(
            hubId: hubId,
            vehicleId: vehicleId,
            teamLeader: teamLeader,
            emergencyContact: emergencyContact,
            emergencyContactReceipt: emergencyContactReceipt,
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
        // PR-PICKUP-OTP: the signed verify-phone receipt (restored from the
        // persisted draft) is forwarded with the final submit so the server
        // can enforce the emergency-contact OTP gate.
        emergencyContactReceipt: state._pickupEmergencyContactReceipt,
        teamLeader: state._pickupTeamLeader,
        pickupPhotoFront: state._pickupPhotoFront,
        pickupPhotoBack: state._pickupPhotoBack,
        pickupPhotoLeft: state._pickupPhotoLeft,
        pickupPhotoRight: state._pickupPhotoRight,
        pickupPhotoWithVehicle: state._pickupPhotoWithVehicle,
        onBack: () => state._navigateToLocal(AuthState.pickupHub),
        // PR-ONBOARDING-FLOW-2026-08-11: in the new active path the
        // pickup form advances to hangTight (async wait state) instead
        // of the synchronous pickup-success ("You're Live!") screen.
        // The rider is not yet active at this point — the server sets
        // PICKUP_SCHEDULED, and the lifecycle gate keeps them on
        // hangTight until admin flips them to ACTIVE.
        onNext: () => state._navigateToLocal(AuthState.hangTight),
      );
      break;

    // PR-ONBOARDING-FLOW-2026-08-13: `AuthState.pickupSuccess` is no
    // longer reachable from the active path (pickupVerification
    // advances to hangTight). The case is removed so the dead code
    // does not drift (the "Rate Us" snackbar it triggered was a
    // known hijack pattern from prior audits). The AuthState enum
    // value is preserved for any admin-side / older-flow tool that
    // still routes a rider there, and `PickupSuccessScreen` is
    // preserved in lib/features/pickup/ for the same reason — but
    // no Flutter navigation lands on it from the rider-facing flow.

    // PR-ONBOARDING-FLOW-2026-08-11: async wait state in the new active
    // onboarding path. The screen polls the rider provider and calls
    // [onActivated] when admin activates the rider — the router then
    // routes to the dashboard. The screen is the only piece of UI the
    // rider sees between submitting the pickup form and becoming
    // active.
    case AuthState.hangTight:
      currentScreen = HangTightScreen(
        key: const ValueKey('hangTight'),
        onActivated: () => state._navigateToLocal(AuthState.dashboard),
        // PR-K.1: route the rider back to the intent screen so they can
        // re-do the KYC flow. AuthState.intent renders
        // Onboarding(OnboardingStep.intent) -> IntentOfUseScreen.
        onFixKyc: () => state._navigateToLocal(AuthState.intent),
        // PR-ONBOARDING-FLOW-2026-08-13: a polling 401 means the rider's
        // JWT has expired (admin takes >1 hour to approve). Send them
        // to the login screen instead of leaving them stuck on a screen
        // that polls forever and never gets fresh data.
        onSessionExpired: () {
          // The router's logout path mirrors the accountClosed screen
          // — clear the cached rider + saved auth state, then route to
          // login. A rider who lost their session mid-onboarding
          // resumes at the right step (the cached rider is dropped, the
          // next login reads the live rider from the server).
          ProviderScope.containerOf(context)
              .read(riderProvider.notifier)
              .logout();
          state.clearPickupDraft();
          CacheService().remove('voltium_saved_auth_state');
          state._navigateToLocal(AuthState.login);
        },
      );
      break;

    case AuthState.dashboard:
      currentScreen = const AppShell(key: ValueKey('dashboard'));
      break;

    case AuthState.tlDetails:
      currentScreen = TlDetailsScreen(
        key: const ValueKey('tlDetails'),
        onBack: () => state._navigateToLocal(AuthState.dashboard),
      );
      break;

    // PR-3 (2026-08-07 master fix plan): lifecycle-aware rental details.
    // The End Rental button still pushes `EndRentalScreen` directly via
    // MaterialPageRoute (the success path is local to that screen), but
    // the rental-details view itself is now reachable via the router
    // state machine so admin actions (KYC revoke, account suspend,
    // rental cancelled) route the rider off stale data.
    case AuthState.rentalDetails:
      currentScreen = RentalDetailsScreen(
        key: const ValueKey('rentalDetails'),
        onBack: () => state._navigateToLocal(AuthState.dashboard),
      );
      break;

    case AuthState.endRental:
      currentScreen = EndRentalScreen(
        key: const ValueKey('endRental'),
        onBack: () => state._navigateToLocal(AuthState.dashboard),
        onSuccess: () => state._navigateToLocal(AuthState.dashboard),
      );
      break;

    case AuthState.faq:
      currentScreen = FaqScreen(
        key: const ValueKey('faq'),
        onBack: () => state._navigateToLocal(AuthState.dashboard),
      );
      break;

    case AuthState.vehiclePhotos:
      currentScreen = VehiclePhotosScreen(
        key: const ValueKey('vehiclePhotos'),
        onBack: () => state._navigateToLocal(AuthState.dashboard),
      );
      break;

    case AuthState.topUpUpi:
    case AuthState.topUpProof:
      // PR-9 (2026-08-21): read the in-flight amount from the
      // topUpFlowProvider so a backout + re-enter preserves the
      // value the rider just typed.
      final topUpContainer = ProviderScope.containerOf(context);
      final topUpAmount = topUpContainer.read(topUpFlowProvider).amount;
      final topUpNotifier = topUpContainer.read(topUpFlowProvider.notifier);
      currentScreen = TopUpProofScreen(
        key: const ValueKey('topUpProof'),
        amount: topUpAmount,
        onBack: () => state._navigateToLocal(AuthState.topUpAmount),
        onEditAmount: () => state._navigateToLocal(AuthState.topUpAmount),
        onSubmit: (file, method, upiRef) async {
          // ONBOARDING-AUDIT 2026-08-14 P0-1: the previous implementation
          // only navigated, dropping the proof image / payment method /
          // UPI ref on the floor — every rider who finished the active
          // path submitted no transaction. We now mirror the working
          // pattern from `top_up_flow.dart:98-158` (legacy dashboard
          // flow) so the SECURITY_DEPOSIT actually reaches the server.
          //
          // The TopUpProofScreen already disables its submit button
          // while `_isUploading` is true (P1-2 guard at the screen
          // layer), so we don't need a duplicate guard here.
          //
          // PR-ONBOARDING-FLOW-2026-08-13: the active onboarding path
          // (SECURITY_DEPOSIT) routes DIRECTLY to the pickup form —
          // the topUpReceipt + planSuccess confirmations are skipped
          // because the rider has just confirmed payment and the next
          // actionable step is the pickup form. The dashboard top-up
          // flow (TOP_UP) still routes through the receipt so the
          // rider sees the confirmation after adding money to the
          // wallet.
          final rider = ProviderScope.containerOf(context).read(riderProvider);
          final riderId = rider.riderId;
          // Capture every notifier + messenger BEFORE any await so we
          // never touch BuildContext across the gap (analyzer guard).
          final wProvider =
              ProviderScope.containerOf(context).read(walletProvider.notifier);
          final riderNotifier =
              ProviderScope.containerOf(context).read(riderProvider.notifier);
          if (riderId == null) {
            Toast.info(
              context,
              AppLocalizations.of(context)?.txtriderSessionNotReady ??
                  'Could not submit: rider session is not ready yet. '
                      'Please try again in a moment.',
            );
            return;
          }
          final purpose = state._isOnboarding ? 'SECURITY_DEPOSIT' : 'TOP_UP';
          try {
            await wProvider.topUpWallet(
              riderId: riderId,
              amount: topUpAmount.toDouble(),
              method: method ?? 'CASH',
              upiRef: upiRef,
              image: file,
              purpose: purpose,
            );
            // PR-9 (2026-08-21): the in-flight amount is no longer on
            // the router state, so reset the provider instead.
            topUpNotifier.reset();
            // Pull fresh rider so balance + KYC state reflect the new
            // pending transaction.
            await riderNotifier.refreshFromApi();
            if (state.mounted) {
              Toast.success(
                state.context,
                state._isOnboarding
                    ? (AppLocalizations.of(state.context)
                            ?.txtsecurityDepositProofSubmitted ??
                        'Security deposit proof submitted — we\'ll review it shortly.')
                    : (AppLocalizations.of(state.context)
                            ?.txttopUpProofSubmitted ??
                        'Top-up proof submitted successfully!'),
              );
            }
            state._navigateToLocal(
              state._isOnboarding
                  ? AuthState.pickupHub
                  : AuthState.topUpReceipt,
            );
          } catch (e) {
            if (state.mounted) {
              Toast.error(state.context, safeErrorMessage(e, 'top-up'));
            }
          }
        },
      );
      break;

    case AuthState.topUpReceipt:
      // PR-9 (2026-08-21): read the in-flight amount from the
      // topUpFlowProvider so the receipt reflects what was submitted.
      final topUpAmount =
          ProviderScope.containerOf(context).read(topUpFlowProvider).amount;
      currentScreen = TopUpReceiptScreen(
        key: const ValueKey('topUpReceipt'),
        amount: topUpAmount,
        purpose: state._isOnboarding ? 'SECURITY_DEPOSIT' : 'TOP_UP',
        onBackToDashboard: () {
          // PR-ONBOARDING-FLOW-2026-08-13: after the security-deposit
          // proof is submitted, the rider advances to planSuccess
          // (the next step in the active path), not the archived
          // pre-dashboard. The dashboard top-up flow still returns
          // to the dashboard as before.
          state._navigateToLocal(
            state._isOnboarding ? AuthState.planSuccess : AuthState.dashboard,
          );
        },
      );
      break;

    case AuthState.referralDetails:
      currentScreen = ReferralScreen(
        key: const ValueKey('referralDetails'),
        onBack: () => state._navigateToLocal(AuthState.dashboard),
      );
      break;

    case AuthState.legalPage:
      currentScreen = LegalPageScreen(
        key: const ValueKey('legalPage'),
        onBack: () => state._navigateToLocal(AuthState.legal),
      );
      break;

    case AuthState.myDocuments:
      currentScreen = MyDocumentsScreen(
        key: const ValueKey('myDocuments'),
        onBack: () => state._navigateToLocal(AuthState.dashboard),
      );
      break;

    case AuthState.accountClosed:
      // Terminal state for terminated riders. Renders a dedicated
      // surface (logout + support contact) so a terminated rider is
      // never offered onboarding CTAs.
      currentScreen = _buildAccountClosedScreen(context, state);
      break;
    // PR-ONBOARDING-FLOW-2026-08-13: `AuthState.pickupSuccess` is
    // preserved in the enum for back-compat with admin-side
    // navigation, but is unreachable from the active path. The
    // default branch routes any future stray navigation to the
    // dashboard — semantically equivalent to the old "You're live"
    // surface (the rider has been approved and is now active).
    //
    // The `default` is intentional: it's insurance against a future
    // `AuthState` enum addition landing in this build before a
    // matching `case` is added. Without it, a stray enum value
    // would silently leave `currentScreen` uninitialised and the
    // router would throw. The current lint sees it as unreachable
    // because every existing enum value has an explicit case above.
    case AuthState.pickupSuccess:
    // ignore: unreachable_switch_default
    default:
      currentScreen = const AppShell(key: ValueKey('dashboard'));
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

/// Renders the terminal "account closed" surface for terminated riders.
///
/// Shown when the lifecycle gate routes a rider to
/// `AuthState.accountClosed`. The rider is given a clear explanation, a
/// "Contact support" link, and a "Log out" button. There is no path
/// forward into the rest of the app from this surface.
Widget _buildAccountClosedScreen(BuildContext context, _AppRouterState state) {
  return SafeArea(
    child: Padding(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 32),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Icon(
            Icons.block_rounded,
            size: 72,
            color: AppColors.error,
          ),
          const SizedBox(height: 24),
          Text(
            'Account closed',
            textAlign: TextAlign.center,
            style: AppTypography.headingMedium.copyWith(
              color: AppColors.of(context).onSurface,
            ),
          ),
          const SizedBox(height: 12),
          Text(
            'Your Voltium account has been closed. You will not be able '
            'to rent vehicles or use the app until this is resolved.\n\n'
            'If you believe this was a mistake, please reach out to our '
            'support team and we will be happy to help.',
            textAlign: TextAlign.center,
            style: AppTypography.bodyMedium,
          ),
          const SizedBox(height: 32),
          OutlinedButton.icon(
            key: const ValueKey('accountClosedContactSupport'),
            icon: const Icon(Icons.support_agent_rounded),
            label: const Text('Contact support'),
            onPressed: () async {
              final uri = Uri.parse('mailto:support@voltium.in');
              try {
                await launchUrl(uri, mode: LaunchMode.externalApplication);
              } catch (_) {
                // Silent: support button is best-effort.
              }
            },
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            key: const ValueKey('accountClosedLogout'),
            icon: const Icon(Icons.logout_rounded),
            label: const Text('Log out'),
            onPressed: () async {
              // ONBOARDING-AUDIT 2026-08-14 P3-5: was `catch (_)`
              // followed by a force-local-logout. The risk is a
              // weak-network logout that wipes local state but leaves
              // the JWT live on the server — if the rider logs in
              // again, the server may treat both sessions as live
              // (cross-account leak surface). We now surface the
              // failure and refuse to proceed so the rider can retry.
              try {
                await ProviderScope.containerOf(state.context)
                    .read(riderProvider.notifier)
                    .logout();
              } catch (e) {
                appDebug('[accountClosedLogout] server logout failed: $e');
                if (!state.mounted) return;
                Toast.error(
                  state.context,
                  'Logout failed. ${safeErrorMessage(e, "logout")}\n\n'
                  'Please try again when you have a stable connection.',
                );
                return;
              }
              // PR-7 (PICKUP P0-2): drop any persisted draft on logout.
              state.clearPickupDraft();
              if (!state.mounted) return;
              await CacheService().remove('voltium_saved_auth_state');
              if (!state.mounted) return;
              state._navigateToLocal(AuthState.login);
            },
          ),
        ],
      ),
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

/// ONBOARDING-AUDIT 2026-08-14 P2-1: rank lookup from a string
/// status, used in the splash restore path to detect a cached rider
/// whose lifecycle has materially advanced since the snapshot.
///
/// The previous copy of this function lived here and held its own
/// private rank map — the duplicate had drifted (was missing
/// `ACTIVE_RIDING` and `RIDING`) and returned `?? 0` on an unknown
/// status, which silently treated the rider as NEW and rerouted
/// them to the intent screen. Use the canonical helper from
/// `utils/lifecycle_rank.dart` instead. The two signatures match
/// (`String -> int`), so the call site below is unchanged.
int _lifecycleRankFromString(String status) => lifecycleRankFromString(status);
