import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';

/// An animated balance counter that rolls digits like a mechanical odometer
/// when the value changes. Increases glow green, decreases glow red.
///
/// Usage:
/// ```dart
/// AnimatedBalanceCounter(
///   value: 250.50,
///   textStyle: GoogleFonts.plusJakartaSans(fontSize: 36, fontWeight: FontWeight.w800),
/// )
/// ```
class AnimatedBalanceCounter extends StatefulWidget {
  /// The current balance value in rupees (e.g., 250.50).
  final double value;

  /// Whether to show the ₹ symbol before the number.
  final bool showRupeeSymbol;

  /// Optional custom text style for the digits.
  final TextStyle? textStyle;

  /// Duration of the roll animation.
  final Duration duration;

  /// Number of decimal places to show.
  final int decimalPlaces;

  /// Whether compact mode (no commas, less spacing).
  final bool compact;

  const AnimatedBalanceCounter({
    super.key,
    required this.value,
    this.showRupeeSymbol = true,
    this.textStyle,
    this.duration = const Duration(milliseconds: 600),
    this.decimalPlaces = 0,
    this.compact = false,
  });

  @override
  State<AnimatedBalanceCounter> createState() => _AnimatedBalanceCounterState();
}

class _AnimatedBalanceCounterState extends State<AnimatedBalanceCounter>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;
  late Animation<double> _rollAnimation;
  late Animation<double> _glowAnimation;

  double _previousValue = 0;
  bool _isIncrease = true;
  bool _hasAnimated = false;

  /// Default text style if none provided (resolved in build via context).
  TextStyle _defaultStyle(BuildContext context) => GoogleFonts.plusJakartaSans(
        fontSize: widget.compact ? 28 : 36,
        fontWeight: FontWeight.w800,
        color: AppColors.of(context).onSurface,
        letterSpacing: widget.compact ? -0.5 : -1,
      );

  TextStyle _effectiveStyle(BuildContext context) =>
      (widget.textStyle ?? _defaultStyle(context)).copyWith(
        fontFeatures: const [FontFeature.tabularFigures()],
      );

  double _digitWidth(BuildContext context) {
    final tp = TextPainter(
      text: TextSpan(text: '0', style: _effectiveStyle(context)),
      textDirection: TextDirection.ltr,
    )..layout();
    return tp.width;
  }

  double _digitHeight(BuildContext context) {
    final tp = TextPainter(
      text: TextSpan(text: '0', style: _effectiveStyle(context)),
      textDirection: TextDirection.ltr,
    )..layout();
    return tp.height;
  }

  @override
  void initState() {
    super.initState();
    _previousValue = widget.value;
    _controller = AnimationController(
      vsync: this,
      duration: widget.duration,
    );
    _rollAnimation = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeInOutCubic,
    );
    _glowAnimation = CurvedAnimation(
      parent: _controller,
      curve: const Interval(0, 0.3, curve: Curves.easeOut),
    );
  }

  @override
  void didUpdateWidget(AnimatedBalanceCounter oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.value != widget.value) {
      _previousValue = oldWidget.value;
      _isIncrease = widget.value > oldWidget.value;
      _hasAnimated = true;
      _controller.forward(from: 0).then((_) {
        try {
          HapticFeedback.lightImpact();
        } catch (_) {}
      });
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return RepaintBoundary(
      child: AnimatedBuilder(
        animation: _controller,
        builder: (context, child) {
          return _buildCounter(context);
        },
      ),
    );
  }

  Widget _buildCounter(BuildContext context) {
    final animationValue = _rollAnimation.value;
    final glowValue = _glowAnimation.value;

    final formatted = _formatValue(widget.value);
    final prevFormatted = _formatValue(_previousValue);

    final effectiveStyle = _effectiveStyle(context);
    final digitW = _digitWidth(context);
    final digitH = _digitHeight(context);

    // Match digits from right-to-left
    final digitWidgets = <Widget>[];
    int prevIdx = prevFormatted.length - 1;
    for (int i = formatted.length - 1; i >= 0; i--) {
      final char = formatted[i];
      final prevChar = prevIdx >= 0 ? prevFormatted[prevIdx] : char;
      prevIdx--;

      if (char == '.') {
        digitWidgets.insert(
          0,
          Padding(
            padding: EdgeInsets.only(bottom: widget.compact ? 2 : 4),
            child: Text(char, style: effectiveStyle),
          ),
        );
      } else if (char == ',') {
        digitWidgets.insert(
          0,
          Padding(
            padding: EdgeInsets.only(
              bottom: widget.compact ? 2 : 4,
              right: 2,
              left: 2,
            ),
            child: Text(char, style: effectiveStyle),
          ),
        );
      } else if (char == ' ') {
        digitWidgets.insert(0, SizedBox(width: digitW * 0.3));
      } else if (char == '-') {
        digitWidgets.insert(0, Text('-', style: effectiveStyle));
      } else {
        final digit = int.parse(char);
        final prevDigit =
            prevChar.contains(RegExp(r'\d')) ? int.parse(prevChar) : digit;
        digitWidgets.insert(
          0,
          _OdometerDigit(
            digit: digit,
            previousDigit: _hasAnimated ? prevDigit : digit,
            isIncrease: _isIncrease,
            animationValue: animationValue,
            textStyle: effectiveStyle,
            digitHeight: digitH,
            digitWidth: digitW,
          ),
        );
      }
    }

    return Stack(
      clipBehavior: Clip.none,
      children: [
        if (_hasAnimated && glowValue > 0)
          Positioned(
            left: -12,
            top: -12,
            right: -12,
            bottom: -12,
            child: IgnorePointer(
              child: AnimatedBuilder(
                animation: _glowAnimation,
                builder: (context, _) {
                  return Container(
                    decoration: BoxDecoration(
                      borderRadius: BorderRadius.circular(AppRadius.lg),
                      boxShadow: [
                        BoxShadow(
                          color: _isIncrease
                              ? AppColors.success
                                  .withValues(alpha: 0.3 * glowValue)
                              : AppColors.error
                                  .withValues(alpha: 0.3 * glowValue),
                          blurRadius: 20 + (10 * (1 - glowValue)),
                          spreadRadius: 2 * glowValue,
                        ),
                        BoxShadow(
                          color: _isIncrease
                              ? AppColors.success
                                  .withValues(alpha: 0.15 * glowValue)
                              : AppColors.error
                                  .withValues(alpha: 0.15 * glowValue),
                          blurRadius: 40,
                          spreadRadius: 4 * glowValue,
                        ),
                      ],
                    ),
                  );
                },
              ),
            ),
          ),
        Row(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.end,
          children: [
            if (widget.showRupeeSymbol)
              Padding(
                padding: EdgeInsets.only(
                  right: widget.compact ? 3 : 4,
                  bottom: widget.compact ? 2 : 4,
                ),
                child: Text(
                  '\u20B9\u2060',
                  style: effectiveStyle.copyWith(
                    fontSize: effectiveStyle.fontSize! *
                        (widget.compact ? 0.65 : 0.7),
                    fontWeight: FontWeight.w400,
                  ),
                ),
              ),
            ...digitWidgets,
          ],
        ),
      ],
    );
  }

  String _formatValue(double value) {
    if (widget.decimalPlaces > 0) {
      final fullString = value.abs().toStringAsFixed(widget.decimalPlaces);
      final parts = fullString.split('.');
      final intString = _formatIndianNumbering(int.parse(parts[0]));
      final fracString = parts.length > 1 ? '.${parts[1]}' : '';

      if (value < 0 && parts[0] == '0') {
        return '-0$fracString';
      }
      return '${value < 0 ? '-' : ''}$intString$fracString';
    }
    // Format with Indian numbering: 1,23,456
    return _formatIndianNumbering(value.round());
  }

  String _formatIndianNumbering(int value) {
    if (value == 0) return '0';
    final isNegative = value < 0;
    if (isNegative) value = -value;

    final str = value.toString();
    if (str.length <= 3) return '${isNegative ? '-' : ''}$str';

    // Indian numbering: last 3 digits, then groups of 2
    final last3 = str.substring(str.length - 3);
    var rest = str.substring(0, str.length - 3);
    var groups = <String>[];
    while (rest.length > 2) {
      groups.add(rest.substring(rest.length - 2));
      rest = rest.substring(0, rest.length - 2);
    }
    if (rest.isNotEmpty) groups.add(rest);
    groups = groups.reversed.toList();

    final result = '${groups.join(',')},$last3';
    return '${isNegative ? '-' : ''}$result';
  }
}

