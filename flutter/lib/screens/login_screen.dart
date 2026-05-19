import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:url_launcher/url_launcher.dart';
import '../main.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';
import '../utils/phone_validator.dart';
import '../utils/accessibility.dart';

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

class LoginScreen extends StatefulWidget {
  final Function(String)? onNext;
  final bool isSignUp;

  const LoginScreen({super.key, this.onNext, this.isSignUp = false});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen>
    with SingleTickerProviderStateMixin {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _referralController = TextEditingController();
  final FocusNode _phoneFocusNode = FocusNode();
  bool _isLoading = false;
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
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 800),
    );
    _entryCtrl.forward();
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _referralController.dispose();
    _phoneFocusNode.dispose();
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
    final digits = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    final error = PhoneValidator.validate(digits);
    if (error != null) {
      setState(() => _phoneError = error);
      return;
    }

    setState(() => _isLoading = true);
    try {
      final referralCode = _referralController.text.trim();
      final response = await ApiService().sendOtp(
        phone: digits,
        referralCode: referralCode.isNotEmpty ? referralCode : null,
      );
      if (mounted) {
        if (response['success'] == true) {
          widget.onNext?.call(digits);
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(
              content: Text(response['message'] ?? 'Failed to send OTP'),
              behavior: SnackBarBehavior.floating,
            ),
          );
        }
      }
    } catch (e) {
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
      backgroundColor: AppColors.surfaceAlt, // #F5F7FA
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
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

              const SizedBox(height: 32),

              // Footer terms
              _buildFooterTerms(),

              const SizedBox(height: 24),
            ],
          ),
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
                      boxShadow: const [
                        BoxShadow(
                          color: Color(0x331B60DA),
                          blurRadius: 20,
                          offset: Offset(0, 8),
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
                  style: GoogleFonts.inter(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: AppColors.onSurface,
                    letterSpacing: -0.5,
                    height: 1.2,
                  ),
                ),
                const SizedBox(height: 8),
                ExcludeSemantics(
                  child: Text(
                    'Manage your journey with precision.',
                    style: GoogleFonts.inter(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: AppColors.onSurfaceVariant,
                      height: 1.4,
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

  Widget _buildWelcomeSection() {
    return SlideTransition(
      position: Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero)
          .animate(CurvedAnimation(
              parent: _entryCtrl,
              curve: const Interval(0.1, 0.8, curve: Curves.easeOutCubic))),
      child: FadeTransition(
        opacity: CurvedAnimation(
            parent: _entryCtrl, curve: const Interval(0.1, 0.7)),
        child: Semantics(
          label: 'Welcome section with instructions',
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Welcome',
                style: GoogleFonts.inter(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: AppColors.onSurface,
                  letterSpacing: -0.5,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                'Enter the registered phone number to login or enter a new number to create another account.',
                style: GoogleFonts.inter(
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
      position: Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero)
          .animate(CurvedAnimation(
              parent: _entryCtrl,
              curve: const Interval(0.2, 0.9, curve: Curves.easeOutCubic))),
      child: FadeTransition(
        opacity: CurvedAnimation(
            parent: _entryCtrl, curve: const Interval(0.2, 0.8)),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              height: 56,
              decoration: BoxDecoration(
                color: _phoneError != null
                    ? const Color(0xFFFFF1F1)
                    : AppColors.inputBackground,
                borderRadius: BorderRadius.circular(999),
                border: _phoneError != null
                    ? Border.all(color: const Color(0xFFEF4444), width: 1.5)
                    : null,
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
                              style: GoogleFonts.inter(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w700,
                                  color: AppColors.onSurface),
                            ),
                          ),
                        ),
                        Container(width: 1, height: 20, color: AppColors.divider),
                        const SizedBox(width: 12),
                      ],
                    ),
                  ),
                  Expanded(
                    child: TextField(
                      key: const Key('phoneInput'),
                      controller: _phoneController,
                      focusNode: _phoneFocusNode,
                      keyboardType: TextInputType.phone,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(10),
                      ],
                      onChanged: _onPhoneChanged,
                      onSubmitted: (_) => _handleLogin(),
                      style: GoogleFonts.inter(
                        fontSize: 16,
                        fontWeight: FontWeight.w600,
                        color: AppColors.onSurface,
                        letterSpacing: 1.5,
                      ),
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        filled: false,
                        hintText: '00000 00000',
                        hintStyle: GoogleFonts.inter(
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
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: const Color(0xFFDC2626),
                      fontWeight: FontWeight.w500,
                    ),
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
      position: Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero)
          .animate(CurvedAnimation(
              parent: _entryCtrl,
              curve: const Interval(0.25, 0.95, curve: Curves.easeOutCubic))),
      child: FadeTransition(
        opacity: CurvedAnimation(
            parent: _entryCtrl, curve: const Interval(0.25, 0.85)),
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.inputBackground,
            borderRadius: BorderRadius.circular(999),
          ),
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
                child: TextField(
                  key: const Key('referralInput'),
                  controller: _referralController,
                  textCapitalization: TextCapitalization.characters,
                  style: GoogleFonts.inter(
                    fontSize: 14,
                    fontWeight: FontWeight.w600,
                    color: AppColors.onSurface,
                  ),
                  decoration: InputDecoration(
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: false,
                    hintText: 'Referral Code (Optional)',
                    hintStyle: GoogleFonts.inter(
                      fontSize: 14,
                      color: AppColors.onSurfaceDisabled,
                      fontWeight: FontWeight.w400,
                    ),
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ),
            ],
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
        const SizedBox(width: 8),
        Text(
          'A SECURE OTP WILL BE SENT',
          style: GoogleFonts.inter(
            fontSize: 11,
            fontWeight: FontWeight.w800,
            letterSpacing: 1.2,
            color: AppColors.onSurfaceVariant,
          ),
        ),
      ],
    );
  }

  Widget _buildEnterButton() {
    return Semantics(
      button: true,
      label: 'Send OTP',
      child: Focus(
        child: GestureDetector(
          key: const Key('sendOtpButton'),
          behavior: HitTestBehavior.opaque,
          onTap: VoltiumApp.isTestMode
              ? _handleLogin
              : (_canSubmit ? _handleLogin : null),
          child: AnimatedOpacity(
            opacity: _canSubmit ? 1.0 : 0.4,
            duration: const Duration(milliseconds: 200),
            child: Container(
              width: double.infinity,
              height: 56,
              decoration: BoxDecoration(
                gradient: AppGradients.primary,
                borderRadius: BorderRadius.circular(999),
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
                        style: GoogleFonts.inter(
                          fontSize: 15,
                          fontWeight: FontWeight.w700,
                          color: Colors.white,
                        ),
                      ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFooterTerms() {
    return Center(
      child: FadeTransition(
        opacity: CurvedAnimation(
            parent: _entryCtrl, curve: const Interval(0.5, 1.0)),
        child: RichText(
          textAlign: TextAlign.center,
          text: TextSpan(
            style: GoogleFonts.inter(
              fontSize: 12,
              color: AppColors.onSurfaceVariant,
              height: 1.6,
            ),
            children: [
              const TextSpan(text: 'By signing in, you agree to our\n'),
              WidgetSpan(
                child: GestureDetector(
                  onTap: () => _launchUrl('https://voltium.in/terms'),
                  child: Text(
                    'Terms of Service',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
              TextSpan(
                  text: ' and ',
                  style: GoogleFonts.inter(
                      fontSize: 12, color: AppColors.onSurfaceVariant)),
              WidgetSpan(
                child: GestureDetector(
                  onTap: () => _launchUrl('https://voltium.in/privacy'),
                  child: Text(
                    'Privacy Policy',
                    style: GoogleFonts.inter(
                      fontSize: 12,
                      color: AppColors.primary,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
