import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/app_constants.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/widgets/spark_otp_input.dart';
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
///   │  SparkOtpInput (6 boxes)                  │
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

  const OtpVerificationScreen({
    super.key,
    this.onNext,
    this.phoneNumber = '+91 98765 43210',
    this.isLogin = false,
    this.onBack,
    this.referralCode,
  });

  @override
  ConsumerState<OtpVerificationScreen> createState() =>
      _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends ConsumerState<OtpVerificationScreen>
    with TickerProviderStateMixin {
  final GlobalKey<SparkOtpInputState> _otpKey = GlobalKey<SparkOtpInputState>();

  bool _isLoading = false;
  bool _isOtpComplete = false;
  int _resendCountdown = 30;
  Timer? _countdownTimer;

  late final AnimationController _bounceCtrl;
  late final Animation<double> _bounceAnim;
  late final AnimationController _entryCtrl;

  @override
  void initState() {
    super.initState();
    _bounceCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    );
    if (AppConstants.isTestMode) {
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
    _countdownTimer?.cancel();
    _bounceCtrl.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  void _startCountdown() {
    if (AppConstants.isTestMode) {
      setState(() => _resendCountdown = 0);
      return;
    }
    _countdownTimer?.cancel();
    _countdownTimer = Timer.periodic(const Duration(seconds: 1), (timer) {
      if (!mounted || _resendCountdown <= 0) {
        timer.cancel();
        return;
      }
      setState(() => _resendCountdown--);
    });
  }

  void _onOtpChanged(String value) {
    setState(() {
      _isOtpComplete = value.length == 6;
    });
  }

  Future<void> _handleVerify() async {
    final code = _otpKey.currentState?.value ?? '';
    if (code.length != 6) return;

    setState(() => _isLoading = true);
    try {
      final phone = widget.phoneNumber.replaceAll(RegExp(r'\D'), '');
      final result =
          await ref.read(authRepositoryProvider).verifyOtp(phone, code);
      if (mounted) {
        final isNewRider = result.isNewRider;
        final rider = RiderModel.fromJson(result.rawJson);
        await CacheService().cacheRider(rider.toCacheMap());
        if (!mounted) return;
        ProviderScope.containerOf(context).read(riderProvider).setRider(rider);
        if (rider.riderId.isNotEmpty) {
          unawaited(PostHogService.identify(rider.riderId, properties: {
            'lifecycle_status': rider.lifecycleStatus,
            'account_status': rider.accountStatus.name,
          }));
        }
        unawaited(PostHogService.capture('otp_verified', properties: {
          'is_new_rider': isNewRider.toString(),
        }));
        if (isNewRider) {
          unawaited(PostHogService.capture('signup_completed', properties: {
            if (widget.referralCode != null)
              'referral_code': widget.referralCode!,
          }));
        }
        widget.onNext?.call(isNewRider);
      }
    } catch (e) {
      appDebug('[OtpScreen] Error in verifyOtp: $e');
      PostHogService.captureError(e, null, reason: 'otp_verification_failed');
      if (mounted) {
        String errorMsg = 'Failed to verify OTP. Please try again.';
        if (e is ApiException) {
          errorMsg = e.message;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  Future<void> _handleResend() async {
    if (_resendCountdown > 0) return;
    try {
      final phone = widget.phoneNumber.replaceAll(RegExp(r'\D'), '');
      await ref.read(authRepositoryProvider).sendOtp(phone);
      PostHogService.capture('otp_resent');
      if (mounted) {
        _otpKey.currentState?.clear();
        setState(() {
          _resendCountdown = 30;
          _isOtpComplete = false;
        });
        _startCountdown();
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('OTP code resent successfully!'),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        String errorMsg = 'Error resending OTP';
        if (e is ApiException) {
          errorMsg = e.message;
        }
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg),
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface,
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
            child: ClipRRect(
              borderRadius: BorderRadius.circular(AppRadius.full),
              child: BackdropFilter(
                filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                child: Container(
                  width: 96,
                  height: 96,
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.7),
                    shape: BoxShape.circle,
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.4),
                      width: 1.5,
                    ),
                    boxShadow: AppShadows.glass,
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
        ),
      ),
    );
  }

  Widget _buildTitle() {
    return FadeTransition(
      opacity: CurvedAnimation(
        parent: _entryCtrl,
        curve: const Interval(0.1, 0.8),
      ),
      child: Column(
        children: [
          Text(
            widget.isLogin ? 'Welcome Back!' : 'Verify OTP',
            style: AppTypography.headingMedium
                .copyWith(color: AppColors.onSurface, letterSpacing: -0.5),
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
                  text: widget.isLogin
                      ? 'Enter the code to login to your account '
                      : 'Enter the 6-digit code sent to ',
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
      child: SparkOtpInput(
        key: _otpKey,
        onCompleted: (_) => _handleVerify(),
        onChanged: _onOtpChanged,
        autoFocus: true,
      ),
    );
  }
}
