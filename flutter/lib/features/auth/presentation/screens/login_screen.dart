import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:voltium_rider/config/app_config.dart';
import 'package:voltium_rider/core/network/api_client.dart';
import 'package:voltium_rider/core/observability/posthog_service.dart';
import 'package:voltium_rider/core/state/riverpod_providers.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/accessibility.dart';
import 'package:voltium_rider/utils/app_logger.dart';
import 'package:voltium_rider/utils/phone_validator.dart';
import 'package:voltium_rider/utils/toast.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/phone_entry_widget.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/otp_trigger_widget.dart';
import 'package:voltium_rider/features/auth/presentation/widgets/login_footer.dart';

/// LoginScreen — composition shell for the auth landing page.
///
/// Layout (top → bottom):
///   ┌──────────────────────────────────────────┐
///   │  Ambient blue glow (top-right)           │
///   │                                          │
///   │  Logo + "Voltium" + tagline              │
///   │  "Welcome" + instructions                │
///   │  PhoneEntryWidget  (phone + referral +   │
///   │                     OTP note)            │
///   │  OtpTriggerWidget (Enter button)         │
///   │                                          │
///   │  Floating footer: terms + privacy        │
///   └──────────────────────────────────────────┘
///
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

  bool _isLoading = false;

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
    _entryCtrl.forward();
    // PhoneEntryWidget requests its own focus on first build.
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _referralController.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      PhoneValidator.isValidPhone(_phoneController.text) && !_isLoading;

  Future<void> _handleLogin() async {
    if (_isLoading) return;

    final error = PhoneValidator.validate(_phoneController.text);
    if (error != null) {
      Toast.error(context, error);
      setState(() {});
      return;
    }

    final digits = _phoneController.text.replaceAll(RegExp(r'\D'), '');

    setState(() => _isLoading = true);
    await PostHogService.capture('phone_entered', properties: {
      'is_sign_up': widget.isSignUp.toString(),
    });
    try {
      final referralCode = _referralController.text.trim();
      await ref.read(authRepositoryProvider).sendOtp(
            digits,
            referralCode: referralCode.isNotEmpty ? referralCode : null,
          );
      await PostHogService.capture('otp_requested', properties: {
        'has_referral': (referralCode.isNotEmpty).toString(),
        'is_sign_up': widget.isSignUp.toString(),
      });
      if (mounted) {
        widget.onNext
            ?.call(digits, referralCode.isNotEmpty ? referralCode : null);
      }
    } catch (e, stack) {
      logError('[LoginScreen] Error in sendOtp: $e',
          error: e, stackTrace: stack);
      PostHogService.captureError(e, null, reason: 'otp_request_failed');
      if (mounted) {
        String errorMsg = AppLocalizations.of(context)?.txtloginNetworkError ??
            'Unable to send OTP. Please check your network connection.';
        if (e is ApiException) {
          errorMsg = e.message;
        } else if (!kReleaseMode || AppConfig.flavor != Flavor.production) {
          errorMsg = '$e';
        }
        Toast.error(context, errorMsg);
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.of(context).surface,
      body: Stack(
        children: [
          _buildAmbientGlow(),
          Positioned.fill(
            child: SafeArea(
              child: SingleChildScrollView(
                padding: EdgeInsets.fromLTRB(
                    32, 24, 32, MediaQuery.of(context).padding.bottom + 120),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const SizedBox(height: 48),
                    _buildLogoSection(),
                    const SizedBox(height: 64),
                    _buildWelcomeSection(),
                    const SizedBox(height: 32),
                    PhoneEntryWidget(
                      entryController: _entryCtrl,
                      onPhoneChanged: (_) {
                        if (mounted) setState(() {}); // refresh _canSubmit
                      },
                      onPhoneSubmitted: _handleLogin,
                      phoneController: _phoneController,
                      referralController: _referralController,
                      autoFocus: true,
                    ),
                    const SizedBox(height: 32),
                    OtpTriggerWidget(
                      canSubmit: _canSubmit,
                      isLoading: _isLoading,
                      onPressed: _handleLogin,
                    ),
                  ],
                ),
              ),
            ),
          ),
          Positioned(
            bottom: 0,
            left: 0,
            right: 0,
            child: LoginFooter(
              entryController: _entryCtrl,
              onLaunchUrl: _launchUrl,
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
                          color: AppColors.primary.withValues(alpha: 0.2),
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
                const SizedBox(height: 24),
                Text(
                  'Voltium',
                  style: AppTypography.headingLarge.copyWith(
                      color: AppColors.of(context).onSurface,
                      letterSpacing: -0.5,
                      height: 1.2),
                ),
                const SizedBox(height: 8),
                ExcludeSemantics(
                  child: Text(
                    // LANGUAGE-AUDIT (2026-08-16) #5: hardcoded
                    // English tagline. Localised via the existing
                    // `txtsplashTagline` ARB key (the splash and the
                    // login screen share the same tagline, so a
                    // single key serves both).
                    AppLocalizations.of(context)?.txtsplashTagline ??
                        'Electric scooter rentals',
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
                AppLocalizations.of(context)?.txtwelcome ?? 'Welcome',
                style: AppTypography.headingSmall.copyWith(
                    color: AppColors.of(context).onSurface,
                    letterSpacing: -0.5),
              ),
              const SizedBox(height: 8),
              Text(
                AppLocalizations.of(context)?.txtloginWelcomeSubtitle ??
                    'Enter your mobile number to get started with seamless electric mobility.',
                style: AppTypography.bodyMedium.copyWith(
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
}
