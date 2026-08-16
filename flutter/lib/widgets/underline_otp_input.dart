import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// Apple/Google-style OTP input: a single full-width text field with N
/// underline slots rendered behind it. Tap anywhere on the row to focus;
/// entering a digit auto-advances the visual cursor. Haptic feedback on
/// every digit (matches `SparkOtpInput`).
///
/// Drop-in replacement for `SparkOtpInput` — same public surface
/// (`length`, `onCompleted`, `onChanged`, `autoFocus`, `value`, `isComplete`,
/// `clear`, `setError`). Preserves the `Key('otpInputRow')` that the E2E
/// integration tests look for.
class UnderlineOtpInput extends StatefulWidget {
  final int length;
  final ValueChanged<String> onCompleted;
  final ValueChanged<String>? onChanged;
  final bool autoFocus;

  /// Width of each underline slot.
  final double slotWidth;

  /// Height reserved for the slot row (text + underline + breathing room).
  final double slotHeight;

  /// Gap between slots.
  final double spacing;

  const UnderlineOtpInput({
    super.key,
    this.length = 6,
    required this.onCompleted,
    this.onChanged,
    this.autoFocus = true,
    this.slotWidth = 44,
    this.slotHeight = 56,
    this.spacing = 10,
  });

  @override
  UnderlineOtpInputState createState() => UnderlineOtpInputState();
}

class UnderlineOtpInputState extends State<UnderlineOtpInput> {
  late final TextEditingController _controller;
  // ONBOARDING-AUDIT 2026-08-14 P0-2: the previous implementation
  // supplied a custom `FocusNode` to the inner TextField. On this
  // device, that left the EditableText's internal IME connection
  // un-initialised — the system engaged the IME with an empty
  // `EditorInfo{inputType=0, …}` and hid it immediately
  // (`HIDE_SAME_WINDOW_FOCUSED_WITHOUT_EDITOR`). The canonical fix
  // (mirrored from `phone_entry_widget.dart`) is to let the
  // TextField own its own focus node and use `autofocus: true`.
  Timer? _keyboardTimer;
  String _error = '';

  /// The full concatenated OTP value (e.g., "123456").
  String get value => _controller.text;

  /// Whether all digit slots are filled.
  bool get isComplete => _controller.text.length == widget.length;

  /// Clear all digits and refocus.
  void clear() {
    _controller.clear();
    SystemChannels.textInput.invokeMethod('TextInput.show');
    setState(() {});
  }

  /// Set an error message displayed below the OTP row.
  void setError(String error) {
    setState(() => _error = error);
  }

  @override
  void initState() {
    super.initState();
    _controller = TextEditingController();

    if (widget.autoFocus) {
      // Defer the IME show until the field has had a chance to mount
      // and the framework has wired up its internal EditableText. We
      // can't reach into the field's own focus node (we deliberately
      // don't own it anymore), so we just ask the system to surface
      // the IME — the focused TextField will pick it up.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _keyboardTimer = Timer(const Duration(milliseconds: 300), () {
            if (mounted) {
              SystemChannels.textInput.invokeMethod('TextInput.show');
            }
          });
        }
      });
    }
  }

  @override
  void dispose() {
    _keyboardTimer?.cancel();
    _controller.dispose();
    super.dispose();
  }

  void _onChanged(String value) {
    // The two `inputFormatters` on the TextField (digitsOnly + LengthLimiting)
    // already enforce the contract; `_onChanged` only runs after they've
    // been applied. We still defensively strip non-digits for IME composition
    // edge cases, but we do NOT truncate here — truncation belongs to the
    // inputFormatter layer.
    final sanitized = value.replaceAll(RegExp(r'\D'), '');
    if (sanitized != value) {
      _controller.value = TextEditingValue(
        text: sanitized,
        selection: TextSelection.collapsed(offset: sanitized.length),
      );
    }

    // Haptic on every new digit (not on delete).
    if (sanitized.length > _priorLength) {
      HapticFeedback.lightImpact();
    }
    _priorLength = sanitized.length;

    widget.onChanged?.call(sanitized);

    if (sanitized.length == widget.length) {
      widget.onCompleted(sanitized);
    }

    setState(() {});
  }

  int _priorLength = 0;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final hasError = _error.isNotEmpty;
    final filled = _controller.text.length;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            // ONBOARDING-AUDIT 2026-08-14 P0-2: we no longer hold a
            // custom FocusNode. Asking the system to surface the IME
            // is enough — the TextField below owns its own focus and
            // will pick up the input.
            SystemChannels.textInput.invokeMethod('TextInput.show');
          },
          child: SizedBox(
            key: const Key('otpInputRow'),
            height: widget.slotHeight,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Visual underline slots (behind the text field).
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  crossAxisAlignment: CrossAxisAlignment.center,
                  children: List.generate(widget.length, (index) {
                    final isActive = index == filled && !hasError;
                    final isFilled = index < filled;
                    return _UnderlineSlot(
                      key: ValueKey('underline_otp_$index'),
                      width: widget.slotWidth,
                      height: widget.slotHeight,
                      spacing: widget.spacing,
                      character: isFilled ? _controller.text[index] : '',
                      isActive: isActive,
                      isFilled: isFilled,
                      hasError: hasError,
                      isDark: isDark,
                    );
                  }),
                ),
                // ONBOARDING-AUDIT 2026-08-14 P0-2: this is now a real
                // TextField (no Opacity wrapper, no custom focusNode,
                // cursor visible). The IME connection initialises
                // correctly because the framework owns the focus node.
                // The digits are visually hidden by a transparent
                // text color so the underline slots above still show
                // through; the field is also `filled: true` with a
                // transparent fill so it covers the slot row for hit
                // testing.
                TextField(
                  controller: _controller,
                  autofocus: widget.autoFocus,
                  keyboardType: TextInputType.number,
                  maxLength: widget.length,
                  autocorrect: false,
                  enableSuggestions: false,
                  textAlign: TextAlign.center,
                  // Keep the cursor visible (don't hide it via
                  // cursorWidth: 0 / showCursor: false) — those
                  // flags were part of the IME regression. The
                  // transparent text + transparent fill make the
                  // cursor invisible enough for the visual design.
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(widget.length),
                  ],
                  onChanged: _onChanged,
                  style: AppTypography.headingMedium.copyWith(
                    color: Colors.transparent,
                  ),
                  decoration: const InputDecoration(
                    counterText: '',
                    border: InputBorder.none,
                    enabledBorder: InputBorder.none,
                    focusedBorder: InputBorder.none,
                    filled: true,
                    fillColor: Colors.transparent,
                    contentPadding: EdgeInsets.zero,
                  ),
                ),
              ],
            ),
          ),
        ),
        if (hasError)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              _error,
              style: AppTypography.bodySmall.copyWith(
                color: AppColors.error,
              ),
            ),
          ),
      ],
    );
  }
}

