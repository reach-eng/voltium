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
    this.slotHeight = 64,
    this.spacing = 8,
  });

  @override
  UnderlineOtpInputState createState() => UnderlineOtpInputState();
}

class UnderlineOtpInputState extends State<UnderlineOtpInput> {
  late final TextEditingController _controller;
  late final FocusNode _focusNode;
  String _error = '';

  /// The full concatenated OTP value (e.g., "123456").
  String get value => _controller.text;

  /// Whether all digit slots are filled.
  bool get isComplete => _controller.text.length == widget.length;

  /// Clear all digits and refocus.
  void clear() {
    _controller.clear();
    _focusNode.requestFocus();
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
    _focusNode = FocusNode();

    if (widget.autoFocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) _focusNode.requestFocus();
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    _focusNode.dispose();
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
          onTap: () => _focusNode.requestFocus(),
          child: SizedBox(
            key: const Key('otpInputRow'),
            height: widget.slotHeight,
            child: Stack(
              alignment: Alignment.center,
              children: [
                // Visual underline slots (behind the transparent text field).
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
                // Invisible TextField that captures the actual keystrokes.
                // Transparent so the underline slots above show through.
                Opacity(
                  opacity: 0.0,
                  child: TextField(
                    controller: _controller,
                    focusNode: _focusNode,
                    keyboardType: TextInputType.number,
                    maxLength: widget.length,
                    autocorrect: false,
                    enableSuggestions: false,
                    textAlign: TextAlign.center,
                    cursorWidth: 0, // we render our own cursor in the slot
                    showCursor: false,
                    inputFormatters: [
                      FilteringTextInputFormatter.digitsOnly,
                      LengthLimitingTextInputFormatter(widget.length),
                    ],
                    onChanged: _onChanged,
                    style: AppTypography.headingMedium
                        .copyWith(color: AppColors.onSurface),
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
                    Text(
                      widget.character,
                      style: AppTypography.headingLarge
                          .copyWith(color: AppColors.onSurface),
                    ),
                  if (isActive)
                    FadeTransition(
                      opacity: _cursorCtrl,
                      child: Container(
                        width: 2,
                        height: widget.height * 0.45,
                        decoration: BoxDecoration(
                          color: AppColors.primary,
                          borderRadius: BorderRadius.circular(1),
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
                borderRadius: BorderRadius.circular(1),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
