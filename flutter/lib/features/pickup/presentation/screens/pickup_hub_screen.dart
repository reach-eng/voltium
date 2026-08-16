import 'package:universal_io/io.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:image_picker/image_picker.dart';

import 'package:voltium_rider/models/hub_model.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_client.dart';
import 'package:voltium_rider/core/network/generated/api_models.dart';
import 'package:voltium_rider/features/guarantor/domain/form_validator.dart';
import 'package:voltium_rider/services/voltium_api_service.dart';
import 'package:voltium_rider/services/image_compression_service.dart';
import 'package:voltium_rider/services/document_local_cache.dart';
import 'package:voltium_rider/features/pickup/widgets/pickup_hub_widgets.dart';
import 'package:voltium_rider/features/pickup/widgets/pickup_vehicle_search_sheet.dart';
import 'package:voltium_rider/features/pickup/presentation/widgets/pickup_widgets.dart';
import '../../../../theme/app_theme.dart';

import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_typography.dart';

class PickupHubScreen extends ConsumerStatefulWidget {
  final Function(
    String hubId,
    String vehicleId,
    String? teamLeader,
    String emergencyContact,
    String? pickupPhotoFront,
    String? pickupPhotoBack,
    String? pickupPhotoLeft,
    String? pickupPhotoRight,
    String? pickupPhotoWithVehicle, {
    // PR-PICKUP-OTP: server-issued verify-phone receipt forwarded to the
    // verification screen → syncPickup so the server can enforce the
    // emergency-contact OTP gate (signature + TTL + phone match).
    String? emergencyContactReceipt,
  }) onNext;
  final VoidCallback? onBack;

  // PR-7 (PICKUP P0-2): restored draft values so a rider killed mid-form
  // resumes with hub/vehicle/contact/photo selections intact. The router
  // re-validates hub+vehicle availability against the API before landing
  // here; the screen additionally only re-applies the vehicle selection
  // when it is still AVAILABLE in the freshly fetched list.
  final String? initialHubId;
  final String? initialVehicleId;
  final String? initialTeamLeader;
  final String? initialEmergencyContact;

  // PR-PICKUP-OTP: the persisted emergency-contact OTP receipt (phone +
  // epoch-ms of verification). Restored only when the receipt is still
  // inside the short validity window AND the phone matches the restored
  // contact — otherwise the rider re-verifies like a fresh session.
  final String? initialEmergencyContactVerifiedPhone;
  final int? initialEmergencyContactVerifiedAt;

  /// Fired on server-confirmed OTP verification so the router can persist
  /// the short-lived receipt into the pickup draft (survives app kill).
  /// The signed server receipt is forwarded with the phone so the marker
  /// and the receipt are persisted atomically (they must never diverge).
  final void Function(String phone, String? receipt)?
      onEmergencyContactVerified;

  final Map<String, String?> initialPhotos;

  const PickupHubScreen({
    super.key,
    required this.onNext,
    this.onBack,
    this.initialHubId,
    this.initialVehicleId,
    this.initialTeamLeader,
    this.initialEmergencyContact,
    this.initialEmergencyContactVerifiedPhone,
    this.initialEmergencyContactVerifiedAt,
    this.onEmergencyContactVerified,
    this.initialPhotos = const {},
  });

  @override
  ConsumerState<PickupHubScreen> createState() => _PickupHubScreenState();
}

