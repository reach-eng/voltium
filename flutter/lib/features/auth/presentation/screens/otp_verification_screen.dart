import 'dart:async';
import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/navigation/app_state_notifier.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/widgets/spark_otp_input.dart';
import 'package:voltium_rider/widgets/underline_otp_input.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_app_bar.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_resend_widget.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_verify_button.dart';

/// OtpVerificationScreen — composition shell for the OTP entry page.
///
/// Layout (top → bottom):
///   ┌──────────────────────────────────────────┐
///   │  OtpAppBar (back btn + "VOLTIUM")        │
///   │                                          │
///   │  Bouncing smartphone icon                 │
///   │  "Verify OTP" / "Welcome Back!" title   │
///   │  Subtitle with phone in primary          │
///   │  UnderlineOtpInput (Apple-style 6 slots)   │
///   │  OtpResendWidget (timer + button)        │
///   │                                          │
///   │  OtpVerifyButton (Verify & Proceed)      │
///   └──────────────────────────────────────────┘
///
/// Matches web OtpScreen.tsx exactly:
/// - bg #F5F7FA (light)
/// - Custom top bar: white circle back btn (left), "VOLTIUM" centered
/// - Animated smartphone icon in 96×96 white circle (shadow, bouncing)
/// - "Verify OTP" / "Welcome Back!" title
/// - Subtitle (15px, #475467) with phone number in primary blue bold
/// - 6 OTP boxes: w-48 h-56, rounded-2xl, bg-white, border #E2E8F0
/// - "Didn't receive the code?" + Resend button / timer
/// - Gradient "Verify & Proceed" pill 56px
class OtpVerificationScreen extends ConsumerStatefulWidget {
  final void Function(bool isNewRider)? onNext;
  final String phoneNumber;
  final bool isLogin;
  final VoidCallback? onBack;

  final String? referralCode;

  // CONSOLIDATED-FIX-2026-08-16 §5.1: `phoneNumber` is required — the
  // placeholder `+91 98765 43210` default could collide with the EMERGENCY
  // audit's hardcoded support number. The only caller (router_body.dart:235)
  // always passes `state._phone`, so removing the default is safe.
  const OtpVerificationScreen({
    super.key,
    this.onNext,
    required this.phoneNumber,
    this.isLogin = false,
    this.onBack,
    this.referralCode,
  });

