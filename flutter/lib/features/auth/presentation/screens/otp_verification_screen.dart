import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:provider/provider.dart';
import 'package:voltium_rider/main.dart';
import 'package:voltium_rider/models/rider_model.dart';
import 'package:voltium_rider/services/api_service.dart';
import 'package:voltium_rider/services/secure_storage_service.dart';
import 'package:voltium_rider/providers/app_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';

/// Matches web OtpScreen.tsx exactly:
/// - bg #F5F7FA (light)
/// - Custom top bar: white circle back btn (left), "VOLTIUM" centered uppercase, spacer (right)
/// - Animated smartphone icon in 96×96 white circle (shadow, bouncing)
/// - "Verify OTP" / "Welcome Back!" title (32px, w900, #101828)
/// - Subtitle (15px, #475467) with phone number in primary blue bold
/// - 6 OTP boxes: w-48 h-56, rounded-2xl, bg-white, border #E2E8F0, focus border #0053C1
/// - "Didn't receive the code?" uppercase + Resend button / timer
/// - Gradient "Verify & Proceed" + ArrowRight, pill 56px

class OtpVerificationScreen extends StatefulWidget {
  final VoidCallback? onNext;
  final String phoneNumber;
  final bool isLogin;
  final VoidCallback? onBack;

  const OtpVerificationScreen({
    super.key,
    this.onNext,
    this.phoneNumber = '+91 98765 43210',
    this.isLogin = false,
    this.onBack,
  });

  @override
  State<OtpVerificationScreen> createState() => _OtpVerificationScreenState();
}

