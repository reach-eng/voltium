import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/phone_validator.dart';

/// Phone-entry block for [LoginScreen]: phone input + referral input +
/// "A secure OTP will be sent" note. Owns its own focus nodes + change
/// validation. Staggered slide-in animation driven by the parent's
/// [AnimationController] so the entry sequence stays in sync with the
/// rest of the screen.
///
/// The widget is intentionally presentational: the parent owns the
/// submission lifecycle, loading state, and OTP send. The widget just
/// reports phone text changes + final values.
class PhoneEntryWidget extends StatefulWidget {
  /// AnimationController from the parent. Used to drive staggered
  /// slide-in/fade-in for each sub-section.
  final AnimationController entryController;

  /// Called whenever the phone text changes (after digits-only filter).
  /// Use this to surface inline validation errors.
  final ValueChanged<String> onPhoneChanged;

  /// Called when the user taps the system "Done" / submit key on the
  /// phone field. The shell handles submission.
  final VoidCallback onPhoneSubmitted;

  /// Optional controller for the phone field, owned by the parent if it
  /// needs to read the value at submit time.
  final TextEditingController? phoneController;

  /// Optional controller for the referral field, owned by the parent if
  /// it needs to read the value at submit time.
  final TextEditingController? referralController;

  /// If true, the phone field requests focus on the first build.
  /// Defaults to false; the parent typically drives focus from its
  /// own [AnimationController] completion handler.
  final bool autoFocus;

  const PhoneEntryWidget({
    super.key,
    required this.entryController,
    required this.onPhoneChanged,
    required this.onPhoneSubmitted,
    this.phoneController,
    this.referralController,
    this.autoFocus = false,
  });

  @override
  State<PhoneEntryWidget> createState() => _PhoneEntryWidgetState();
}

class _PhoneEntryWidgetState extends State<PhoneEntryWidget> {
  late final TextEditingController _phoneController;
  late final TextEditingController _referralController;
  final FocusNode _phoneFocusNode = FocusNode();
  final FocusNode _referralFocusNode = FocusNode();
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    _phoneController = widget.phoneController ?? TextEditingController();
    _referralController = widget.referralController ?? TextEditingController();
    if (widget.autoFocus) {
      // Defer to post-frame so the input is in the tree before we ask for focus.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _phoneFocusNode.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    // Only dispose controllers we own.
    if (widget.phoneController == null) _phoneController.dispose();
    if (widget.referralController == null) _referralController.dispose();
    _phoneFocusNode.dispose();
    _referralFocusNode.dispose();
    super.dispose();
  }

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
    widget.onPhoneChanged(value);
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildPhoneInput(),
        const SizedBox(height: Spacing.md),
        _buildReferralInput(),
        const SizedBox(height: Spacing.md),
        _buildOtpNote(),
      ],
    );
  }

  Widget _buildPhoneInput() {
    return SlideTransition(
      position:
          Tween<Offset>(begin: const Offset(0, 0.3), end: Offset.zero).animate(
        CurvedAnimation(
          parent: widget.entryController,
          curve: const Interval(0.2, 0.9, curve: Curves.easeOutCubic),
        ),
      ),
      child: FadeTransition(
        opacity: CurvedAnimation(
          parent: widget.entryController,
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
                      onFieldSubmitted: (_) => widget.onPhoneSubmitted(),
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
          parent: widget.entryController,
          curve: const Interval(0.25, 0.95, curve: Curves.easeOutCubic),
        ),
      ),
      child: FadeTransition(
        opacity: CurvedAnimation(
          parent: widget.entryController,
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
                    style: AppTypography.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(color: AppColors.onSurface),
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      filled: true,
                      fillColor: Colors.transparent,
                      hintText: 'Referral Code (Optional)',
                      hintStyle: AppTypography.bodyMedium
                          .copyWith(color: AppColors.onSurfaceMuted)
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
        const SizedBox(width: 8),
        Text(
          'A secure OTP will be sent',
          style: AppTypography.bodySmall
              .copyWith(fontWeight: FontWeight.w800)
              .copyWith(letterSpacing: 1.2, color: AppColors.onSurfaceVariant),
        ),
      ],
    );
  }
}