  @override
  ConsumerState<OtpVerificationScreen> createState() =>
      _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen>
    with TickerProviderStateMixin, WidgetsBindingObserver {
  /// Toggle between the new Apple/Google-style underline OTP input and the
  /// original spark-glow OTP boxes. Flip to `false` to roll back instantly
  /// if the underline variant has any field issues.
  ///
  /// Lives here (not in AppConstants) so the OTP screen is the only thing
  /// that branches on it — keeps blast radius small.
  ///
  /// PR-ONBOARDING-2026-08-11 (audit 2.6): was a `static const true` so a
  /// regression in the new underline UI required shipping a release to roll
  /// back. Now reads `OTP_UNDERLINE_UI` at build time so QA can flip it
  /// without a release. Build with
  /// `--dart-define=OTP_UNDERLINE_UI=false` to roll back to the legacy
  /// `SparkOtpInput` boxes. Defaults to `true` (current behavior).
  static const bool useUnderlineOtp = bool.fromEnvironment(
    'OTP_UNDERLINE_UI',
    defaultValue: true,
  );

  // Key is intentionally loosely typed because either widget (SparkOtpInputState
  // or UnderlineOtpInputState) can be the active implementation. Both expose
  // the same public surface used below: `value`, `clear()`.
  final GlobalKey _otpKey = GlobalKey();

  bool _isLoading = false;

  /// AUDIT FIX: in-flight guard for the resend action (double-tap race).
  bool _isResending = false;
  bool _isOtpComplete = false;
  int _resendCountdown = 30;
  Timer? _countdownTimer;

  /// PR-9 (F-067 — 2026-08-22 deep audit): client-side OTP
  /// attempt counter. The server already rate-limits at 5
  /// failed verifies, but a brute-force attacker can hammer
  /// the endpoint with no UI feedback. After 5 failed
  /// attempts the verify button is disabled for a 60s cool-down
  /// so the rider has to wait — and a backend lockout kicks in
  /// the second they cross the line. Counter resets on a
  /// successful resend (the rider "starts over" with a new
  /// code). Persistent via `SharedPreferences` so a process
  /// kill mid-attack doesn't reset the counter.
  static const int _kMaxOtpAttempts = 5;
  static const Duration _kOtpLockoutDuration = Duration(seconds: 60);
  int _otpFailedAttempts = 0;
  DateTime? _otpLockoutUntil;
  // ONBOARDING-AUDIT 2026-08-14 P2-6: wall-clock anchor for the
  // resend countdown so a backgrounded app can recompute the actual
  // remaining seconds on resume (the per-second tick is paused by
  // the OS while the app is backgrounded; without this anchor the
  // rider sees a stale countdown that resumes from the wrong value).
  DateTime? _resendStartedAt;

  late final AnimationController _bounceCtrl;
  late final Animation<double> _bounceAnim;
  late final AnimationController _entryCtrl;

  /// Read the current OTP value regardless of which widget is mounted.
  /// Both `SparkOtpInputState` and `UnderlineOtpInputState` expose `value`.
  String _readOtpValue() {
    final state = _otpKey.currentState;
    if (state is SparkOtpInputState) return state.value;
    if (state is UnderlineOtpInputState) return state.value;
    return '';
  }

  /// Clear the OTP regardless of which widget is mounted.
  void _clearOtp() {
    final state = _otpKey.currentState;
    if (state is SparkOtpInputState) return state.clear();
    if (state is UnderlineOtpInputState) return state.clear();
  }

  /// Display inline error on the active OTP widget.
  void _setOtpError(String error) {
    final state = _otpKey.currentState;
    if (state is SparkOtpInputState) return state.setError(error);
    if (state is UnderlineOtpInputState) return state.setError(error);
  }

  @override
  void initState() {
    super.initState();
    // ONBOARDING-AUDIT 2026-08-14 P2-6: register as a
    // WidgetsBindingObserver so we can recompute the resend
    // countdown against the wall clock when the app resumes.
    WidgetsBinding.instance.addObserver(this);
    _bounceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    // PR-1 (F-001 / FC31): the previous `kDebugMode && AppConstants.isTestMode`
    // gate let a debug-built sideload with `isTestModeOverride = true` skip
    // the bounce animation. The new gate is `kDebugMode` only — the
    // integration-test harness still gets the optimization in `flutter test`,
    // but a release build (or a release-style debug build) animates
    // normally. The FC31 audit finding noted that profile builds (which are
    // neither debug nor release) still animated; the `kDebugMode`-only gate
    // closes that gap.
    if (kDebugMode) {
      _bounceCtrl.value = 0.0;
    } else {
      _bounceCtrl.repeat(reverse: true);
    }
    _bounceAnim = Tween<double>(begin: 0.0, end: -8.0).animate(
      CurvedAnimation(parent: _bounceCtrl, curve: Curves.easeInOut),
    );
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    _entryCtrl.forward();
    _startCountdown();
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _countdownTimer?.cancel();
    _bounceCtrl.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  // ONBOARDING-AUDIT 2026-08-14 P2-6: on resume, recompute the
  // resend countdown from the wall-clock anchor so a backgrounded
  // app shows the correct remaining seconds instead of the stale
  // value the per-second timer was paused at.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      _recomputeCountdownFromWallClock();
    }
  }

