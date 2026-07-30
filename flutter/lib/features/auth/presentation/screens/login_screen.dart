import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/main.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'dart:ui' as ui;
import 'package:voltium_rider/utils/phone_validator.dart';
import 'package:voltium_rider/utils/accessibility.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import '../../../../utils/app_logger.dart';

/// Matches web LoginScreen.tsx exactly:
/// - bg #F5F7FA (light)
/// - Centered logo: 72×72 circle, primary blue, bolt icon, shadow
/// - "Voltium" title (28px, w900, #101828)
/// - "Manage your journey with precision." subtitle
/// - Welcome section: h2 + subtitle text
/// - Phone pill input: bg #E6EAEF, +91 prefix, letter-spacing 1.5px
/// - Referral code input: same pill style, group-add icon
/// - OTP note: 1.5px blue dot + "A SECURE OTP WILL BE SENT"
/// - "Enter" gradient pill button (56px)
/// - Footer terms links (12px, #475467)

class LoginScreen extends ConsumerStatefulWidget {
  /// Called when OTP is sent successfully. Passes (phoneNumber, referralCode).
  final Function(String phone, String? referralCode)? onNext;
  final bool isSignUp;

  const LoginScreen({super.key, this.onNext, this.isSignUp = false});

  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen>
    with SingleTickerProviderStateMixin {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _referralController = TextEditingController();
  final FocusNode _phoneFocusNode = FocusNode();
  final FocusNode _referralFocusNode = FocusNode();
  bool _isLoading = false;
  bool _isEnterPressed = false;
  String? _phoneError;

  late final AnimationController _entryCtrl;

  Future<void> _launchUrl(String url) async {
    final uri = Uri.parse(url);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri, mode: LaunchMode.externalApplication);
    }
  }

  @override
  void initState() {
    super.initState();
    // No autofill for manual testing
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _entryCtrl.forward().then((_) {
      if (mounted) {
        _phoneFocusNode.requestFocus();
      }
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _referralController.dispose();
    _phoneFocusNode.dispose();
    _referralFocusNode.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      PhoneValidator.isValidPhone(_phoneController.text) && !_isLoading;

  void _onPhoneChanged(String value) {
    setState(() {
      final digits = value.replaceAll(RegExp(r'\D'), '');
      if (digits.isEmpty) {
        _phoneError = null;
      } else if (digits.length == 10) {
        _phoneError = PhoneValidator.validate(digits);
      } else if (digits.length > 10) {
        _phoneError = 'Phone number cannot exceed 10 digits';
      } else if (!RegExp(r'^[6-9]').hasMatch(digits)) {
        _phoneError = 'Phone number must start with 6, 7, 8, or 9';
      } else {
        _phoneError = null;
      }
    });
  }

  Future<void> _handleLogin() async {
    if (_isLoading) return;

    final digits = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final error = PhoneValidator.validate(digits);
    if (error != null) {
      setState(() => _phoneError = error);
      return;
    }

    setState(() => _isLoading = true);
    PostHogService.capture('phone_entered', properties: {
      'is_sign_up': widget.isSignUp.toString(),
    });
    try {
      final referralCode = _referralController.text.trim();
      await ref.read(authRepositoryProvider).sendOtp(
            digits,
            referralCode: referralCode.isNotEmpty ? referralCode : null,
          );
      PostHogService.capture('otp_requested', properties: {
        'has_referral': (referralCode.isNotEmpty).toString(),
        'is_sign_up': widget.isSignUp.toString(),
      });
      if (mounted) {
        widget.onNext
            ?.call(digits, referralCode.isNotEmpty ? referralCode : null);
      }
    } catch (e) {
      appDebug('[LoginScreen] Error in sendOtp: $e');
      PostHogService.captureError(e, null, reason: 'otp_request_failed');
      if (mounted) {
        String errorMsg = 'Network error. Please try again.';
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.surface, // Upgraded from surfaceAlt
      body: Stack(
        children: [
          // Ambient background glow
          Positioned(
            top: -100,
            right: -100,
            child: Container(
              width: 300,
              height: 300,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: AppColors.primary.withValues(alpha: 0.05),
                boxShadow: [
                  BoxShadow(
                    color: AppColors.primary.withValues(alpha: 0.1),
                    blurRadius: 100,
                    spreadRadius: 50,
                  ),
                ],
              ),
            ),
          ),
          Positioned.fill(
            child: SafeArea(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                    32, 24, 32, MediaQuery.of(context).padding.bottom + 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 48),

                    // Logo + App Name + Subtitle
                    _buildLogoSection(),

                    const SizedBox(height: 64),

                    // Welcome text
                    _buildWelcomeSection(),

                    const SizedBox(height: 32),

                    // Phone input
                    _buildPhoneInput(),

                    const SizedBox(height: 16),

                    // Referral code input
                    _buildReferralInput(),

                    const SizedBox(height: 16),

                    // OTP secure note
                    _buildOtpNote(),

                    const SizedBox(height: 32),

                    // Enter button
                    _buildEnterButton(),
                  ],
                ),
              ),
            ),
          ),
          // Floating footer
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: _buildFloatingFooter(),
          ),
        ],
      ),
    );
  }

  Widget _buildLogoSection() {
    return FadeTransition(
      opacity:
          CurvedAnimation(parent: _entryCtrl, curve: const Interval(0, 0.7)),
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.9, end: 1.0).animate(
          CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOutCubic),
        ),
        child: Semantics(
          header: true,
          label: a11yHeading('Voltium', '1'),
          child: Center(
            child: Column(
              children: [
                ExcludeSemantics(
                  child: Container(
                    width: 72,
                    height: 72,
                    decoration: BoxDecoration(
                      color: AppColors.primary,
                      shape: BoxShape.circle,
                      boxShadow: [
                        BoxShadow(
                          color: AppColors.royalBlue.withValues(alpha: 0.2),
                          blurRadius: 20,
                          offset: const Offset(0, 8),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Image.asset(
                        'assets/logo.png',
                        width: 40,
                        height: 40,
                        color: Colors.white,
                        colorBlendMode: BlendMode.srcIn,
                        errorBuilder: (_, __, ___) => const Icon(
                          Icons.bolt,
                          color: Colors.white,
                          size: 40,
                        ),
                      ),
                    ),
                  ),
                ),
                SizedBox(height: 24),
                Text(
                  'Voltium',
                  style: AppTypography.headingLarge.copyWith(
                      color: AppColors.onSurface,
                      letterSpacing: -0.5,
                      height: 1.2),
                ),
                SizedBox(height: 8),
                ExcludeSemantics(
                  child: Text(
                    'Electric scooter rentals made simple.',
                    style: AppTypography.bodyMedium.copyWith(
                        color: AppColors.onSurfaceVariant, height: 1.4),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildWelcomeSection() {
    return SlideTransition(
      position:
          Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(
        CurvedAnimation(
          parent: _entryCtrl,
          curve: const Interval(0.1, 0.8, curve: Curves.easeOutCubic),
        ),
      ),
      child: FadeTransition(
        opacity: CurvedAnimation(
          parent: _entryCtrl,
          curve: const Interval(0.1, 0.7),
        ),
        child: Semantics(
          label: 'Welcome section with instructions',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Welcome',
                style: AppTypography.headingSmall
                    .copyWith(color: AppColors.onSurface, letterSpacing: -0.5),
              ),
              SizedBox(height: 8),
              Text(
                'Enter the registered phone number to login or enter a new number to create another account.',
                style: GoogleFonts.plusJakartaSans(
                  fontSize: 14,
                  color: AppColors.onSurfaceVariant,
                  height: 1.6,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPhoneInput() {
    return SlideTransition(
      position:
          Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(
        CurvedAnimation(
          parent: _entryCtrl,
          curve: const Interval(0.2, 0.9, curve: Curves.easeOutCubic),
        ),
      ),
      child: FadeTransition(
        opacity: CurvedAnimation(
          parent: _entryCtrl,
          curve: const Interval(0.2, 0.8),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 56,
              decoration: BoxDecoration(
                color: _phoneError != null
                    ? AppColors.errorSurface
                    : AppColors.of(context).card,
                borderRadius: BorderRadius.circular(AppRadius.full),
                border: Border.all(
                  color: _phoneError != null
                      ? AppColors.error
                      : AppColors.of(context).outline.withValues(alpha: 0.4),
                  width: 1.5,
                ),
                boxShadow: AppShadows.glass,
              ),
              child: Row(
                children: [
                  GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: () => _phoneFocusNode.requestFocus(),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ExcludeSemantics(
                          child: Padding(
                            padding: const EdgeInsets.only(left: 24, right: 12),
                            child: Text(
                              '+91',
                              style: AppTypography.titleSmall
                                  .copyWith(color: AppColors.onSurface),
                            ),
                          ),
                        ),
                        Container(
                          width: 1,
                          height: 20,
                          color: AppColors.divider,
                        ),
                        const SizedBox(width: 12),
                      ],
                    ),
                  ),
                  Expanded(
                    child: TextFormField(
                      key: const Key('phoneInput'),
                      controller: _phoneController,
                      focusNode: _phoneFocusNode,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(10),
                      ],
                      onChanged: _onPhoneChanged,
                      onFieldSubmitted: (_) => _handleLogin(),
                      style: AppTypography.bodyLarge.copyWith(
                          color: AppColors.onSurface, letterSpacing: 1.5),
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        filled: true,
                        fillColor: Colors.transparent,
                        hintText: '00000 00000',
                        hintStyle: GoogleFonts.plusJakartaSans(
                          fontSize: 16,
                          color: AppColors.onSurfaceDisabled,
                          letterSpacing: 1.5,
                          fontWeight: FontWeight.w400,
                        ),
                        contentPadding: EdgeInsets.zero,
                        errorText: null,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            if (_phoneError != null)
              Padding(
                padding: const EdgeInsets.only(left: 20, top: 8),
                child: Semantics(
                  liveRegion: true,
                  child: Text(
                    _phoneError!,
                    style: AppTypography.bodySmall
                        .copyWith(color: AppColors.error),
                  ),
                ),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildReferralInput() {
    return SlideTransition(
      position:
          Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(
        CurvedAnimation(
          parent: _entryCtrl,
          curve: const Interval(0.25, 0.95, curve: Curves.easeOutCubic),
        ),
      ),
      child: FadeTransition(
        opacity: CurvedAnimation(
          parent: _entryCtrl,
          curve: const Interval(0.25, 0.85),
        ),
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.of(context).card,
            borderRadius: BorderRadius.circular(AppRadius.full),
            border: Border.all(
              color: AppColors.of(context).outline.withValues(alpha: 0.4),
              width: 1.5,
            ),
            boxShadow: AppShadows.glass,
          ),
          child: GestureDetector(
            behavior: HitTestBehavior.opaque,
            onTap: () => _referralFocusNode.requestFocus(),
            child: Row(
              children: [
                const Padding(
                  padding: EdgeInsets.only(left: 20, right: 8),
                  child: Icon(
                    Icons.person_add_outlined,
                    size: 20,
                    color: AppColors.primary,
                  ),
                ),
                Expanded(
                  child: TextFormField(
                    key: const Key('referralInput'),
                    controller: _referralController,
                    focusNode: _referralFocusNode,
                    textCapitalization: TextCapitalization.characters,
                    style: AppTypography.bodyMediumEmphasis
                        .copyWith(color: AppColors.onSurface),
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      filled: true,
                      fillColor: Colors.transparent,
                      hintText: 'Referral Code (Optional)',
                      hintStyle: AppTypography.inputHint
                          .copyWith(color: AppColors.onSurfaceDisabled),
                      contentPadding: EdgeInsets.zero,
                    ),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildOtpNote() {
    return Row(
      children: [
        Container(
          width: 6,
          height: 6,
          decoration: const BoxDecoration(
            color: AppColors.primary,
            shape: BoxShape.circle,
          ),
        ),
        SizedBox(width: 8),
        Text(
          'A secure OTP will be sent',
          style: AppTypography.bodySmallStrong
              .copyWith(letterSpacing: 1.2, color: AppColors.onSurfaceVariant),
        ),
      ],
    );
  }

  Widget _buildEnterButton() {
    return Semantics(
      button: true,
      label: a11yButton('Send OTP'),
      child: Focus(
        child: GestureDetector(
          key: const Key('sendOtpButton'),
          behavior: HitTestBehavior.opaque,
          onTapDown: _canSubmit || VoltiumApp.isTestMode
              ? (_) => setState(() => _isEnterPressed = true)
              : null,
          onTapUp: _canSubmit || VoltiumApp.isTestMode
              ? (_) => setState(() => _isEnterPressed = false)
              : null,
          onTapCancel: () => setState(() => _isEnterPressed = false),
          onTap: VoltiumApp.isTestMode
              ? _handleLogin
              : (_canSubmit ? _handleLogin : null),
          child: AnimatedScale(
            scale: _isEnterPressed ? 0.96 : 1.0,
            duration: const Duration(milliseconds: 150),
            curve: Curves.easeOutCubic,
            child: AnimatedOpacity(
              opacity: _canSubmit ? 1.0 : 0.4,
              duration: const Duration(milliseconds: 200),
              child: Container(
                width: double.infinity,
                height: 56,
                decoration: BoxDecoration(
                  gradient: AppGradients.primary,
                  borderRadius: BorderRadius.circular(AppRadius.full),
                  boxShadow: _canSubmit ? AppShadows.primaryButton : null,
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
                      : Text(
                          'Enter',
                          style: AppTypography.buttonMedium
                              .copyWith(color: Colors.white),
                        ),
                ),
              ),
            ),
          ),
        ),
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
          child: Center(
            child: FadeTransition(
              opacity: CurvedAnimation(
                parent: _entryCtrl,
                curve: const Interval(0.5, 1.0),
              ),
              child: RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: GoogleFonts.plusJakartaSans(
                    fontSize: 12,
                    color: AppColors.onSurfaceVariant,
                    height: 1.6,
                  ),
                  children: [
                    TextSpan(
                        text: a11yLabel('By signing in, you agree to our\n')),
                    WidgetSpan(
                      child: Semantics(
                        button: true,
                        label: a11yButton('Terms of Service'),
                        child: GestureDetector(
                          onTap: () => _launchUrl('https://voltium.app/terms'),
                          child: Text(
                            'Terms of Service',
                            style: AppTypography.labelMedium
                                .copyWith(color: AppColors.primary),
                          ),
                        ),
                      ),
                    ),
                    TextSpan(
                      text: ' and ',
                      style: GoogleFonts.plusJakartaSans(
                        fontSize: 12,
                        color: AppColors.onSurfaceVariant,
                      ),
                    ),
                    WidgetSpan(
                      child: Semantics(
                        button: true,
                        label: a11yButton('Privacy Policy'),
                        child: GestureDetector(
                          onTap: () =>
                              _launchUrl('https://voltium.app/privacy'),
                          child: Text(
                            'Privacy Policy',
                            style: AppTypography.labelMedium
                                .copyWith(color: AppColors.primary),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
