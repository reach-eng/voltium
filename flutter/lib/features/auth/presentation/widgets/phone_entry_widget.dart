import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/haptic_service.dart';
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
  // NOTE: we intentionally let the TextFormField own its own focus node
  // instead of providing one explicitly. On this device, supplying
  // `focusNode: customNode` to the field left the EditableText's internal
  // IME connection un-initialised — the system engaged the IME with an
  // empty `EditorInfo{inputType=0, inputTypeString=NULL, …}` and hid it
  // immediately (`HIDE_SAME_WINDOW_FOCUSED_WITHOUT_EDITOR`). Letting the
  // field manage its own focus + `autofocus: true` is the canonical fix.
  final FocusNode _referralFocusNode = FocusNode();
  String? _phoneError;

  @override
  void initState() {
    super.initState();
    _phoneController = widget.phoneController ?? TextEditingController();
    _referralController = widget.referralController ?? TextEditingController();
    // ONBOARDING-AUDIT 2026-09-04 (user-reported, A063 + future): the
    // A063 device has only Google Voice Typing installed by default;
    // LatinIME/AOSP is on disk but disabled. Even after enabling
    // LatinIME, the soft IME on this device is not always raised
    // reliably when the TextField requests focus — the IME state
    // `mInputShown` stayed false on the device. The previous
    // fix (PR 2026-08-12) removed the custom focusNode to let the
    // TextField own its own + `autofocus: true`. The 2026-08-14
    // audit removed a 300ms `Future.delayed` as fragile. The
    // 2026-09-04 d0ad78e3 commit added a post-frame TextInput.show.
    // None of these worked on this device.
    //
    // The actual fix: make the field read-only so the OS IME is never
    // requested, and ship an in-app number pad for digit input. The
    // pad writes to the same _phoneController, so the rest of the
    // flow (validator, send-otp, onPhoneSubmitted) works unchanged.
    // This works on every device regardless of IME state.
  }

  /// Add a digit to the phone controller, respecting the 10-digit cap
  /// and the existing digits-only + length limiters. Called by the
  /// in-app number pad below the phone field.
  void _appendPhoneDigit(String digit) {
    final current = _phoneController.text;
    if (current.length >= 10) return;
    final next = (current + digit).replaceAll(RegExp(r'\D'), '');
    if (next.length > 10) return;
    _phoneController.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: next.length),
    );
    _onPhoneChanged(next);
  }

  /// Remove the last digit. Called by the in-app backspace button.
  void _popPhoneDigit() {
    final current = _phoneController.text;
    if (current.isEmpty) return;
    final next = current.substring(0, current.length - 1);
    _phoneController.value = TextEditingValue(
      text: next,
      selection: TextSelection.collapsed(offset: next.length),
    );
    _onPhoneChanged(next);
  }

  @override
  void dispose() {
    // Only dispose controllers we own.
    if (widget.phoneController == null) _phoneController.dispose();
    if (widget.referralController == null) _referralController.dispose();
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
        const SizedBox(height: Spacing.md),
        _buildNumberPad(),
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
                  GestureDetector(
                    behavior: HitTestBehavior.translucent,
                    // No-op: the field is read-only. We deliberately do
                    // NOT call SystemChannels.textInput.invokeMethod
                    // here because the OS IME may not be available
                    // (the A063 test device ships with only Voice Typing
                    // by default). The in-app pad below the field is
                    // the only input path.
                    onTap: () {},
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
                      // ONBOARDING-AUDIT 2026-09-04: read-only because the
                      // OS IME is unreliable on test devices that ship
                      // without a soft keyboard (e.g. A063 default IME =
                      // Google Voice Typing). The in-app number pad
                      // below the field is the only input path.
                      readOnly: true,
                      showCursor: true,
                      keyboardType: TextInputType.phone,
                      textInputAction: TextInputAction.done,
                      autofillHints: const [AutofillHints.telephoneNumber],
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                        LengthLimitingTextInputFormatter(10),
                      ],
                      onChanged: _onPhoneChanged,
                      onTap: () {
                        // No-op: the field is read-only. We deliberately
                        // do NOT call SystemChannels.textInput.invokeMethod
                        // here because (a) the OS IME may not be available
                        // and (b) the in-app pad handles all input.
                      },
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
            behavior: HitTestBehavior.opaque,
            onTap: () {
              _referralFocusNode.requestFocus();
              SystemChannels.textInput.invokeMethod('TextInput.show');
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
                      SystemChannels.textInput.invokeMethod('TextInput.show');
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

  /// In-app 3x4 number pad. ONBOARDING-AUDIT 2026-09-04: shipped because
  /// the OS IME is unreliable on test devices that ship without a
  /// soft keyboard (the A063 ships with Google Voice Typing as the
  /// only active IME, and even after enabling LatinIME, the soft
  /// keyboard on that device is not always raised on TextField focus).
  /// Writing to `_phoneController` keeps the rest of the flow
  /// (validator, send-otp, onPhoneSubmitted) unchanged.
  ///
  /// Each key fires a HapticService.lightImpact() so the rider gets
  /// tactile feedback equivalent to a real keyboard.
  Widget _buildNumberPad() {
    return _NumberPad(
      onDigit: (d) {
        HapticService.selection();
        _appendPhoneDigit(d);
      },
      onBackspace: () {
        HapticService.selection();
        _popPhoneDigit();
      },
      backspaceEnabled: _phoneController.text.isNotEmpty,
    );
  }
}

/// 3x4 number pad widget. Pure presentation, no state of its own.
class _NumberPad extends StatelessWidget {
  final void Function(String digit) onDigit;
  final VoidCallback onBackspace;
  final bool backspaceEnabled;

  const _NumberPad({
    required this.onDigit,
    required this.onBackspace,
    required this.backspaceEnabled,
  });

  @override
  Widget build(BuildContext context) {
    // Layout: 3 columns x 4 rows. Row 0: 1,2,3. Row 1: 4,5,6. Row 2:
    // 7,8,9. Row 3: blank, 0, backspace. The blank gives the phone
    // numpad its familiar staggered layout (Apple-style).
    final keys = <List<_KeyDef>>[
      [
        _KeyDef.digit('1'),
        _KeyDef.digit('2'),
        _KeyDef.digit('3'),
      ],
      [
        _KeyDef.digit('4'),
        _KeyDef.digit('5'),
        _KeyDef.digit('6'),
      ],
      [
        _KeyDef.digit('7'),
        _KeyDef.digit('8'),
        _KeyDef.digit('9'),
      ],
      [
        _KeyDef.blank(),
        _KeyDef.digit('0'),
        _KeyDef.backspace(),
      ],
    ];

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final keyBg = isDark ? const Color(0xFF1F2937) : const Color(0xFFF3F4F6);
    final keyFg = AppColors.of(context).onSurface;
    final keyDisabled = keyFg.withValues(alpha: 0.25);

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        for (final row in keys)
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Row(
              children: [
                for (final k in row) ...[
                  Expanded(
                    child: k.isBlank
                        ? const SizedBox(height: 56)
                        : _PadKey(
                            label: k.label,
                            icon: k.icon,
                            onTap: k.isBackspace
                                ? onBackspace
                                : () => onDigit(k.label ?? ''),
                            enabled: k.isBackspace ? backspaceEnabled : true,
                            background: keyBg,
                            foreground: k.isBackspace && !backspaceEnabled
                                ? keyDisabled
                                : keyFg,
                          ),
                  ),
                  if (k != row.last) const SizedBox(width: 8),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _KeyDef {
  final String? label;
  final IconData? icon;
  final bool isBackspace;
  final bool isBlank;

  const _KeyDef._(this.label, this.icon, this.isBackspace, this.isBlank);

  const _KeyDef.digit(String d) : this._(d, null, false, false);
  const _KeyDef.backspace()
      : this._(null, Icons.backspace_outlined, true, false);
  const _KeyDef.blank() : this._(null, null, false, true);
}

class _PadKey extends StatelessWidget {
  final String? label;
  final IconData? icon;
  final VoidCallback onTap;
  final bool enabled;
  final Color background;
  final Color foreground;

  const _PadKey({
    required this.label,
    required this.icon,
    required this.onTap,
    required this.enabled,
    required this.background,
    required this.foreground,
  });

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: enabled ? onTap : null,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          height: 56,
          alignment: Alignment.center,
          decoration: BoxDecoration(
            color: background,
            borderRadius: BorderRadius.circular(AppRadius.md),
          ),
          child: icon != null
              ? Icon(icon, color: foreground, size: 22)
              : Text(
                  label ?? '',
                  style: AppTypography.titleLarge.copyWith(
                    color: foreground,
                    fontWeight: FontWeight.w600,
                  ),
                ),
        ),
      ),
    );
  }
}
