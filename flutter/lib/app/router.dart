import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:permission_handler/permission_handler.dart';
import 'package:url_launcher/url_launcher.dart';
import '../models/rider_model.dart' show AccountStatus;
import '../gen/app_localizations.dart';
import '../theme/app_theme.dart';
import '../theme/app_typography.dart';
import '../utils/app_constants.dart';
import '../utils/app_logger.dart';
import '../utils/lifecycle_rank.dart';
import '../utils/toast.dart';

import '../core/state/riverpod_providers.dart';
import '../core/state/rider_provider.dart' show kPickupDraftCacheKey;
import '../core/network/api_error_messages.dart';
import '../services/cache_service.dart';
import '../services/voltium_api_service.dart';
import '../widgets/app_shell.dart';

// Relocated screens
import '../features/auth/presentation/screens/login_screen.dart';
import '../features/auth/presentation/screens/otp_verification_screen.dart';
import '../features/auth/presentation/rider_lifecycle_gate.dart';

import '../features/onboarding/presentation/screens/splash_screen.dart';
import '../features/onboarding/presentation/screens/kyc_preflight_screen.dart';
import '../features/onboarding/presentation/screens/legal_screen.dart';
import '../features/onboarding/presentation/screens/legal_page_screen.dart';

import '../features/onboarding/presentation/screens/permissions_screen.dart';

import '../features/kyc/presentation/screens/intent_of_use_screen.dart';
import '../features/kyc/presentation/screens/user_onboarding_screen.dart';
import '../features/kyc/presentation/screens/documents_screen.dart';
import '../features/guarantor/presentation/screens/guarantor_onboarding_screen.dart';

import '../features/wallet/presentation/screens/top_up_amount_screen.dart';

import '../features/wallet/presentation/screens/top_up_receipt_screen.dart';
import '../features/wallet/presentation/screens/top_up_proof_screen.dart';

import '../features/rentals/presentation/screens/choose_plan_screen.dart';
import '../features/rentals/presentation/screens/plan_success_screen.dart';
import '../features/rentals/presentation/screens/end_rental_screen.dart';
// PR-3 (2026-08-07 master fix plan): rentalDetails added to AuthState so
// the screen is lifecycle-aware (KYC revoke / admin suspend mid-screen
// now route the rider off instead of stranding them on stale data).
import '../features/rentals/presentation/screens/rental_details_screen.dart';

import '../features/pickup/presentation/screens/pickup_hub_screen.dart';
import '../features/pickup/presentation/screens/pickup_verification_screen.dart';
// PR-ONBOARDING-FLOW-2026-08-13: pickup_success_screen import
// removed — the active path no longer routes there. The file is
// preserved in lib/features/pickup/ for any admin / older-flow
// tool that still needs it.
// import '../features/pickup/presentation/screens/pickup_success_screen.dart';
import '../features/pickup/presentation/screens/tl_details_screen.dart';
import '../features/pickup/presentation/screens/vehicle_photos_screen.dart';

import '../features/dashboard/presentation/screens/legacy/pre_dashboard_screen.dart';
// PR-ONBOARDING-FLOW-2026-08-11: async wait state in the new active
// onboarding path. Renders after the pickup form is submitted while the
// rider is in PICKUP_SCHEDULED (rank 10) and waiting for admin to flip
// them to ACTIVE. Replaces the synchronous pre-dashboard wait at the
// tail of the new flow; the pre-dashboard screen (and the older
// synchronous pickup-success) remain in code but are not reached from
// the active path.
import '../features/dashboard/presentation/screens/hang_tight_screen.dart';
// PR-ONBOARDING-FLOW-2026-08-13: the active-path deposit entry
// point moved to the Enter Amount screen (topUpAmount). The
// dedicated deposit workflow screen is archived in `legacy/`
// in case the older flow needs to be brought back.

import '../features/support/presentation/screens/faq_screen.dart';
import '../features/referrals/presentation/screens/referral_screen.dart';

import 'app_state.dart';
import 'auth_state_group.dart';

part 'router_body.dart';