/// A single digit column in the odometer, showing all 10 digits stacked
/// vertically and clipped to one digit height, with animated vertical offset.
class _OdometerDigit extends StatelessWidget {
  final int digit;
  final int previousDigit;
  final bool isIncrease;
  final double animationValue;
  final TextStyle textStyle;
  final double digitHeight;
  final double digitWidth;

  const _OdometerDigit({
    required this.digit,
    required this.previousDigit,
    required this.isIncrease,
    required this.animationValue,
    required this.textStyle,
    required this.digitHeight,
    required this.digitWidth,
  });

  @override
  Widget build(BuildContext context) {
    // Build a longer column of digits to allow wrapping:
    // [0,1,2,3,4,5,6,7,8,9,0,1,2,3,4,5,6,7,8,9]
    const digits = [
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
      0,
      1,
      2,
      3,
      4,
      5,
      6,
      7,
      8,
      9,
    ];

    // Determine start/end positions in the 20-element array
    int startIdx;
    int endIdx;

    if (isIncrease) {
      startIdx = previousDigit;
      if (digit < previousDigit) {
        // Wrapped forward — e.g., 9 -> 0: scroll up past 9 to 0 at pos 10
        endIdx = digit + 10;
      } else {
        endIdx = digit;
      }
    } else {
      if (digit > previousDigit) {
        // Wrapped backward — e.g., 0 -> 9: start from pos 10 and scroll down to 9
        startIdx = previousDigit + 10;
        endIdx = digit;
      } else {
        startIdx = previousDigit;
        endIdx = digit;
      }
    }

    final startOffset = -startIdx * digitHeight;
    final endOffset = -endIdx * digitHeight;
    final currentOffset =
        startOffset + (endOffset - startOffset) * animationValue;

    return SizedBox(
      width: digitWidth,
      height: digitHeight,
      child: ClipRect(
        child: Stack(
          clipBehavior: Clip.none,
          children: List.generate(digits.length, (i) {
            return Positioned(
              top: i * digitHeight + currentOffset,
              child: SizedBox(
                width: digitWidth,
                child: Text(
                  '${digits[i]}',
                  style: textStyle,
                  textAlign: TextAlign.center,
                ),
              ),
            );
          }),
        ),
      ),
    );
  }
}