class _OtpVerificationScreenState extends State<OtpVerificationScreen>
    with TickerProviderStateMixin {
  final List<TextEditingController> _controllers =
      List.generate(6, (_) => TextEditingController());
  final List<FocusNode> _focusNodes = List.generate(6, (_) => FocusNode());

  bool _isLoading = false;
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

    if (VoltiumApp.isTestMode) {
      _entryCtrl.value = 1.0;
    } else {
      _entryCtrl.forward();
    }

    _startCountdown();
  }

  @override
  void dispose() {
    _countdownTimer?.cancel();
    for (var c in _controllers) {
      c.dispose();
    }
    for (var n in _focusNodes) {
      n.dispose();
    }
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

  void _onChanged(String value, int index) {
    if (value.length == 1 && index < 5) {
      _focusNodes[index + 1].requestFocus();
    }
    if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }
    setState(() {});
  }

  bool get _isComplete => _controllers.every((c) => c.text.isNotEmpty);

  Future<void> _handleVerify() async {
    final code = _controllers.map((c) => c.text).join();
    if (code.length != 6) return;

    setState(() => _isLoading = true);
    try {
      final phone = widget.phoneNumber.replaceAll(RegExp(r'\D'), '');
      final response = await ApiService().verifyOtp(phone: phone, otp: code);
      if (mounted) {
        if (response['success'] == true) {
          debugPrint('OtpVerificationScreen: verify-otp response: $response');
          final token = response['data']?['token'] ??
              response['token'] ??
              response['accessToken'] as String?;
          debugPrint(
              'OtpVerificationScreen: Saving token: ${token != null && token.length > 10 ? token.substring(0, 10) : token}');
          if (token != null) {
            await SecureStorageService().setToken(token);
          }
          if (!mounted) return;
          final riderData = response['rider'] ?? response['data'];
          if (riderData != null && riderData is Map<String, dynamic>) {
            final rider = RiderModel.fromJson(riderData);
            context.read<AppProvider>().setRider(rider);
          }
          widget.onNext?.call();
        } else {
          for (var c in _controllers) {
            c.clear();
          }
          _focusNodes[0].requestFocus();
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['message'] ?? 'Invalid OTP'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
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
      await ApiService().sendOtp(phone: phone);
      if (mounted) {
        for (var c in _controllers) {
          c.clear();
        }
        setState(() => _resendCountdown = 30);
        _startCountdown();
        _focusNodes[0].requestFocus();
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
      backgroundColor: AppColors.surfaceAlt, // #F5F7FA
      body: SafeArea(
        child: Column(
          children: [
            // Custom AppBar — white circle back btn + "VOLTIUM" centered
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
              child: Stack(
                alignment: Alignment.center,
                children: [
                  // Back button (left)
                  Align(
                    alignment: Alignment.centerLeft,
                    child: GestureDetector(
                      onTap: widget.onBack ?? () => Navigator.maybePop(context),
                      child: Container(
                        width: 40,
                        height: 40,
                        decoration: BoxDecoration(
                          color: Colors.white,
                          shape: BoxShape.circle,
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

                  // Centered brand name
                  Text(
                    'VOLTIUM',
                    style: GoogleFonts.inter(
                      fontSize: 16,
                      fontWeight: FontWeight.w900,
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
                          parent: _entryCtrl, curve: const Interval(0, 0.7)),
                      child: ScaleTransition(
                        scale: Tween<double>(begin: 0.8, end: 1.0).animate(
                          CurvedAnimation(
                              parent: _entryCtrl, curve: Curves.easeOutCubic),
                        ),
                        child: AnimatedBuilder(
                          animation: _bounceAnim,
                          builder: (context, child) => Transform.translate(
                            offset: Offset(0, _bounceAnim.value),
                            child: child,
                          ),
                          child: Container(
                            width: 96,
                            height: 96,
                            decoration: BoxDecoration(
                              color: Colors.white,
                              shape: BoxShape.circle,
                              boxShadow: const [
                                BoxShadow(
                                  color: Color(0x0A000000),
                                  blurRadius: 20,
                                  offset: Offset(0, 10),
                                ),
                              ],
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

                    const SizedBox(height: 48),

                    // Title
                    FadeTransition(
                      opacity: CurvedAnimation(
                          parent: _entryCtrl, curve: const Interval(0.1, 0.8)),
                      child: Column(
                        children: [
                          Text(
                            widget.isLogin ? 'Welcome Back!' : 'Verify OTP',
                            style: GoogleFonts.inter(
                              fontSize: 32,
                              fontWeight: FontWeight.w900,
                              color: AppColors.onSurface,
                              letterSpacing: -0.5,
                            ),
                          ),
                          const SizedBox(height: 12),
                          RichText(
                            textAlign: TextAlign.center,
                            text: TextSpan(
                              style: GoogleFonts.inter(
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
                                  style: GoogleFonts.inter(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: AppColors.primary,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 48),

                    // OTP Input boxes
                    FadeTransition(
                      opacity: CurvedAnimation(
                          parent: _entryCtrl, curve: const Interval(0.2, 0.9)),
                      child: GestureDetector(
                        behavior: HitTestBehavior.opaque,
                        onTap: () {
                          for (int i = 0; i < 6; i++) {
                            if (_controllers[i].text.isEmpty) {
                              _focusNodes[i].requestFocus();
                              break;
                            }
                            if (i == 5) _focusNodes[5].requestFocus();
                          }
                        },
                        child: Row(
                          key: const Key('otpInputRow'),
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: List.generate(6, (index) {
                            return SizedBox(
                              width: 48,
                              height: 56,
                              child: TextField(
                                key: ValueKey('otp_box_$index'),
                                controller: _controllers[index],
                                focusNode: _focusNodes[index],
                                keyboardType: TextInputType.number,
                                textAlign: TextAlign.center,
                                maxLength: 1,
                                obscureText: false,
                                inputFormatters: [
                                  FilteringTextInputFormatter.digitsOnly,
                                ],
                                onChanged: (v) => _onChanged(v, index),
                                style: GoogleFonts.inter(
                                  fontSize: 24,
                                  fontWeight: FontWeight.w800,
                                  color: AppColors.onSurface,
                                ),
                                decoration: InputDecoration(
                                  counterText: '',
                                  filled: true,
                                  fillColor: Colors.white,
                                  contentPadding: EdgeInsets.zero,
                                  border: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(16),
                                    borderSide: const BorderSide(
                                      color: AppColors.outlineVariant,
                                      width: 1.5,
                                    ),
                                  ),
                                  enabledBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(16),
                                    borderSide: const BorderSide(
                                      color: AppColors.outlineVariant,
                                      width: 1.5,
                                    ),
                                  ),
                                  focusedBorder: OutlineInputBorder(
                                    borderRadius: BorderRadius.circular(16),
                                    borderSide: const BorderSide(
                                      color: AppColors.primary,
                                      width: 2,
                                    ),
                                  ),
                                ),
                              ),
                            );
                          }),
                        ),
                      ),
                    ),

                    const SizedBox(height: 64),

                    // Resend section
                    Column(
                      children: [
                        Text(
                          "DIDN'T RECEIVE THE CODE?",
                          style: GoogleFonts.inter(
                            fontSize: 11,
                            fontWeight: FontWeight.w800,
                            letterSpacing: 1.2,
                            color: AppColors.onSurfaceVariant,
                          ),
                        ),
                        const SizedBox(height: 8),
                        GestureDetector(
                          key: const Key('resendCodeButton'),
                          onTap: _resendCountdown <= 0 ? _handleResend : null,
                          child: Text(
                            _resendCountdown > 0
                                ? 'Resend in ${_resendCountdown}s'
                                : 'Resend Code',
                            style: GoogleFonts.inter(
                              fontSize: 15,
                              fontWeight: FontWeight.w800,
                              color: _resendCountdown > 0
                                  ? AppColors.onSurfaceDisabled
                                  : AppColors.primary,
                            ),
                          ),
                        ),
                      ],
                    ),

                    const SizedBox(height: 48),
                  ],
                ),
              ),
            ),

            // Gradient "Verify & Proceed" CTA
            Padding(
              padding: const EdgeInsets.only(
                  left: 24, right: 24, bottom: 32, top: 16),
              child: GestureDetector(
                key: const Key('verifyOtpButton'),
                behavior: HitTestBehavior.opaque,
                onTap: (VoltiumApp.isTestMode || (_isComplete && !_isLoading))
                    ? _handleVerify
                    : null,
                child: AnimatedOpacity(
                  opacity: (_isComplete && !_isLoading) ? 1.0 : 0.4,
                  duration: const Duration(milliseconds: 200),
                  child: Container(
                    height: 56,
                    decoration: BoxDecoration(
                      gradient: AppGradients.primary,
                      borderRadius: BorderRadius.circular(999),
                      boxShadow: (_isComplete && !_isLoading)
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
                                  style: GoogleFonts.inter(
                                    fontSize: 15,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
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
          ],
        ),
      ),
    );
  }
}