/// First-launch gate (audit #5 P0-2): the legal wall used to re-appear on
/// every cold start because nothing read `legal_accepted_v1`. Once the rider
/// accepts the legal documents, that flag is persisted and both the KYC
/// pre-flight checklist and the legal wall are skipped on subsequent launches.
///
/// Exported as a pure function so the router decision is unit-testable.
AuthState firstLaunchGateState(bool legalAccepted) =>
    legalAccepted ? AuthState.permissions : AuthState.kycPreflight;

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

  // PR-PICKUP-OTP: emergency-contact OTP verification receipt. The server
  // OTP is single-use (5-min expiry) and `verify-phone` returns no token,
  // so we persist a short-lived receipt (phone + epoch-ms of verification)
  // in the draft blob. Honored only while the phone still matches AND the
  // receipt is inside [AppConstants.emergencyContactVerificationWindow] —
  // a resumed rider skips re-verification, but the proof expires.
  int? _pickupEmergencyContactVerifiedAt;
  String? _pickupEmergencyContactVerifiedPhone;

  // PR-PICKUP-OTP: the server-issued signed receipt (verify-phone HMAC)
  // forwarded with the pickup submit so the server can enforce the OTP
  // gate. Persisted with the draft so a kill after verification still
  // submits with a valid receipt; expires server-side in 15 minutes.
  String? _pickupEmergencyContactReceipt;

  // PR-7 (PICKUP P0-2): the 9 pickup-draft fields above were lost on app
  // kill because they only lived on this State. Persist them to
  // SharedPreferences as a single JSON blob so a returning rider resumes
  // mid-flow instead of restarting from step 0. Cleared on submit + logout.
  // DEEP-AUDIT D-P2-11: the key is now centralized in rider_provider.dart
  // as kPickupDraftCacheKey so the orchestrator, main notifier, and router
  // cannot drift.
  static const _kPickupDraftKey = kPickupDraftCacheKey;

  void _persistPickupDraft() {
    final draft = <String, String?>{
      'hubId': _pickupHubId,
      'vehicleId': _pickupVehicleId,
      'teamLeader': _pickupTeamLeader,
      'emergencyContact': _pickupEmergencyContact,
      // PR-PICKUP-OTP: the verification receipt rides inside the draft blob
      // so it survives the same kill/restore lifecycle as the rest of the
      // pickup state. Epoch-ms stored as a string (blob is all-string).
      'emergencyVerifiedPhone': _pickupEmergencyContactVerifiedPhone,
      'emergencyVerifiedAt': _pickupEmergencyContactVerifiedAt?.toString(),
      'emergencyContactReceipt': _pickupEmergencyContactReceipt,
      'photoFront': _pickupPhotoFront,
      'photoBack': _pickupPhotoBack,
      'photoLeft': _pickupPhotoLeft,
      'photoRight': _pickupPhotoRight,
      'photoWithVehicle': _pickupPhotoWithVehicle,
    };
    // Strip nulls to keep the blob small and to detect "empty draft" via
    // `every((_) => _ == null)`.
    final cleaned = <String, String>{};
    draft.forEach((k, v) {
      if (v != null) cleaned[k] = v;
    });
    if (cleaned.isEmpty) {
      CacheService().remove(_kPickupDraftKey);
    } else {
      CacheService().setString(_kPickupDraftKey, jsonEncode(cleaned));
    }
  }

  void _restorePickupDraft() {
    final raw = CacheService().getString(_kPickupDraftKey);
    if (raw == null || raw.isEmpty) return;
    try {
      final decoded = jsonDecode(raw);
      if (decoded is! Map) return;
      _pickupHubId = decoded['hubId'] as String?;
      _pickupVehicleId = decoded['vehicleId'] as String?;
      _pickupTeamLeader = decoded['teamLeader'] as String?;
      _pickupEmergencyContact = decoded['emergencyContact'] as String?;
      _pickupEmergencyContactVerifiedPhone =
          decoded['emergencyVerifiedPhone'] as String?;
      _pickupEmergencyContactVerifiedAt =
          int.tryParse(decoded['emergencyVerifiedAt'] as String? ?? '');
      _pickupEmergencyContactReceipt =
          decoded['emergencyContactReceipt'] as String?;
      _pickupPhotoFront = decoded['photoFront'] as String?;
      _pickupPhotoBack = decoded['photoBack'] as String?;
      _pickupPhotoLeft = decoded['photoLeft'] as String?;
      _pickupPhotoRight = decoded['photoRight'] as String?;
      _pickupPhotoWithVehicle = decoded['photoWithVehicle'] as String?;
    } catch (_) {
      // Corrupt blob — clear it.
      CacheService().remove(_kPickupDraftKey);
    }
  }

  /// True when a persisted pickup draft has enough data to resume the flow.
  /// A hub + vehicle id are the minimum — photos/contact may still be
  /// missing if the rider was killed part-way through the hub form.
  bool get hasPickupDraft => _pickupHubId != null && _pickupVehicleId != null;

  /// PR-PICKUP-OTP: true when the persisted emergency-contact OTP receipt
  /// is still valid — issued for the current draft contact AND inside the
  /// short validity window. Shared freshness rule lives on AppConstants so
  /// the screen and the router can never drift.
  bool get hasFreshEmergencyContactVerification =>
      AppConstants.isEmergencyContactVerificationFresh(
        verifiedPhone: _pickupEmergencyContactVerifiedPhone,
        contact: _pickupEmergencyContact,
        verifiedAt: _pickupEmergencyContactVerifiedAt,
      );

  /// PR-PICKUP-OTP: record a successful emergency-contact OTP verification
  /// and persist it with the draft, so a rider killed after this point
  /// resumes without re-verifying (while the window is open). Called by
  /// PickupHubScreen on server-confirmed verify success.
  ///
  /// The signed server receipt is stored atomically with the marker. They
  /// share one persistence path so they can never diverge: a resumed draft
  /// that shows "verified" (fresh marker) is guaranteed to also carry the
  /// receipt the server will demand in enforced mode — otherwise a rider
  /// who verified, killed the app, and resumed would see the green check
  /// but get a 403 on submit.
  void markEmergencyContactVerified(String phone, [String? receipt]) {
    _pickupEmergencyContactVerifiedPhone = phone;
    _pickupEmergencyContactVerifiedAt = DateTime.now().millisecondsSinceEpoch;
    if (receipt != null && receipt.isNotEmpty) {
      _pickupEmergencyContactReceipt = receipt;
    } else {
      // A fresh verification with no signed receipt (older server) must not
      // keep a token issued for a previous phone — the marker-based
      // freshness check would report "verified" while the server phone-
      // match on submit would 403. A new proof replaces the old one;
      // a missing proof clears it so marker and receipt stay atomic.
      _pickupEmergencyContactReceipt = null;
    }
    _persistPickupDraft();
  }

  /// PR-7 (PICKUP P0-2): verify the restored draft is still valid against
  /// the API before resuming mid-flow. The hub may have been deactivated
  /// or the vehicle taken by another rider while the app was killed.
  ///
  /// Returns `true` when the draft can be resumed, `false` when it must be
  /// discarded (and the rider sent back to pre-dashboard to re-pick).
  /// Network failures return `true` (keep the draft) — the pickup hub
  /// screen refetches on load and surfaces staleness itself, so a flaky
  /// connection must never destroy the rider's in-progress work.
  Future<bool> revalidatePickupDraft() async {
    final hubId = _pickupHubId;
    final vehicleId = _pickupVehicleId;
    if (hubId == null || vehicleId == null) return true; // nothing to resume
    try {
      final hubsResp = await VoltiumApiService().fetchHubs();
      final hubs = (hubsResp['data'] as List?) ?? const [];
      final hubOk = hubs.any((h) {
        final map = h as Map;
        return map['id'] == hubId && (map['isActive'] ?? true) != false;
      });
      if (!hubOk) {
        clearPickupDraft();
        return false;
      }

      final vehResp = await VoltiumApiService().fetchVehicles(hubId);
      final data = vehResp['data'];
      final rawList = data is List
          ? data
          : (data is Map ? data['vehicles'] : vehResp['vehicles']);
      final vehicles = (rawList as List?) ?? const [];
      final vehicleOk = vehicles.any((v) {
        final m = v as Map;
        return m['id'] == vehicleId && m['status'] == 'AVAILABLE';
      });
      if (!vehicleOk) {
        clearPickupDraft();
        return false;
      }
      return true;
    } catch (_) {
      // Offline: keep the draft; the hub screen refetches on load.
      return true;
    }
  }

  /// Public escape hatch: called from submit success + logout to drop the
  /// draft (it should not survive a fresh start once the pickup is in).
  void clearPickupDraft() {
    setState(() {
      _pickupHubId = null;
      _pickupVehicleId = null;
      _pickupTeamLeader = null;
      _pickupEmergencyContact = null;
      _pickupEmergencyContactVerifiedPhone = null;
      _pickupEmergencyContactVerifiedAt = null;
      _pickupEmergencyContactReceipt = null;
      _pickupPhotoFront = null;
      _pickupPhotoBack = null;
      _pickupPhotoLeft = null;
      _pickupPhotoRight = null;
      _pickupPhotoWithVehicle = null;
    });
    CacheService().remove(_kPickupDraftKey);
  }

  /// Required permissions gate. PR-6 (2026-08-21): every permission
  /// listed on the onboarding permissions screen is now compulsory.
  /// This mirrors the user-facing onboarding contract: a rider cannot
  /// proceed past `AuthState.permissions` until all tiles are green.
  ///
  /// `ignoreBatteryOptimizations` IS included now (per user direction)
  /// even though the OS requires a multi-tap detour into Settings.
  /// `phone` is included; `call_log` rides on the same runtime
  /// permission as `phone` on Android API 33+. `device_admin` is
  /// tracked via `DevicePolicyProvider.isAdminActive` (not the
  /// permission_handler enum).
  Future<bool> _areAllRequiredPermissionsGranted() async {
    final isTestMode = AppConstants.isTestMode;
    if (isTestMode || kIsWeb) return true;

    final location = await Permission.locationWhenInUse.isGranted;
    final backgroundLocation = await Permission.locationAlways.isGranted;
    final camera = await Permission.camera.isGranted;
    final notifications = await Permission.notification.isGranted;
    final phone = await Permission.phone.isGranted;
    final contacts = await Permission.contacts.isGranted;
    final mic = await Permission.microphone.isGranted;
    final battery = await Permission.ignoreBatteryOptimizations.isGranted;

    final deviceAdmin = ref.read(devicePolicyProvider).isAdminActive;

    return location &&
        backgroundLocation &&
        camera &&
        notifications &&
        phone &&
        contacts &&
        mic &&
        battery &&
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
    // PR-7 (PICKUP P0-2): rehydrate any in-progress pickup draft.
    _restorePickupDraft();

    // ONBOARDING-AUDIT 2026-08-14 P0-4: the `ref.listen` for the
    // session-expired signal is registered in `didChangeDependencies`
    // (Riverpod 3 requires `ref.listen` inside the build phase, not
    // initState). The listener routes the rider to the login screen
    // and shows a friendly snackbar when the server returns 401.

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      try {
        ref.read(riderProvider.notifier).init();
        ref.read(supportProvider.notifier).initSupportData();
        ref.read(engagementProvider.notifier).initEngagementData();
        ref.read(devicePolicyProvider.notifier).checkSystemPermissions();
      } catch (e) {
        // ONBOARDING-AUDIT 2026-08-14 P3-4: was `catch (_) {}` —
        // swallowed everything including programming errors. Now we
        // log so silent init failures are visible. Still suppressed
        // (not rethrown) because the test framework deactivates
        // elements mid-pump and we don't want that path to crash a
        // passing test.
        appDebug('[AppRouter.initState] postFrame init failed: $e');
      }
    });
  }

  /// ONBOARDING-AUDIT 2026-08-14 P0-4: react to a 401 from the server.
  /// Drop the in-progress pickup draft (it belonged to the dead
  /// session), call `logout()` to clear credentials, route to the
  /// phone-entry screen, and show a snackbar so the rider isn't left
  /// wondering why they were signed out.
  void _handleSessionExpired() {
    if (!mounted) return;
    // Drop any in-progress pickup draft from the dead session.
    if (hasPickupDraft) clearPickupDraft();
    // Clear credentials + cached rider. logout() resets the rider
    // state to a fresh const RiderState (which also clears
    // lastSessionExpiredAt so the listener doesn't re-fire).
    ProviderScope.containerOf(context).read(riderProvider.notifier).logout();
    setState(() {
      _currentState = AuthState.login;
      _isOnboarding = false;
    });
    CacheService().setString('voltium_saved_auth_state', AuthState.login.name);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Toast.info(
        context,
        AppLocalizations.of(context)?.txtsessionExpiredPleaseLogIn ??
            'Your session expired. Please log in again to continue.',
      );
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
    final rState = ref.read(riderProvider);
    final rNotif = ref.read(riderProvider.notifier);

    switch (state) {
      case AppLifecycleState.resumed:
        _checkPermissionsOnResume();
        // R11 — polling lifecycle (active/inactive cadence + location-sync
        // timer) is now owned by `RiderNotifier` itself. The router only
        // triggers a manual refresh + wallet refresh + permission re-check
        // on resume.
        rNotif.refreshFromApi();
        if (rState.riderId != null) {
          ref.read(walletProvider.notifier).refreshTransactions(
                riderId: rState.riderId!,
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
    await ref.read(devicePolicyProvider.notifier).checkSystemPermissions();
    if (!mounted) return;
    final allRequiredGranted = await _areAllRequiredPermissionsGranted();
    // DEEP-AUDIT D-P1-4: the "skip permissions re-check" set is
    // intentionally NOT the full unauthenticated-gate set. AuthState.login
    // is pre-OTP but post-pre-auth: if a permission was revoked while
    // the rider was on the phone-entry screen, the rider must be bounced
    // to the permissions wall so the next lifecycle step (OTP -> KYC)
    // can run. AuthState.otp is exempt because the OTP screen is
    // critical-path: an in-flight OTP verification must not be
    // interrupted by a permissions redirect.
    final skipPermissionsRedirect = _currentState == AuthState.splash ||
        _currentState == AuthState.permissions ||
        _currentState == AuthState.legal ||
        _currentState == AuthState.otp;
    if (!allRequiredGranted && !skipPermissionsRedirect) {
      _navigateToLocal(AuthState.permissions);
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    final riderProv = ref.watch(riderProvider);
    final rider = riderProv.rider;

    final isUnauthenticatedState = _currentState.isUnauthenticatedGate;

    if (rider != null && !isUnauthenticatedState) {
      final r = rider;

      // PR-7 (PICKUP P0-2): once the pickup is actually done (verified
      // server-side, e.g. admin marked it or sync succeeded on another
      // path), any persisted draft is stale — drop it so a cold start
      // never resumes a completed pickup.
      if (r.pickupDone == true && hasPickupDraft) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) clearPickupDraft();
        });
      }

      // Delegate lifecycle routing to RiderLifecycleGate
      final correctState =
          _lifecycleTargetToAuthState(RiderLifecycleGate.redirect(r));

      // Check if current state matches correctState, except when inside sub-flow screens of that phase.
      // DEEP-AUDIT D-P1-4: the sub-screen allow-list is now the
      // `isPreDashboardOrSub` extension on AuthState (auth_state_group.dart).
      // Single source of truth — adding a new preDashboard sub-screen is
      // one line in the extension, not one in this if/else.
      //
      // PR-ONBOARDING-FLOW-2026-08-12: the bounce-protection now
      // covers every active-path sub-flow (choosePlan, depositWorkflow,
      // planSuccess, pickupHub, pickupVerification, hangTight) — the
      // pre-dashboard special-case is removed because the active path
      // no longer routes through preDashboard.
      bool stateMatches = _currentState == correctState;
      if (!stateMatches && correctState.isPreDashboardOrSub) {
        stateMatches = _currentState.isPreDashboardOrSub;
      }

      if (!stateMatches) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            setState(() {
              _currentState = correctState;
              // PR-ONBOARDING-FLOW-2026-08-13: derive _isOnboarding
              // from the rider's lifecycle (see _computeIsOnboarding).
              // The old heuristic (any state != dashboard) is correct
              // for most cases but misses the suspended rider on a
              // non-dashboard state — the lifecycle-based check
              // handles that edge case.
              _isOnboarding = _computeIsOnboarding(correctState);
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
          // Logged out (or session expired): a pickup draft belongs to the
          // previous session — drop it so the next login starts clean.
          if (hasPickupDraft) clearPickupDraft();
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
      // PR-ONBOARDING-FLOW-2026-08-13: derive _isOnboarding from the
      // rider's lifecycle, not the destination state. The old
      // heuristic only flipped the flag on preDashboard, which the
      // new active path never visits — so a rider on topUpAmount
      // (deposit step) had _isOnboarding = false and the system back
      // button fell through to the dashboard. The lifecycle is the
      // source of truth: rank < 11 = onboarding, regardless of which
      // sub-screen the rider is currently on.
      _isOnboarding = _computeIsOnboarding(nextState);
    });

    if (nextState != AuthState.splash) {
      CacheService().setString('voltium_saved_auth_state', nextState.name);
    }
  }

  /// PR-ONBOARDING-FLOW-2026-08-13: compute whether the rider is in
  /// the onboarding flow. A rider is onboarding when their lifecycle
  /// gate target is anything other than dashboard, terminated, or
  /// suspended — this covers every step in the new active path
  /// (intent → userForm → guarantorForm → choosePlan → topUpAmount →
  /// topUpProof → topUpReceipt → planSuccess → pickupHub →
  /// pickupVerification → hangTight).
  ///
  /// ONBOARDING-AUDIT 2026-08-14 P2-3: the audit suggested reusing
  /// `RiderLifecycleGate.isOnboarding(rider)`. We intentionally do
  /// NOT use that helper here: it enumerates specific targets
  /// (`intent || guarantorForm || choosePlan || ...`), which is
  /// brittle — a new `LifecycleTarget` added in the future would
  /// silently fall through to "not onboarding" until someone
  /// remembers to update the gate's enum. This router helper is the
  /// inverse — any non-terminal target is onboarding — so adding a
  /// new target is safe by default.
  bool _computeIsOnboarding(AuthState destination) {
    // Terminal states are never onboarding.
    if (destination == AuthState.dashboard ||
        destination == AuthState.accountClosed) {
      return false;
    }
    // Pre-auth gate states (splash / legal / permissions / login /
    // otp) are pre-onboarding — the rider hasn't been classified
    // yet. Treat them as not-onboarding so the top-up flow's
    // back-button logic (which branches on _isOnboarding) doesn't
    // misroute a rider who hasn't started the active path.
    if (destination.isUnauthenticatedGate) return false;
    // The lifecycle is the source of truth for whether the rider
    // has completed onboarding. If the rider is rank 11+ (active)
    // or terminal, they have completed onboarding regardless of
    // which sub-screen the router is currently showing.
    final rider = ref.read(riderProvider).rider;
    if (rider == null) {
      // No rider data yet — the splash / login / otp flow will
      // populate it. Default to false (the conservative choice for
      // a fresh session).
      return false;
    }
    final target = RiderLifecycleGate.redirect(rider);
    return target != LifecycleTarget.dashboard &&
        target != LifecycleTarget.terminated &&
        target != LifecycleTarget.suspended;
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
    // PR-PICKUP-OTP: server-issued verify-phone receipt from the hub screen.
    String? emergencyContactReceipt,
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
      // PR-PICKUP-OTP: preserve the stored receipt when the incoming value
      // is empty — on a resume the hub form cannot forward the signed token
      // (it restores the marker, not the receipt), so a null here must not
      // wipe the proof the verification screen will submit with. The
      // cleanup below still drops it when the rider edited the contact.
      _pickupEmergencyContactReceipt = (emergencyContactReceipt != null &&
              emergencyContactReceipt.isNotEmpty)
          ? emergencyContactReceipt
          : _pickupEmergencyContactReceipt;

      // PR-PICKUP-OTP: the rider may have edited the contact since verifying
      // — a receipt for a different number must not linger in the blob
      // (otherwise it would look verified on a later resume). The screen's
      // local flags are reset on edit; mirror that here for the persisted
      // marker AND the signed receipt so the draft stays self-consistent.
      final cleanContact =
          (emergencyContact ?? '').replaceAll(RegExp(r'\D'), '');
      final cleanVerified = (_pickupEmergencyContactVerifiedPhone ?? '')
          .replaceAll(RegExp(r'\D'), '');
      if (cleanVerified.isNotEmpty && cleanContact != cleanVerified) {
        _pickupEmergencyContactVerifiedPhone = null;
        _pickupEmergencyContactVerifiedAt = null;
        _pickupEmergencyContactReceipt = null;
      }
    });
    // PR-7 (PICKUP P0-2): persist so the rider resumes mid-flow after kill.
    _persistPickupDraft();
  }

  AuthState _lifecycleTargetToAuthState(LifecycleTarget target) {
    switch (target) {
      case LifecycleTarget.intent:
        return AuthState.intent;
      case LifecycleTarget.guarantorForm:
        return AuthState.guarantorForm;
      // PR-ONBOARDING-FLOW-2026-08-13: new active-path steps in the
      // linear flow guarantor → plan → enter amount → proof → receipt
      // → plan-success → pickup → hangTight. The active-path redirect
      // now maps every rank 3-9 to a specific step instead of falling
      // through to preDashboard.
      case LifecycleTarget.choosePlan:
        return AuthState.choosePlan;
      case LifecycleTarget.topUpAmount:
        return AuthState.topUpAmount;
      case LifecycleTarget.planSuccess:
        return AuthState.planSuccess;
      case LifecycleTarget.pickupHub:
        return AuthState.pickupHub;
      case LifecycleTarget.pickupVerification:
        return AuthState.pickupVerification;
      case LifecycleTarget.preDashboard:
        // PR-ONBOARDING-FLOW-2026-08-12: the active-path redirect no
        // longer returns preDashboard. The mapping is preserved here
        // so the older flow remains reachable from admin tooling and
        // from the suspended case below.
        return AuthState.preDashboard;
      // PR-ONBOARDING-FLOW-2026-08-11: post-pickup, pre-activation wait
      // state. The lifecycle gate returns hangTight for rank 10 with
      // !pickupDone; the screen polls the rider provider and auto-
      // redirects to the dashboard when the rider becomes active.
      case LifecycleTarget.hangTight:
        return AuthState.hangTight;
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
      case AuthState.splash:
      case AuthState.kycPreflight:
      case AuthState.legal:
      case AuthState.permissions:
      case AuthState.otp:
      // PR-ONBOARDING-FLOW-2026-08-12: intent is the first step of
      // the active path — there is no previous active-path step to
      // go back to. Making it non-popable prevents the rider from
      // bouncing into a stale surface.
      case AuthState.intent:
      case AuthState.userForm:
      case AuthState.guarantorForm:
      case AuthState.choosePlan:
      case AuthState.planSuccess:
      case AuthState.pickupHub:
      case AuthState.pickupVerification:
      case AuthState.hangTight:
      case AuthState.topUpAmount:
      case AuthState.topUpUpi:
      case AuthState.topUpProof:
      case AuthState.topUpReceipt:
      case AuthState.tlDetails:
      case AuthState.rentalDetails:
      case AuthState.endRental:
      case AuthState.faq:
      case AuthState.vehiclePhotos:
      case AuthState.referralDetails:
      case AuthState.legalPage:
      case AuthState.myDocuments:
      case AuthState.accountClosed:
        // Account-closed is terminal: do not allow back navigation to
        // a pre-onboarding screen, which would let the rider re-enter
        // onboarding with a closed account.
        //
        // PR-ONBOARDING-FLOW-2026-08-11: hangTight is non-popable in
        // the active path — the rider submitted the pickup form and
        // cannot un-submit it via the system back button. The only
        // forward path is admin activation, which the screen polls for.
        return false;
      default:
        return true;
    }
  }

  void _handleSystemBack() {
    switch (_currentState) {
      case AuthState.splash:
        break;
      case AuthState.kycPreflight:
        break;
      case AuthState.legal:
        _navigateToLocal(AuthState.kycPreflight);
        break;
      case AuthState.permissions:
        _navigateToLocal(AuthState.legal);
        break;
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
        // PR-ONBOARDING-FLOW-2026-08-12: system back from plan
        // selection goes to the guarantor form (the previous step
        // in the active path), not the archived pre-dashboard.
        _navigateToLocal(AuthState.guarantorForm);
        break;
      case AuthState.pickupHub:
        // PR-ONBOARDING-FLOW-2026-08-13: system back from the
        // pickup hub goes to the deposit proof screen (the previous
        // step in the active path), not planSuccess. The rider
        // skips planSuccess after submitting the deposit proof, so
        // the back chain follows the actual active path order:
        // choosePlan → topUpAmount → topUpProof → pickupHub.
        _navigateToLocal(AuthState.topUpProof);
        break;
      case AuthState.pickupVerification:
        _navigateToLocal(AuthState.pickupHub);
        break;
      case AuthState.topUpAmount:
        // PR-ONBOARDING-FLOW-2026-08-13: back from the Enter Amount
        // screen returns to plan selection (the previous step in the
        // active path), not the archived pre-dashboard. The dashboard
        // top-up flow still returns to the dashboard.
        _navigateToLocal(
            _isOnboarding ? AuthState.choosePlan : AuthState.dashboard);
        break;
      case AuthState.topUpUpi:
      case AuthState.topUpProof:
        _navigateToLocal(AuthState.topUpAmount);
        break;

      case AuthState.topUpReceipt:
        // PR-ONBOARDING-FLOW-2026-08-13: back from the receipt goes
        // to the proof screen (the previous step in the top-up
        // flow), not the archived pre-dashboard. The rider can
        // re-upload a different proof if needed. The dashboard
        // top-up flow returns to the proof screen too — there's no
        // "back to dashboard" path from the receipt on system back.
        _navigateToLocal(AuthState.topUpProof);
        break;
      // PR-3 (2026-08-07 master fix plan): the system back from
      // rentalDetails returns to the dashboard. The screen is
      // lifecycle-aware, so an admin suspend mid-screen will route
      // the rider to accountClosed (or similar) automatically.
      case AuthState.rentalDetails:
        _navigateToLocal(AuthState.dashboard);
        break;
      case AuthState.endRental:
        _navigateToLocal(AuthState.dashboard);
        break;
      case AuthState.faq:
        _navigateToLocal(AuthState.dashboard);
        break;
      case AuthState.vehiclePhotos:
        _navigateToLocal(AuthState.dashboard);
        break;
      case AuthState.tlDetails:
        _navigateToLocal(AuthState.dashboard);
        break;
      case AuthState.referralDetails:
        _navigateToLocal(AuthState.dashboard);
        break;
      case AuthState.legalPage:
        _navigateToLocal(AuthState.legal);
        break;
      case AuthState.myDocuments:
        _navigateToLocal(AuthState.dashboard);
        break;
      default:
        break;
    }
  }

  @override
  Widget build(BuildContext context) {
    // ONBOARDING-AUDIT 2026-08-14 P0-4: watch the rider state's
    // `lastSessionExpiredAt` field. When the server returns 401
    // during a profile refresh, the notifier stamps a timestamp;
    // we route the rider to the login screen, drop the pickup draft
    // (it belonged to the dead session), and surface a friendly
    // snackbar explaining why they were signed out. The flag is
    // cleared in `init()` and `logout()` so a fresh login never
    // re-fires this handler. `ref.listen` here is the canonical
    // Riverpod 3 location (must be inside the build phase).
    ref.listen<int?>(
      riderProvider.select((s) => s.lastSessionExpiredAt),
      (previous, next) {
        if (next == null || next == previous) return;
        _handleSessionExpired();
      },
    );
    return _buildRouterBody(context, this);
  }

  Widget childScreenWrapper(Widget child) => child;
}