/// A single underline slot. Renders the entered character (if any), a
/// blinking cursor when active, and a 2px underline that changes color
/// based on state (active / filled / unfocused / error).
class _UnderlineSlot extends StatefulWidget {
  final double width;
  final double height;
  final double spacing;
  final String character;
  final bool isActive;
  final bool isFilled;
  final bool hasError;
  final bool isDark;

  const _UnderlineSlot({
    super.key,
    required this.width,
    required this.height,
    required this.spacing,
    required this.character,
    required this.isActive,
    required this.isFilled,
    required this.hasError,
    required this.isDark,
  });

  @override
  State<_UnderlineSlot> createState() => _UnderlineSlotState();
}

class _UnderlineSlotState extends State<_UnderlineSlot>
    with SingleTickerProviderStateMixin {
  late final AnimationController _cursorCtrl;

  @override
  void initState() {
    super.initState();
    _cursorCtrl = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1100),
    )..repeat(reverse: true);
  }

  @override
  void dispose() {
    _cursorCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final hasError = widget.hasError;
    final isActive = widget.isActive;
    final isFilled = widget.isFilled;

    final Color underlineColor;
    if (hasError) {
      underlineColor = AppColors.error;
    } else if (isActive) {
      underlineColor = AppColors.primary;
    } else if (isFilled) {
      underlineColor = AppColors.primary;
    } else {
      underlineColor = AppColors.outlineVariant;
    }

    return Padding(
      padding: EdgeInsets.symmetric(horizontal: widget.spacing / 2),
      child: SizedBox(
        width: widget.width,
        height: widget.height,
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            // Character + cursor area
            SizedBox(
              height: widget.height * 0.65,
              child: Stack(
                alignment: Alignment.center,
                children: [
                  if (isFilled)
                    // DARK-MODE-AUDIT 2026-08-14 P0-3: the previous
                    // version used the static `AppColors.onSurface`,
                    // which is `#101828` (light-mode body text). In
                    // dark mode the value never resolved to the
                    // dark palette and the digit was 1.01:1 against
                    // the dark surface — completely invisible.
                    // Read via the theme extension so the digit
                    // colour tracks the active palette.
                    Text(
                      widget.character,
                      style: AppTypography.headingLarge.copyWith(
                        color: AppColors.of(context).onSurface,
                      ),
                    ),
                  if (isActive)
                    FadeTransition(
                      opacity: _cursorCtrl,
                      child: Container(
                        width: 2,
                        height: widget.height * 0.45,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(AppRadius.xxs),
                        ),
                      ),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 8),
            // Underline
            AnimatedContainer(
              duration: const Duration(milliseconds: 180),
              height: hasError || isActive || isFilled ? 2.5 : 1.5,
              decoration: BoxDecoration(
                color: underlineColor,
                borderRadius: BorderRadius.circular(AppRadius.xxs),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
