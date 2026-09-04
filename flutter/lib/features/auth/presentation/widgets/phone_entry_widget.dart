import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
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
  // The phone field has its own explicit focus node so the +91 prefix
  // (which lives in a sibling GestureDetector) can route a tap into
  // the same focus target without having to reach into the field's
  // internal node. The post-frame `requestFocus` in initState fires
  // AFTER the field's `EditorInfo` is fully wired (keyboardType,
  // textInputAction, autofillHints, inputFormatters are all in scope
  // by then) — that's the key thing the older d0ad78e3 comment was
  // warning about. A pre-frame `requestFocus` would land on an
  // empty EditorInfo and the platform would hide the keyboard
  // immediately via `HIDE_SAME_WINDOW_FOCUSED_WITHOUT_EDITOR`. The
  // post-frame timing avoids that race; the parent login screen's
  // 800ms entry animation is irrelevant to this — by the time the
  // first post-frame fires, the EditableText is mounted and its
  // IME connection is set up.
  final FocusNode _phoneFocusNode = FocusNode(debugLabel: 'phone');
  final FocusNode _referralFocusNode = FocusNode(debugLabel: 'referral');
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    _phoneController = widget.phoneController ?? TextEditingController();
    _referralController = widget.referralController ?? TextEditingController();
    // Respect the `autoFocus` contract. When true, focus the phone
    // field after the first frame so the EditableText's IME
    // connection is fully wired. When false, the parent has decided
    // not to auto-focus (e.g. user is mid-flow on another screen)
    // and the field must not steal focus.
    if (widget.autoFocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (!mounted) return;
        _phoneFocusNode.requestFocus();
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
      // PR-ONBOARDING-FLOW-2026-08-13: PhoneValidator.validate is the
      // single source of truth for phone validation — it covers
      // required, digits-only, length, and prefix (6-9). The
      // previous in-line checks duplicated the rules and produced
      // different error messages at different lengths ("must start
      // with 6-9" while typing, "must be 10 digits" at length 10),
      // which was confusing. Now: empty input is silently cleared
      // (the rider is mid-typing); every other state goes through
      // the validator.
      final digits = value.replaceAll(RegExp(r'\D'), '');
      if (digits.isEmpty) {
        _phoneError = null;
      } else {
        _phoneError = PhoneValidator.validate(digits);
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
                    ? AppColors.of(context).errorLight
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
                  // The +91 prefix is a visual marker, but a tap on
                  // it should still focus the phone field — riders
                  // intuitively tap the country code first. The focus
                  // request goes through the Flutter focus chain
                  // (`_phoneFocusNode.requestFocus()`), not the
                  // platform IME channel; the platform's IME service
                  // follows the focus change naturally.
                  GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    onTap: () {
                      _phoneFocusNode.requestFocus();
                    },
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        ExcludeSemantics(
                          child: Padding(
                            padding: const EdgeInsets.only(left: 24, right: 12),
                            child: Text(
                              '+91',
                              style: AppTypography.titleSmall.copyWith(
                                  color: AppColors.of(context).onSurface),
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
                      // `autofocus: false` so the field does not
                      // request focus on the first build — that race
                      // can land before the EditorInfo is wired. The
                      // post-frame `_phoneFocusNode.requestFocus()`
                      // in initState is the canonical timing and is
                      // gated on `widget.autoFocus`.
                      autofocus: false,
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
                          color: AppColors.of(context).onSurface,
                          letterSpacing: 1.5),
                      decoration: InputDecoration(
                        border: InputBorder.none,
                        enabledBorder: InputBorder.none,
                        focusedBorder: InputBorder.none,
                        filled: true,
                        fillColor: Colors.transparent,
                        hintText: '00000 00000',
                        hintStyle: AppTypography.bodyLarge.copyWith(
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
            // Taps on the icon/leading area delegate to the field's
            // focus node. The previous `TextInput.show` nudge here
            // bypassed the Flutter focus chain; `requestFocus` is the
            // canonical mechanism for explicit focus.
            behavior: HitTestBehavior.opaque,
            onTap: () {
              _referralFocusNode.requestFocus();
            },
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
                    inputFormatters: [
                      FilteringTextInputFormatter.allow(RegExp(r'[a-zA-Z0-9]')),
                      LengthLimitingTextInputFormatter(12),
                    ],
                    onTap: () {
                      _referralFocusNode.requestFocus();
                    },
                    style: AppTypography.bodyMedium
                        .copyWith(fontWeight: FontWeight.w600)
                        .copyWith(color: AppColors.of(context).onSurface),
                    decoration: InputDecoration(
                      border: InputBorder.none,
                      enabledBorder: InputBorder.none,
                      focusedBorder: InputBorder.none,
                      filled: true,
                      fillColor: Colors.transparent,
                      // LANGUAGE-AUDIT (2026-08-16) #5: was a
                      // hardcoded English hint. Localised via
                      // `txtloginReferralHint`.
                      hintText:
                          AppLocalizations.of(context)?.txtloginReferralHint ??
                              'Referral code (optional)',
                      // ONBOARDING-AUDIT 2026-08-14 P1-5: the
                      // previous chain had a dead first call
                      // `.copyWith(color: AppColors.of(context).onSurfaceMuted)`
                      // that was immediately overridden by the
                      // second call. Collapsed to the effective
                      // value.
                      hintStyle: AppTypography.bodyMedium
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
          AppLocalizations.of(context)?.txtloginSecureOtpNote ??
              'SECURE 6-DIGIT OTP VERIFICATION',
          style: AppTypography.bodySmall
              .copyWith(fontWeight: FontWeight.w800)
              .copyWith(letterSpacing: 1.2, color: AppColors.onSurfaceVariant),
        ),
      ],
    );
  }
}
