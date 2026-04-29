import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../services/api_service.dart';
import '../theme/app_theme.dart';

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
  bool _isLoading = false;

  late final AnimationController _entryCtrl;

  @override
  void initState() {
    super.initState();
    _entryCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 600),
    )..forward();

    _phoneController.addListener(() => setState(() {}));
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _referralController.dispose();
    _entryCtrl.dispose();
    super.dispose();
  }

  bool get _canSubmit =>
      _phoneController.text.replaceAll(RegExp(r'\D'), '').length == 10 &&
      !_isLoading;

  Future<void> _handleLogin() async {
    final digits = _phoneController.text.replaceAll(RegExp(r'\D'), '');
    if (digits.length != 10) return;

    setState(() => _isLoading = true);
    try {
      final response = await ApiService().sendOtp(phone: digits);
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
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Network error. Please try again.'),
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
      opacity: CurvedAnimation(parent: _entryCtrl, curve: const Interval(0, 0.7)),
      child: ScaleTransition(
        scale: Tween<double>(begin: 0.9, end: 1.0).animate(
          CurvedAnimation(parent: _entryCtrl, curve: Curves.easeOutCubic),
        ),
        child: Center(
          child: Column(
            children: [
              // 72×72 circle, primary blue, bolt icon
              Container(
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

              const SizedBox(height: 24),

              // Brand name
              Text(
                'Voltium',
                style: GoogleFonts.inter(
                  fontSize: 28,
                  fontWeight: FontWeight.w900,
                  color: AppColors.onSurface, // #101828
                  letterSpacing: -0.5,
                  height: 1.2,
                ),
              ),

              const SizedBox(height: 8),

              // Subtitle
              Text(
                'Manage your journey with precision.',
                style: GoogleFonts.inter(
                  fontSize: 14,
                  fontWeight: FontWeight.w500,
                  color: AppColors.onSurfaceVariant, // #475467
                  height: 1.4,
                ),
              ),
            ],
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
        child: Container(
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.inputBackground, // #E6EAEF
            borderRadius: BorderRadius.circular(999),
          ),
          child: Row(
            children: [
              // +91 prefix
              Padding(
                padding: const EdgeInsets.only(left: 24, right: 12),
                child: Text(
                  '+91',
                  style: GoogleFonts.inter(
                    fontSize: 16,
                    fontWeight: FontWeight.w700,
                    color: AppColors.onSurface,
                  ),
                ),
              ),

              // Vertical divider
              Container(width: 1, height: 20, color: AppColors.divider),

              const SizedBox(width: 12),

              // Phone number field
              Expanded(
                child: TextField(
                  key: const Key('phoneInput'),
                  controller: _phoneController,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
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
                  ),
                ),
              ),
            ],
          ),
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
    return GestureDetector(
      key: const Key('sendOtpButton'),
      onTap: _canSubmit ? _handleLogin : null,
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
                  onTap: () {},
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
                  onTap: () {},
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
