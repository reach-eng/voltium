import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:voltium_rider/main.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/widgets/spark_otp_input.dart';
import 'package:voltium_rider/services/cache_service.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import '../../../../utils/app_logger.dart';

/// Matches web OtpScreen.tsx exactly:
/// - bg #F5F7FA (light)
/// - Custom top bar: white circle back btn (left), "VOLTIUM" centered uppercase, spacer (right)
/// - Animated smartphone icon in 96×96 white circle (shadow, bouncing)
/// - "Verify OTP" / "Welcome Back!" title (32px, w900, #101828)
/// - Subtitle (15px, #475467) with phone number in primary blue bold
/// - 6 OTP boxes: w-48 h-56, rounded-2xl, bg-white, border #E2E8F0, focus border #0053C1
/// - "Didn't receive the code?" uppercase + Resend button / timer
/// - Gradient "Verify & Proceed" + ArrowRight, pill 56px

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
  bool _isVerifyPressed = false;
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

    if (VoltiumApp.isTestMode) {
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
    if (VoltiumApp.isTestMode) {
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
      backgroundColor: AppColors.surface, // #F5F7FA
      extendBody: true,
      bottomNavigationBar: _buildFloatingFooter(),
      body: Stack(
        children: [
          // Ambient Gradient Background
          Positioned(
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
          ),
          SafeArea(
            child: Column(
              children: [
                // Custom AppBar — white circle back btn + "VOLTIUM" centered
                Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      // Back button (left)
                      Align(
                        alignment: Alignment.centerLeft,
                        child: GestureDetector(
                          onTap: widget.onBack ??
                              () => Navigator.maybePop(context),
                          child: ClipRRect(
                            borderRadius: BorderRadius.circular(AppRadius.full),
                            child: BackdropFilter(
                              filter:
                                  ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
                              child: Container(
                                width: 44,
                                height: 44,
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
                                  Icons.arrow_back,
                                  size: 20,
                                  color: AppColors.onSurface,
                                ),
                              ),
                            ),
                          ),
                        ),
                      ),

                      // Centered brand name
                      Text(
                        'Voltium',
                        style: GoogleFonts.plusJakartaSans(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: AppColors.onSurface,
                          letterSpacing: 1.5,
                        ),
                      ),

                      // Spacer (right side)
                      const Align(
                        alignment: Alignment.centerRight,
                        child: SizedBox(width: 40, height: 40),
                      ),
                    ],
                  ),
                ),

                // Scrollable content
                Expanded(
                  child: SingleChildScrollView(
                    padding:
                        const EdgeInsets.symmetric(horizontal: 24, vertical: 0),
                    child: Column(
                      children: [
                        const SizedBox(height: 48),

                        // Bouncing smartphone icon in white circle
                        FadeTransition(
                          opacity: CurvedAnimation(
                            parent: _entryCtrl,
                            curve: const Interval(0, 0.7),
                          ),
                          child: ScaleTransition(
                            scale: Tween<double>(begin: 0.8, end: 1.0).animate(
                              CurvedAnimation(
                                parent: _entryCtrl,
                                curve: Curves.easeOutCubic,
                              ),
                            ),
                            child: RepaintBoundary(
                              child: AnimatedBuilder(
                                animation: _bounceAnim,
                                builder: (context, child) =>
                                    Transform.translate(
                                  offset: Offset(0, _bounceAnim.value),
                                  child: child,
                                ),
                                child: ClipRRect(
                                  borderRadius:
                                      BorderRadius.circular(AppRadius.full),
                                  child: BackdropFilter(
                                    filter: ui.ImageFilter.blur(
                                        sigmaX: 16, sigmaY: 16),
                                    child: Container(
                                      width: 96,
                                      height: 96,
                                      decoration: BoxDecoration(
                                        color:
                                            Colors.white.withValues(alpha: 0.7),
                                        shape: BoxShape.circle,
                                        border: Border.all(
                                          color: Colors.white
                                              .withValues(alpha: 0.4),
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
                        ),

                        const SizedBox(height: 48),

                        // Title
                        FadeTransition(
                          opacity: CurvedAnimation(
                            parent: _entryCtrl,
                            curve: const Interval(0.1, 0.8),
                          ),
                          child: Column(
                            children: [
                              Text(
                                widget.isLogin ? 'Welcome Back!' : 'Verify OTP',
                                style: AppTypography.headingMedium.copyWith(
                                    color: AppColors.onSurface,
                                    letterSpacing: -0.5),
                              ),
                              SizedBox(height: 12),
                              RichText(
                                textAlign: TextAlign.center,
                                text: TextSpan(
                                  style: GoogleFonts.plusJakartaSans(
                                    fontSize: 15,
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
                                      style: AppTypography.buttonMedium
                                          .copyWith(color: AppColors.primary),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),

                        const SizedBox(height: 48),

                        // Spark OTP Input — electric glow per digit, chain-lightning on complete
                        FadeTransition(
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
                        ),

                        const SizedBox(height: 64),

                        // Resend section
                        Column(
                          children: [
                            Text(
                              "DIDN'T RECEIVE THE CODE?",
                              style: AppTypography.bodySmallStrong.copyWith(
                                  letterSpacing: 1.2,
                                  color: AppColors.onSurfaceVariant),
                            ),
                            SizedBox(height: 8),
                            GestureDetector(
                              key: const Key('resendCodeButton'),
                              onTap:
                                  _resendCountdown <= 0 ? _handleResend : null,
                              child: Padding(
                                padding: const EdgeInsets.symmetric(
                                    vertical: 12, horizontal: 16),
                                child: Text(
                                  _resendCountdown > 0
                                      ? 'Resend in ${_resendCountdown}s'
                                      : 'Resend Code',
                                  style: AppTypography.buttonMedium.copyWith(
                                      color: _resendCountdown > 0
                                          ? AppColors.onSurfaceDisabled
                                          : AppColors.primary),
                                ),
                              ),
                            ),
                          ],
                        ),

                        const SizedBox(
                            height: 120), // Padding for floating footer
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

  Widget _buildFloatingFooter() {
    return ClipRRect(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: EdgeInsets.fromLTRB(
              20, 20, 20, MediaQuery.of(context).padding.bottom + 20),
          decoration: BoxDecoration(
            color: Colors.white.withValues(alpha: 0.7),
            border: Border(
              top: BorderSide(
                color: Colors.white.withValues(alpha: 0.2),
                width: 1,
              ),
            ),
          ),
          child: GestureDetector(
            key: const Key('verifyOtpButton'),
            behavior: HitTestBehavior.opaque,
            onTapDown:
                (VoltiumApp.isTestMode || (_isOtpComplete && !_isLoading))
                    ? (_) => setState(() => _isVerifyPressed = true)
                    : null,
            onTapUp: (VoltiumApp.isTestMode || (_isOtpComplete && !_isLoading))
                ? (_) => setState(() => _isVerifyPressed = false)
                : null,
            onTapCancel: () => setState(() => _isVerifyPressed = false),
            onTap: (VoltiumApp.isTestMode || (_isOtpComplete && !_isLoading))
                ? _handleVerify
                : null,
            child: AnimatedScale(
              scale: _isVerifyPressed ? 0.96 : 1.0,
              duration: const Duration(milliseconds: 150),
              curve: Curves.easeOutCubic,
              child: AnimatedOpacity(
                opacity: (_isOtpComplete && !_isLoading) ? 1.0 : 0.4,
                duration: const Duration(milliseconds: 200),
                child: Container(
                  height: 56,
                  decoration: BoxDecoration(
                    gradient: AppGradients.primary,
                    borderRadius: BorderRadius.circular(AppRadius.full),
                    boxShadow: (_isOtpComplete && !_isLoading)
                        ? AppShadows.primaryButton
                        : null,
                  ),
                  child: Center(
                    child: _isLoading
                        ? const SizedBox(
                            width: 20,
                            height: 20,
                            child: CircularProgressIndicator(
                              color: Colors.white,
                              strokeWidth: 2,
                            ),
                          )
                        : Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                'Verify & Proceed',
                                style: AppTypography.buttonMedium
                                    .copyWith(color: Colors.white),
                              ),
                              const SizedBox(width: 8),
                              const Icon(
                                Icons.arrow_forward,
                                size: 20,
                                color: Colors.white,
                              ),
                            ],
                          ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