class _PickupHubScreenState extends ConsumerState<PickupHubScreen>
    with WidgetsBindingObserver {
  final ImageCompressionService _compressionService = ImageCompressionService();
  List<HubModel> _hubs = [];
  bool _isLoading = true;
  String? _error;
  String? _selectedHubId;
  String? _selectedTeamLeader;

  // Vehicle dropdown state
  List<Map<String, dynamic>> _vehicles = [];
  bool _isLoadingVehicles = false;
  String? _selectedVehicleId;
  String? _selectedVehicleLabel;

  final _emergencyContactController = TextEditingController();
  final _otpController = TextEditingController();

  bool _isOtpSent = false;
  bool _isOtpVerified = false;
  bool _isSendingOtp = false;
  bool _isVerifyingOtp = false;

  // PR-ONBOARDING-2026-08-11 (audit 2.2): double-tap guard for FINISH SETUP.
  // The previous implementation only checked `_canProceedCurrentStep` (form
  // state); a rapid double-tap on the bottom button fired `widget.onNext`
  // twice and the router received two consecutive `updatePickupData` calls.
  bool _isSubmitting = false;

  // PR-ONBOARDING-2026-08-11 (audit 2.5): live team-leader list for the
  // selected hub. `null` means "not yet fetched" and the widget falls back
  // to the legacy `kPickupTeamLeaderOptions` const so the screen renders
  // before the network call returns.
  List<String>? _teamLeaderOptions;

  // PR-PICKUP-OTP: the short-lived HMAC receipt returned by verify-phone on
  // success. Forwarded with the pickup submit; the server validates it.
  String? _emergencyContactReceipt;

  // Photo uploads
  final Map<String, PhotoUploadEntry> _photos = {
    'front': PhotoUploadEntry(),
    'back': PhotoUploadEntry(),
    'left': PhotoUploadEntry(),
    'right': PhotoUploadEntry(),
    'with_vehicle': PhotoUploadEntry(),
  };

  int _currentStep = 1;

  // PR-ONBOARDING-FLOW-2026-08-13: auto-retry for `_fetchHubs` /
  // `_fetchVehicles` on transient network errors. The previous
  // implementation surfaced a one-shot error to the rider on the
  // first failed call — a rider on a flaky network (e.g. a
  // metro station with intermittent coverage) saw a permanent
  // "Connection error" after one timeout even though the next
  // retry would have succeeded. Now: 3 attempts with exponential
  // backoff (1s, 2s, 4s) before the manual retry button is shown.
  // 4xx responses (auth, validation) are NOT retried — they need
  // a real fix, not a retry.
  int _hubRetryAttempt = 0;
  int _vehicleRetryAttempt = 0;
  static const int _maxHubRetries = 3;

  // PR-7 (PICKUP P0-2): one-shot flags — the restored draft is applied at
  // most once. `_fetchHubs` also runs on resume-refresh / pull-to-refresh,
  // and without the guard those refetches would re-apply the draft and
  // override hub/contact/photos/step choices the rider has since changed.
  bool _initialDraftApplied = false;

  // The vehicle portion is additionally gated so a later refetch can never
  // override a vehicle the rider picked themselves.
  bool _initialVehicleApplied = false;

  Widget _buildStepIndicator() {
    return Padding(
      padding: const EdgeInsets.only(bottom: 20, top: 16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          _buildDot(1),
          _buildLine(),
          _buildDot(2),
        ],
      ),
    );
  }

  Widget _buildDot(int step) {
    final isActive = _currentStep >= step;
    return Container(
      width: 24,
      height: 24,
      decoration: BoxDecoration(
        shape: BoxShape.circle,
        color:
            isActive ? AppColors.primary : AppColors.of(context).surfaceSubtle,
        border: isActive
            ? null
            : Border.all(color: AppColors.of(context).borderSubtle),
      ),
      alignment: Alignment.center,
      child: Text(
        '$step',
        style: AppTypography.bodySmall
            .copyWith(fontWeight: FontWeight.w600)
            .copyWith(
                color: isActive ? Colors.white : AppColors.onSurfaceVariant),
      ),
    );
  }

  Widget _buildLine() {
    return Container(
      width: 40,
      height: 2,
      color: AppColors.of(context).borderSubtle,
    );
  }

  bool get _canProceedCurrentStep {
    if (_currentStep == 1) {
      return _selectedHubId != null &&
          _selectedTeamLeader != null &&
          _selectedVehicleId != null &&
          _isOtpVerified;
    } else {
      // DEBUG-FIX-2026-08-13: step 2's enable check now matches
      // `_isFormValid` exactly. The previous DEBUG-FIX-2026-08-12
      // added `_isOtpVerified` to step 2's check, but the button still
      // went blue whenever all 5 photos were uploaded even if hub /
      // team leader / vehicle were missing (e.g. a draft restore that
      // had photos + OTP receipt but the step-1 fields were cleared or
      // never persisted). The submit guard in `_submitForm` requires
      // all 5 fields, so the button blue-then-no-op'd. Symmetrising
      // the two checks against the same `_isFormValid` contract kills
      // the dead button state — the rider sees a grey button + a
      // clear signal to re-fill the missing step-1 fields.
      return _isFormValid;
    }
  }

  void _onBottomButtonPressed() {
    if (_currentStep < 2) {
      setState(() {
        _currentStep++;
      });
    } else {
      _submitForm();
    }
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _emergencyContactController.dispose();
    _otpController.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _fetchHubs();
  }

  // Refresh-on-resume: hub availability can change while the app is
  // backgrounded (vehicles taken, hub hours changed).
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _fetchHubs();
    }
  }

  /// Wrapper invoked by the manual "Retry" button. Resets the auto-retry
  /// counter so the rider gets a fresh round of backoff attempts instead
  /// of immediately surfacing the last cached error.
  Future<void> _fetchHubsWithManualReset() async {
    _hubRetryAttempt = 0;
    await _fetchHubs();
  }

  Future<void> _fetchHubs() async {
    try {
      final response = await VoltiumApiService().fetchHubs();
      if (!mounted) return;
      if (response['success'] == true) {
        final List<dynamic> data = response['data'] ?? [];
        setState(() {
          _hubs = data
              .map((e) => HubModel.fromJson(e as Map<String, dynamic>))
              .toList();
          _isLoading = false;
          _hubRetryAttempt = 0; // success — reset retry counter
        });
        // PR-7 (PICKUP P0-2): re-apply the restored draft once hubs load.
        _applyInitialDraft();
      } else {
        setState(() {
          _error = response['message'] ?? 'Failed to load hubs';
          _isLoading = false;
        });
      }
    } catch (e) {
      if (!mounted) return;
      // PR-ONBOARDING-FLOW-2026-08-13: 4xx responses are real failures
      // (validation, auth) — surface them. Transient errors (network
      // down, timeout) are retried with exponential backoff up to
      // _maxHubRetries before falling back to the manual retry button.
      if (e is ApiException && e.statusCode < 500) {
        setState(() {
          _error = e.message;
          _isLoading = false;
        });
        return;
      }
      if (_hubRetryAttempt >= _maxHubRetries) {
        setState(() {
          _error = e is ApiException ? e.message : 'Connection error: $e';
          _isLoading = false;
        });
        return;
      }
      final delay = Duration(seconds: 1 << _hubRetryAttempt); // 1s, 2s, 4s
      _hubRetryAttempt += 1;
      // Keep _isLoading = true so the rider sees a spinner, not a
      // blank screen, while the retry timer is running. The timer
      // itself is not bound to the widget lifecycle (Timer would
      // continue firing after dispose); a Future.delayed inside an
      // async method is cancelled the moment the awaiter returns.
      await Future.delayed(delay);
      if (!mounted) return;
      await _fetchHubs();
    }
  }

  /// PR-7 (PICKUP P0-2): apply the router-restored draft once hubs load.
  /// The router re-validated hub+vehicle availability against the API before
  /// resuming; this only wires the values into the form. Defensive guards:
  /// the team leader must be one of the fixed dropdown options (a draft from
  /// an older app version must never crash the dropdown) and photos only
  /// restore when the entry slot exists.
  void _applyInitialDraft() {
    if (!mounted || _initialDraftApplied) return;
    final hubId = widget.initialHubId;
    if (hubId == null) return;

    final hubStillExists = _hubs.any((h) => h.id == hubId);
    if (!hubStillExists) {
      // Defensive fallback — the router already re-validated the hub against
      // the API, so a missing hub means the draft is stale. Mark applied so
      // later refetches don't keep probing for it.
      _initialDraftApplied = true;
      return;
    }

    // Mark applied BEFORE applying so a re-entrant fetch can never double-
    // apply the draft.
    _initialDraftApplied = true;
    setState(() {
      _selectedHubId = hubId;

      final teamLeader = widget.initialTeamLeader;
      // PR-ONBOARDING-2026-08-11 (audit 2.5): accept the restored team
      // leader even if it is not in the legacy hardcoded list — the live
      // list may have grown since the draft was saved. We just need the
      // string to be non-empty; the dropdown will surface it.
      if (teamLeader != null && teamLeader.isNotEmpty) {
        _selectedTeamLeader = teamLeader;
      }

      final contact = widget.initialEmergencyContact;
      if (contact != null && contact.isNotEmpty) {
        _emergencyContactController.text = contact;
      }

      // PR-PICKUP-OTP: restore the OTP-verified state from the persisted
      // receipt — but ONLY while the receipt is still inside the short
      // validity window AND it was issued for this exact contact (shared
      // freshness rule on AppConstants). Any other case (expired, different
      // number, or no receipt) leaves the rider to re-verify exactly as a
      // fresh session would, so the security posture is unchanged: the
      // server OTP is single-use and the client proof simply expires.
      if (AppConstants.isEmergencyContactVerificationFresh(
        verifiedPhone: widget.initialEmergencyContactVerifiedPhone,
        contact: contact,
        verifiedAt: widget.initialEmergencyContactVerifiedAt,
      )) {
        _isOtpSent = true;
        _isOtpVerified = true;
      }

      // Restore photo URLs so step 2 is not empty after a resume.
      widget.initialPhotos.forEach((key, url) {
        if (url != null && url.isNotEmpty && _photos.containsKey(key)) {
          _photos[key]!.photoUrl = url;
        }
      });

      // Jump straight to the photo step when the hub form was already fully
      // completed before the kill. The full `_isFormValid` check is
      // required (not just OTP + photos): a draft restored with hub +
      // photos but no team leader / vehicle would otherwise land the
      // rider on step 2 with a dead grey button (step 2's enable check
      // now matches `_isFormValid` per DEBUG-FIX-2026-08-13). Keeping
      // the rider on step 1 in that case lets them re-fill the missing
      // step-1 fields before proceeding.
      if (_isFormValid && _photos.values.every((p) => p.photoUrl != null)) {
        _currentStep = 2;
      }
    });

    if (widget.initialVehicleId != null) {
      _fetchVehicles(hubId);
    }
  }

  String _vehicleLabel(Map<String, dynamic> v) {
    final number =
        v['vehicleNumber'] as String? ?? v['licensePlate'] as String? ?? '';
    final model = v['model'] as String? ?? '';
    return '$number${model.isNotEmpty ? ' • $model' : ''}';
  }

  Future<void> _fetchVehicles(String hubId) async {
    setState(() {
      _isLoadingVehicles = true;
      _vehicles = [];
      _selectedVehicleId = null;
      _selectedVehicleLabel = null;
    });
    try {
      final response = await VoltiumApiService().fetchVehicles(hubId);
      if (!mounted) return;
      // The API wraps the response in { success, data }. The data may
      // be a list directly (GET /api/vehicles) or nested under a key.
      final data = response['data'];
      final rawList = data is List
          ? data
          : (data is Map ? data['vehicles'] : response['vehicles']);
      final list = (rawList as List<dynamic>?) ?? [];
      setState(() {
        _vehicles = list
            .map((v) => v as Map<String, dynamic>)
            .where((v) => v['status'] == 'AVAILABLE')
            .toList();
      });
      // PR-7 (PICKUP P0-2): re-apply the restored vehicle selection once,
      // and only if the rider is still on the restored hub AND the vehicle
      // is still AVAILABLE in the freshly fetched list. The one-shot flag
      // means later refetches can never override a vehicle the rider has
      // since picked themselves.
      final restoredId = widget.initialVehicleId;
      final stillOnRestoredHub =
          widget.initialHubId != null && _selectedHubId == widget.initialHubId;
      if (!_initialVehicleApplied &&
          restoredId != null &&
          stillOnRestoredHub &&
          _selectedVehicleId == null) {
        final match = _vehicles.where((v) => v['id'] == restoredId).toList();
        if (match.isNotEmpty && mounted) {
          setState(() {
            _selectedVehicleId = restoredId;
            _selectedVehicleLabel = _vehicleLabel(match.first);
          });
          _initialVehicleApplied = true;
          // PR-AUDIT-FIX 2026-08-12: vehicle is the LAST field restored
          // for a draft (the form needs hubs → team leader → vehicle →
          // OTP → photos to be `_isFormValid`). At the time
          // `_applyInitialDraft` ran, the vehicle list was empty so the
          // step-2 jump was skipped. Now that the vehicle is applied
          // AND the rest of the draft is still in place, advance to
          // step 2 — otherwise the rider is stranded on step 1 with a
          // completed form (no "NEXT" to tap, no "FINISH SETUP" to
          // confirm).
          if (_currentStep == 1 && _isFormValid) {
            _currentStep = 2;
          }
        } else if (mounted) {
          // Restored vehicle is no longer available — mark applied so a
          // later refetch doesn't keep probing for it.
          _initialVehicleApplied = true;
        }
      }
    } catch (e) {
      // PR-ONBOARDING-FLOW-2026-08-13: 4xx responses are real failures
      // (validation, auth) — surface them. Transient errors get
      // up to 3 retries with exponential backoff (1s, 2s, 4s) before
      // the rider sees the error toast. The retry counter is scoped
      // to the hubs fetch above; vehicle fetch is best-effort
      // (the dropdown falls back to a list with "Not assigned")
      // so we keep the surface minimal here.
      if (e is ApiException && e.statusCode < 500) {
        _showError('Failed to fetch vehicles: $e');
        return;
      }
      if (_vehicleRetryAttempt >= _maxHubRetries) {
        _showError('Failed to fetch vehicles: $e');
        return;
      }
      _vehicleRetryAttempt += 1;
      await Future.delayed(Duration(seconds: 1 << (_vehicleRetryAttempt - 1)));
      if (!mounted) return;
      await _fetchVehicles(hubId);
    } finally {
      if (mounted) setState(() => _isLoadingVehicles = false);
    }
  }

  // PR-ONBOARDING-2026-08-11 (audit 2.5): live team-leader fetch per hub.
  // Replaces the hardcoded 3-entry `kPickupTeamLeaderOptions` const. On
  // network failure, the dropdown stays on the legacy fallback (passing
  // `null` to AssignmentDetailsCard). The list is also appended with
  // "Not assigned" so a rider can opt out of a TL match.
  Future<void> _fetchTeamLeaders(String hubId) async {
    try {
      final rows = await VoltiumApiService().fetchTeamLeaders(hubId);
      if (!mounted) return;
      final names = rows
          .map((t) => (t['name'] as String?)?.trim() ?? '')
          .where((n) => n.isNotEmpty)
          .toSet()
          .toList()
        ..sort();
      if (names.isNotEmpty) {
        // Don't add "Not assigned" if it's already in the list.
        if (!names.contains('Not assigned')) names.add('Not assigned');
      }
      setState(() => _teamLeaderOptions = names.isEmpty ? null : names);
    } catch (_) {
      // Keep the legacy fallback. The dropdown widget will use
      // kPickupTeamLeaderOptions when `_teamLeaderOptions` is null.
      if (mounted) setState(() => _teamLeaderOptions = null);
    }
  }

  void _showVehicleSearchSheet() {
    if (_vehicles.isEmpty) return;
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (ctx) => VehicleSearchSheet(
        vehicles: _vehicles,
        selectedId: _selectedVehicleId,
        onSelected: (id, label) {
          setState(() {
            _selectedVehicleId = id;
            _selectedVehicleLabel = label;
          });
        },
      ),
    );
  }

  // ── Toasts ─────────────────────────────────────────────────────────────────
  void _showError(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(
              Icons.error_outline_rounded,
              color: Colors.white,
              size: 18,
            ),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                msg,
                style: AppTypography.bodyMedium
                    .copyWith(fontSize: 13, fontWeight: FontWeight.w600)
                    .copyWith(color: Colors.white),
              ),
            ),
          ],
        ),
        backgroundColor: AppColors.error,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md)),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  void _showSuccess(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).clearSnackBars();
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Row(
          children: [
            const Icon(
              Icons.check_circle_outline_rounded,
              color: Colors.white,
              size: 18,
            ),
            SizedBox(width: 10),
            Expanded(
              child: Text(
                msg,
                style: AppTypography.bodyMedium
                    .copyWith(fontSize: 13, fontWeight: FontWeight.w600)
                    .copyWith(color: Colors.white),
              ),
            ),
          ],
        ),
        backgroundColor: AppColors.success,
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.md)),
        margin: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
        duration: const Duration(seconds: 3),
      ),
    );
  }

  Future<void> _sendEmergencyOtp() async {
    final phone = _emergencyContactController.text;
    final digits = phone.replaceAll(RegExp(r'\D'), '');

    if (digits.length != 10) {
      _showError('Enter a valid 10-digit number');
      return;
    }

    final riderPhone = ref.watch(riderProvider).rider?.phone ?? '';
    final guarantorPhone = ref.watch(riderProvider).rider?.guarantorPhone ?? '';

    if (digits == riderPhone) {
      _showError('Emergency contact cannot be the same as your phone number');
      return;
    }
    if (digits == guarantorPhone) {
      _showError(
        'Emergency contact cannot be the same as guarantor phone number',
      );
      return;
    }

    setState(() {
      _isSendingOtp = true;
    });

    try {
      final client = ApiClient();
      final res = await VoltiumApiClient(client)
          .postAuthSendOtp(SendOtpRequest(phone: digits));
      final response = res.toJson();
      if (!mounted) return;
      setState(() {
        _isOtpSent = true;
        _isOtpVerified = false;
      });
      _showSuccess('OTP sent to emergency contact');
      if (AppConstants.isTestMode) {
        final testOtp =
            response['data'] is Map ? (response['data'] as Map)['otp'] : null;
        if (testOtp != null) {
          _otpController.text = testOtp.toString();
        }
      }
    } catch (e) {
      if (!mounted) return;
      _showError('Failed to send OTP. Please try again. $e');
    } finally {
      if (mounted) setState(() => _isSendingOtp = false);
    }
  }

  Future<void> _verifyEmergencyOtp() async {
    final phone =
        _emergencyContactController.text.replaceAll(RegExp(r'\D'), '');
    final otp = _otpController.text;

    if (otp.length != 6) {
      _showError('Enter 6-digit OTP');
      return;
    }

    setState(() => _isVerifyingOtp = true);

    try {
      final response = await VoltiumApiService().verifyPhone(
        phone: phone,
        otp: otp,
      );
      if (!mounted) return;
      // PR-ONBOARDING-2026-08-11 (audit 1.6): the previous code trusted any
      // 2xx response and flipped `_isOtpVerified = true`. A misconfigured
      // server (or a 2xx-with-`verified: false` body) could mark the
      // emergency contact verified without a real OTP. The guarantor
      // screen was fixed in audit #7 P0-2 to use
      // `verifyPhoneResponseVerified`; we propagate the same helper here.
      if (!verifyPhoneResponseVerified(response)) {
        final data = response['data'];
        final serverMessage = (data is Map ? data['message'] : null) ??
            response['message'] as String?;
        _showError(
          serverMessage?.isNotEmpty == true
              ? serverMessage!
              : 'Invalid OTP. Please try again.',
        );
        return;
      }
      setState(() => _isOtpVerified = true);
      // PR-PICKUP-OTP: capture the server-issued signed receipt so the
      // pickup submit can prove (server-side) that this number was OTP-
      // verified. ApiClient unwraps the `data` envelope, so the receipt is
      // flat (`response['receipt']`); the nested `response['data']` shape
      // is kept as a fallback for older servers. Falls back to null.
      final data = response['data'];
      final receipt = data is Map
          ? data['receipt'] as String?
          : response['receipt'] as String?;
      if (receipt != null && receipt.isNotEmpty) {
        _emergencyContactReceipt = receipt;
      }
      // PR-PICKUP-OTP: persist the short-lived verification receipt into
      // the pickup draft so a rider killed after this point resumes without
      // re-verifying (while the validity window is open). The signed
      // receipt rides the same persistence path as the marker so the two
      // can never diverge (a fresh marker without a receipt would show
      // "verified" but 403 on submit in enforced mode).
      widget.onEmergencyContactVerified?.call(phone, receipt);
      _showSuccess('Emergency contact verified successfully ✓');
    } catch (e) {
      if (!mounted) return;
      _showError('OTP verification failed. Please try again.');
    } finally {
      if (mounted) setState(() => _isVerifyingOtp = false);
    }
  }

  Future<void> _uploadImage(String type, bool useCamera) async {
    final source = useCamera ? ImageSource.camera : ImageSource.gallery;
    try {
      final compressed = await _compressionService.pickAndCompress(
        source: source,
        maxWidth: 1024,
        maxHeight: 1024,
        quality: 80,
      );

      if (compressed == null || !mounted) return;

      final entry = _photos[type]!;
      setState(() {
        entry.imagePath = compressed.path;
        entry.isUploading = true;
      });

      final url = await VoltiumApiService()
          .uploadFile(File(compressed.path), 'pickup_verification');
      if (!mounted) return;

      setState(() {
        entry.photoUrl = url;
        entry.isUploading = false;
      });
      DocumentLocalCache.save('pickup_$type', compressed.path);
      _showSuccess('Photo uploaded successfully');
    } catch (e) {
      if (mounted) {
        final entry = _photos[type]!;
        setState(() {
          entry.imagePath = null;
          entry.isUploading = false;
        });
        _showError(
          'Upload failed. Please check your connection and try again.',
        );
      }
    }
  }

  bool get _isFormValid {
    return _selectedHubId != null &&
        _selectedTeamLeader != null &&
        _selectedVehicleId != null &&
        _isOtpVerified &&
        _photos.values.every((p) => p.photoUrl != null);
  }

  void _submitForm() {
    if (!_isFormValid || _isSubmitting) return;
    setState(() => _isSubmitting = true);
    try {
      widget.onNext(
        _selectedHubId!,
        _selectedVehicleId!,
        _selectedTeamLeader,
        _emergencyContactController.text.replaceAll(RegExp(r'\\D'), ''),
        _photos['front']!.photoUrl,
        _photos['back']!.photoUrl,
        _photos['left']!.photoUrl,
        _photos['right']!.photoUrl,
        _photos['with_vehicle']!.photoUrl,
        emergencyContactReceipt: _emergencyContactReceipt,
      );
    } finally {
      // The router swaps screens on next frame, so the reset is mostly
      // defensive — but the screen can be re-mounted within a single frame
      // (e.g. on resume) and we must not leak the in-flight flag.
      if (mounted) setState(() => _isSubmitting = false);
    }
  }

  Widget _buildLoadingState(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      body: Center(
        child: CircularProgressIndicator(
          color: AppColors.primary,
        ),
      ),
    );
  }

  Widget _buildErrorState(BuildContext context) {
    final colors = AppColors.of(context);
    return Scaffold(
      backgroundColor: colors.surface,
      body: Center(
        child: Padding(
          padding: Spacing.paddingLg,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(
                Icons.error_outline_rounded,
                color: AppColors.error,
                size: 48,
              ),
              SizedBox(height: 16),
              Text(
                _error ?? 'An unexpected error occurred',
                textAlign: TextAlign.center,
                style:
                    AppTypography.bodyLarge.copyWith(color: colors.onSurface),
              ),
              SizedBox(height: 24),
              SizedBox(
                width: 140,
                height: 40,
                child: ElevatedButton(
                  onPressed: _fetchHubsWithManualReset,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppColors.primary,
                    foregroundColor: Colors.white,
                    elevation: 0,
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadius.md),
                    ),
                  ),
                  child: Text(
                    'Retry',
                    style: AppTypography.bodyMedium
                        .copyWith(fontWeight: FontWeight.w800),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    if (_isLoading) {
      return _buildLoadingState(context);
    }
    if (_error != null) {
      return _buildErrorState(context);
    }

    return Scaffold(
      backgroundColor: colors.surface,
      body: Column(
        children: [
          Expanded(
            child: RefreshIndicator(
              onRefresh: _fetchHubs,
              child: SingleChildScrollView(
                physics: const AlwaysScrollableScrollPhysics(),
                child: Column(
                  children: [
                    buildCurtainHeader(
                      context: context,
                      title: 'Pickup Verification',
                      subtitle:
                          'Complete the verification steps to assign and pick up your vehicle',
                      onBack: () {
                        if (_currentStep > 1) {
                          setState(() {
                            _currentStep--;
                          });
                        } else {
                          widget.onBack?.call();
                        }
                      },
                    ),
                    Transform.translate(
                      offset: const Offset(0, -32),
                      child: Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 16),
                        child: Column(
                          children: [
                            _buildStepIndicator(),
                            if (_currentStep == 1) ...[
                              AssignmentDetailsCard(
                                selectedHubId: _selectedHubId,
                                hubs: _hubs,
                                onHubChanged: (val) {
                                  setState(() {
                                    _selectedHubId = val;
                                    _selectedVehicleId = null;
                                    _selectedVehicleLabel = null;
                                    _selectedTeamLeader = null;
                                  });
                                  if (val != null) {
                                    // PR-ONBOARDING-FLOW-2026-08-13: a
                                    // hub change gets a fresh batch of
                                    // retries (the previous hub's
                                    // exhausted counter would otherwise
                                    // immediately bail on the new
                                    // hub's first call).
                                    _vehicleRetryAttempt = 0;
                                    _fetchVehicles(val);
                                    _fetchTeamLeaders(val);
                                  }
                                },
                                // PR-ONBOARDING-2026-08-11 (audit 2.5): pass the
                                // live team-leader list scoped to the selected
                                // hub. Falls back to the legacy hardcoded list
                                // when the endpoint is unavailable.
                                teamLeaderOptions: _teamLeaderOptions,
                                selectedTeamLeader: _selectedTeamLeader,
                                onTeamLeaderChanged: (val) =>
                                    setState(() => _selectedTeamLeader = val),
                                isHubSelected: _selectedHubId != null,
                                selectedVehicleId: _selectedVehicleId,
                                selectedVehicleLabel: _selectedVehicleLabel,
                                isLoadingVehicles: _isLoadingVehicles,
                                vehicleCount: _vehicles.length,
                                onVehicleTap: _showVehicleSearchSheet,
                                emergencyContactController:
                                    _emergencyContactController,
                                isOtpSent: _isOtpSent,
                                isOtpVerified: _isOtpVerified,
                                isSendingOtp: _isSendingOtp,
                                onSendOtp: _sendEmergencyOtp,
                                onEmergencyContactChanged: (val) {
                                  if (_isOtpSent) {
                                    setState(() => _isOtpSent = false);
                                  }
                                  if (_isOtpVerified) {
                                    setState(() => _isOtpVerified = false);
                                  }
                                  // PR-PICKUP-OTP: a receipt belongs to the
                                  // number it was issued for — editing the
                                  // contact invalidates it.
                                  if (_emergencyContactReceipt != null) {
                                    _emergencyContactReceipt = null;
                                  }
                                },
                                otpController: _otpController,
                                isVerifyingOtp: _isVerifyingOtp,
                                onVerifyOtp: _verifyEmergencyOtp,
                              ),
                            ],
                            if (_currentStep == 2) ...[
                              const SizedBox(height: 24),
                              VehicleConditionCard(
                                frontImagePath: _photos['front']!.imagePath,
                                frontPhotoUrl: _photos['front']!.photoUrl,
                                isUploadingFront: _photos['front']!.isUploading,
                                backImagePath: _photos['back']!.imagePath,
                                backPhotoUrl: _photos['back']!.photoUrl,
                                isUploadingBack: _photos['back']!.isUploading,
                                leftImagePath: _photos['left']!.imagePath,
                                leftPhotoUrl: _photos['left']!.photoUrl,
                                isUploadingLeft: _photos['left']!.isUploading,
                                rightImagePath: _photos['right']!.imagePath,
                                rightPhotoUrl: _photos['right']!.photoUrl,
                                isUploadingRight: _photos['right']!.isUploading,
                                withVehicleImagePath:
                                    _photos['with_vehicle']!.imagePath,
                                withVehiclePhotoUrl:
                                    _photos['with_vehicle']!.photoUrl,
                                isUploadingWithVehicle:
                                    _photos['with_vehicle']!.isUploading,
                                onUploadImage: _uploadImage,
                              ),
                            ],
                            const SizedBox(height: 140),
                          ],
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
          buildStickyBottomBar(
            context: context,
            isFormValid: _canProceedCurrentStep && !_isSubmitting,
            buttonText: _currentStep < 2 ? 'NEXT STEP' : 'FINISH SETUP',
            onSubmit: _onBottomButtonPressed,
          ),
        ],
      ),
    );
  }
}