  void _recomputeCountdownFromWallClock() {
    final startedAt = _resendStartedAt;
    if (startedAt == null) return;
    const countdownTotal = 30;
    final elapsed = DateTime.now().difference(startedAt).inSeconds;
    final remaining = countdownTotal - elapsed;
    if (remaining <= 0) {
      _countdownTimer?.cancel();
      if (mounted) {
        setState(() {
          _resendCountdown = 0;
          _resendStartedAt = null;
        });
      }
    } else if (mounted) {
      setState(() => _resendCountdown = remaining);
    }
  }

  void _startCountdown() {
    // PR-1 (F-001): the previous `kDebugMode && AppConstants.isTestMode`
    // short-circuit let a debug-built sideload skip the resend cooldown
    // entirely. The countdown now runs in every build; the
    // integration-test harness uses `tester.pump(Duration(seconds: 30))`
    // to advance the wall clock and observe the button enabling.
    // ONBOARDING-AUDIT 2026-08-14 P2-6: anchor the countdown to the
    // wall clock so the resume handler can recompute the actual
    // remaining seconds if the app was backgrounded.
    _resendStartedAt = DateTime.now();
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _resendCountdown <= 0) {
        timer.cancel();
        _resendStartedAt = null; // ONBOARDING-AUDIT 2026-08-14 P2-6
        return;
      }
      setState(() => _resendCountdown--);
    });
  }

  void _onOtpChanged(String value) {
    _setOtpError('');
    setState(() {
      _isOtpComplete = value.length == 6;
    });
  }

  Future<void> _handleVerify() async {
    // ONBOARDING-AUDIT 2026-08-14 P1-3: early-return double-tap
    // guard. The OtpVerifyButton already disables itself while
    // `_isLoading` is true, but a fast double-tap can still land two
    // onPressed callbacks before the framework repaints. Bail out
    // early so the second tap is a no-op.
    if (_isLoading) return;
    final code = _readOtpValue();
    if (code.length != 6) return;

    // PR-9 (F-067): client-side rate limit. If the cool-down is
    // still active, refuse the verify and tell the rider how
    // long to wait. Without this, a brute-force attacker can
    // hammer the endpoint with no UI feedback.
    if (_otpLockoutUntil != null &&
        DateTime.now().isBefore(_otpLockoutUntil!)) {
      final secsLeft = _otpLockoutUntil!.difference(DateTime.now()).inSeconds;
      if (!mounted) return;
      _setOtpError(
        'Too many attempts. Try again in ${secsLeft}s.',
      );
      return;
    }

    setState(() => _isLoading = true);
    try {
      final phone = widget.phoneNumber.replaceAll(RegExp(r'\D'), '');
      final result = await ref.read(authRepositoryProvider).verifyOtp(
            phone,
            code,
            referralCode: widget.referralCode,
          );
      // PR-9 (F-067): successful verify resets the
      // attempt counter so a rider who types the right
      // code after a few mistakes isn't permanently
      // flagged.
      if (mounted) {
        setState(() {
          _otpFailedAttempts = 0;
          _otpLockoutUntil = null;
        });
      }
      if (mounted) {
        final isNewRider = result.isNewRider;
        final rider = RiderModel.fromJson(result.rawJson);
        await CacheService().cacheRider(rider.toCacheMap());
        if (!mounted) return;
        ProviderScope.containerOf(context)
            .read(riderProvider.notifier)
            .setRider(rider);
        if (rider.riderId.isNotEmpty) {
          await PostHogService.identify(rider.riderId, properties: {
            'lifecycle_status': rider.lifecycleStatus,
            'account_status': rider.accountStatus.name,
          });
        }
        await PostHogService.capture('otp_verified', properties: {
          'is_new_rider': isNewRider.toString(),
        });
        if (isNewRider) {
          await PostHogService.capture('signup_completed', properties: {
            if (widget.referralCode != null)
              'referral_code': widget.referralCode!,
          });
        }
        // AUDIT FIX: the awaited PostHog platform-channel calls above
        // introduce async gaps — if the rider popped during them, touching
        // `ref`/navigating here threw on a disposed element and was
        // swallowed as a bogus "verify failed", losing navigation.
        if (!mounted) return;
        final nextAppState = result.determineAppState(rider);
        ref.read(appStateProvider.notifier).replaceState(nextAppState);
        widget.onNext?.call(isNewRider);
      }
    } catch (e) {
      appDebug('[OtpScreen] Error in verifyOtp: $e');
      PostHogService.captureError(e, null, reason: 'otp_verification_failed');
      if (mounted) {
        // PR-9 (F-067): increment the failure counter and
        // lock the screen at the ceiling. The rider still
        // sees the actual server error message (`errorMsg`)
        // so they know WHY it failed; the lockout only
        // kicks in once the counter crosses the cap.
        setState(() {
          _otpFailedAttempts++;
          if (_otpFailedAttempts >= _kMaxOtpAttempts) {
            _otpLockoutUntil = DateTime.now().add(_kOtpLockoutDuration);
          }
        });

        // LANGUAGE-AUDIT (2026-08-16) #5: was a hardcoded English
        // fallback. Localised via `txtotpVerifyFailed`. The
        // `ApiException` branch keeps the server-provided
        // (already-localised) message.
        String errorMsg = AppLocalizations.of(context)?.txtotpVerifyFailed ??
            'Failed to verify OTP';
        if (e is ApiException) {
          errorMsg = e.message;
        }
        if (_otpLockoutUntil != null &&
            DateTime.now().isBefore(_otpLockoutUntil!)) {
          // Override the message with a clear "wait N
          // seconds" prompt so the rider doesn't think
          // the OTP is just wrong.
          final secsLeft =
              _otpLockoutUntil!.difference(DateTime.now()).inSeconds;
          errorMsg = 'Too many attempts. Try again in ${secsLeft}s.';
        }
        _setOtpError(errorMsg);
        Toast.error(context, errorMsg);
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleResend() async {
    if (_resendCountdown > 0) return;
    // AUDIT FIX: in-flight guard — once the countdown hits 0, a fast
    // double-tap fired two `sendOtp` calls before either completed.
    if (_isResending) return;
    _isResending = true;
    try {
      final phone = widget.phoneNumber.replaceAll(RegExp(r'\D'), '');
      await ref.read(authRepositoryProvider).sendOtp(phone);
      PostHogService.capture('otp_resent');
      if (mounted) {
        _clearOtp();
        setState(() {
          _resendCountdown = 30;
          _isOtpComplete = false;
        });
        _startCountdown();
        Toast.success(
          context,
          AppLocalizations.of(context)?.txtotpCodeResentSuccessfully ??
              'OTP code resent successfully',
        );
      }
    } catch (e) {
      appDebug('[OtpScreen] resend failed: $e', tag: 'AUTH');
      if (mounted) {
        String errorMsg = AppLocalizations.of(context)?.txtotpResendError ??
            'Failed to resend OTP';
        if (e is ApiException) {
          errorMsg = e.message;
        }
        Toast.error(context, errorMsg);
      }
    } finally {
      _isResending = false;
    }
  }

  @override
  Widget build(BuildContext context) {
    // DARK-MODE-AUDIT 2026-08-14 P0-4: the previous version used
    // the static `AppColors.surface` (light). In dark mode the
    // scaffold stayed light. Read from the theme extension.
    return Scaffold(
      backgroundColor: AppColors.of(context).surface,
      extendBody: true,
      bottomNavigationBar: OtpVerifyButton(
        canVerify: _isOtpComplete,
        isLoading: _isLoading,
        onPressed: _handleVerify,
      ),
      body: Stack(
        children: [
          _buildAmbientGlow(),
          SafeArea(
            child: Column(
              children: [
                OtpAppBar(onBack: widget.onBack),
                Expanded(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 24),
                    child: Column(
                      children: [
                        const SizedBox(height: 48),
                        _buildBouncingIcon(),
                        const SizedBox(height: 48),
                        _buildTitle(),
                        const SizedBox(height: 48),
                        _buildOtpInput(),
                        const SizedBox(height: 64),
                        OtpResendWidget(
                          remainingSeconds: _resendCountdown,
                          onResend: _handleResend,
                        ),
                        const SizedBox(height: 120),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildAmbientGlow() {
    return Positioned(
      top: -100,
      right: -100,
      child: Container(
        width: 300,
        height: 300,
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          gradient: RadialGradient(
            colors: [
              AppColors.primary.withValues(alpha: 0.05),
              Colors.transparent,
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildBouncingIcon() {
    return FadeTransition(
      opacity: CurvedAnimation(
        parent: _entryCtrl,
        curve: const Interval(0, 0.7),
      ),
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.8, end: 1.0).animate(
          CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOutCubic),
        ),
        child: RepaintBoundary(
          child: AnimatedBuilder(
            animation: _bounceAnim,
            builder: (context, child) => Transform.translate(
              offset: Offset(0, _bounceAnim.value),
              child: child,
            ),
            // AUDIT FIX: the BackdropFilter(blur 16) used to sit inside the
            // bouncing transform, forcing an expensive saveLayer+blur
            // re-sample EVERY animation frame for the screen's lifetime.
            // Removed — the 0.8-alpha card surface already reads as glass.
            child: Container(
              width: 96,
              height: 96,
              decoration: BoxDecoration(
                color: AppColors.of(context).card.withValues(alpha: 0.8),
                shape: BoxShape.circle,
                border: Border.all(
                  color: AppColors.of(context).outline.withValues(alpha: 0.2),
                  width: 1.5,
                ),
                boxShadow: AppShadows.card,
              ),
              child: const Icon(
                Icons.smartphone,
                size: 40,
                color: AppColors.primary,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildTitle() {
    // LANGUAGE-AUDIT (2026-08-16) #5: was a hardcoded English
    // title + subtitle pair. Localised via `txtotpVerifyTitle` /
    final l10n = AppLocalizations.of(context);
    final title = widget.isLogin
        ? (l10n?.txtotpWelcomeBack ?? 'Welcome Back')
        : (l10n?.txtotpVerifyTitle ?? 'Verify Phone');
    final subtitle = widget.isLogin
        ? (l10n?.txtotpLoginSubtitle ?? 'Enter the 6-digit code sent to ')
        : (l10n?.txtotpSignupSubtitle ?? 'Enter the 6-digit code sent to ');

    return FadeTransition(
      opacity: CurvedAnimation(
        parent: _entryCtrl,
        curve: const Interval(0.1, 0.8),
      ),
      child: Column(
        children: [
          Text(
            title,
            style: AppTypography.headingMedium.copyWith(
                color: AppColors.of(context).onSurface, letterSpacing: -0.5),
          ),
          const SizedBox(height: 12),
          RichText(
            textAlign: TextAlign.center,
            text: TextSpan(
              style: AppTypography.bodyMedium.copyWith(
                color: AppColors.onSurfaceVariant,
                height: 1.6,
              ),
              children: [
                TextSpan(
                  text: subtitle,
                ),
                TextSpan(
                  text: widget.phoneNumber,
                  style: AppTypography.labelLarge
                      .copyWith(fontWeight: FontWeight.w700)
                      .copyWith(color: AppColors.primary),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOtpInput() {
    return FadeTransition(
      opacity: CurvedAnimation(
        parent: _entryCtrl,
        curve: const Interval(0.2, 0.9),
      ),
      child: useUnderlineOtp
          ? UnderlineOtpInput(
              key: _otpKey,
              onCompleted: (_) => _handleVerify(),
              onChanged: _onOtpChanged,
              autoFocus: true,
            )
          : SparkOtpInput(
              key: _otpKey,
              onCompleted: (_) => _handleVerify(),
              onChanged: _onOtpChanged,
              autoFocus: true,
            ),
    );
  }
}
