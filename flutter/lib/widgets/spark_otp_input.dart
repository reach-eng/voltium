import 'dart:async';
import 'dart:ui' as ui;
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';

/// An OTP input where each digit box flashes with an electric glow when a
/// number is entered, with haptic feedback and a chain-lightning effect when
/// all digits are filled.
///
/// Features:
/// - Electric spark glow on each digit entry (cyan → blue pulse)
/// - HapticFeedback.lightImpact() on every digit
/// - Chain-lightning: sequential bright glow across all boxes when complete
/// - Glassmorphic styling matching the app's OTP screen
class SparkOtpInput extends StatefulWidget {
  final int length;
  final ValueChanged<String> onCompleted;
  final ValueChanged<String>? onChanged;
  final bool autoFocus;

  /// Width/height of each OTP box.
  final double boxSize;
  final double boxHeight;
  final double spacing;

  const SparkOtpInput({
    super.key,
    this.length = 6,
    required this.onCompleted,
    this.onChanged,
    this.autoFocus = true,
    this.boxSize = 48,
    this.boxHeight = 56,
    this.spacing = 8,
  });

  @override
  SparkOtpInputState createState() => SparkOtpInputState();
}

/// Per-cell animation state: an AnimationController driving the spark glow.
class _CellAnimState {
  late final AnimationController controller;
  late final Animation<double> glow;
  bool _initialized = false;

  void init(TickerProvider vsync) {
    if (_initialized) return;
    _initialized = true;
    controller = AnimationController(
      vsync: vsync,
      duration: const Duration(milliseconds: 700),
    );
    glow = CurvedAnimation(
      parent: controller,
      curve: const Interval(0, 0.55, curve: Curves.easeOut),
    );
  }

  void spark() {
    controller.forward(from: 0);
  }

  bool get isAnimating => controller.isAnimating;

  void dispose() {
    if (_initialized) {
      // AUDIT FIX: removed no-op removeListener with fresh closure.
      controller.dispose();
    }
  }
}

class SparkOtpInputState extends State<SparkOtpInput>
    with TickerProviderStateMixin {
  late final List<TextEditingController> _controllers;
  late final List<FocusNode> _focusNodes;
  late final List<_CellAnimState> _cellAnims;

  bool _allFilled = false;
  String _error = '';

  /// The full concatenated OTP value (e.g., "123456").
  String get value => _controllers.map((c) => c.text).join();

  /// Whether all digit boxes are filled.
  bool get isComplete => _controllers.every((c) => c.text.isNotEmpty);

  /// Clear all digits and focus the first box.
  void clear() {
    for (final c in _controllers) {
      c.clear();
    }
    _allFilled = false;
    _focusNodes[0].requestFocus();
    setState(() {});
  }

  /// Set an error message displayed below the OTP row.
  void setError(String error) {
    setState(() => _error = error);
  }

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(widget.length, (_) => TextEditingController());
    _focusNodes = List.generate(widget.length, (_) => FocusNode());
    _cellAnims =
        List.generate(widget.length, (_) => _CellAnimState()..init(this));

    if (widget.autoFocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _focusNodes[0].requestFocus();
      });
    }
  }

  @override
  void dispose() {
    for (final c in _controllers) {
      c.dispose();
    }
    for (final f in _focusNodes) {
      f.dispose();
    }
    for (final a in _cellAnims) {
      a.dispose();
    }
    super.dispose();
  }

  void _onChanged(String value, int index) {
    final priorFull = _controllers.map((c) => c.text).join();
    if (value.length == 1 && index < widget.length - 1) {
      _focusNodes[index + 1].requestFocus();
    }
    if (value.isEmpty && index > 0) {
      _focusNodes[index - 1].requestFocus();
    }

    // Trigger spark on digit entry (not on delete)
    if (value.isNotEmpty) {
      HapticFeedback.lightImpact();
      _cellAnims[index].spark();
    }

    final fullValue = _controllers.map((c) => c.text).join();
    if (fullValue != priorFull) {
      widget.onChanged?.call(fullValue);
    }

    // Check chain-lightning: all filled and this is a new digit (not delete)
    final allFilled = _controllers.every((c) => c.text.isNotEmpty);
    if (allFilled && !_allFilled && value.isNotEmpty) {
      _allFilled = true;
      _triggerChainLightning();
    } else if (!allFilled) {
      _allFilled = false;
    }

    setState(() {});
  }

  void _triggerChainLightning() {
    // Stagger the spark animations across all cells — left to right
    for (int i = 0; i < widget.length; i++) {
      Future.delayed(Duration(milliseconds: 120 * i), () {
        if (!mounted) return;
        _cellAnims[i].spark();
        if (i == widget.length - 1) {
          // After the last spark, wait for the animation to peak, then complete
          Future.delayed(const Duration(milliseconds: 400), () {
            if (!mounted) return;
            widget.onCompleted(_controllers.map((c) => c.text).join());
          });
        }
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        GestureDetector(
          behavior: HitTestBehavior.opaque,
          onTap: () {
            // Focus the first empty field
            for (int i = 0; i < widget.length; i++) {
              if (_controllers[i].text.isEmpty) {
                _focusNodes[i].requestFocus();
                return;
              }
            }
            _focusNodes[widget.length - 1].requestFocus();
          },
          child: Row(
            key: const Key('otpInputRow'),
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: List.generate(widget.length, (index) {
              return _SparkOtpBox(
                key: ValueKey('spark_otp_$index'),
                controller: _controllers[index],
                focusNode: _focusNodes[index],
                size: widget.boxSize,
                height: widget.boxHeight,
                spacing: widget.spacing,
                glowAnimation: _cellAnims[index].glow,
                hasError: _error.isNotEmpty,
                isDark: isDark,
                onChanged: (v) => _onChanged(v, index),
              );
            }),
          ),
        ),
        if (_error.isNotEmpty)
          Padding(
            padding: const EdgeInsets.only(top: 12),
            child: Text(
              _error,
              style: GoogleFonts.plusJakartaSans(
                color: AppColors.error,
                fontSize: 12,
              ),
            ),
          ),
      ],
    );
  }
}

/// A single digit box in the OTP row with spark glow overlay.
class _SparkOtpBox extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode focusNode;
  final double size;
  final double height;
  final double spacing;
  final Animation<double> glowAnimation;
  final bool hasError;
  final bool isDark;
  final ValueChanged<String> onChanged;

  const _SparkOtpBox({
    super.key,
    required this.controller,
    required this.focusNode,
    required this.size,
    required this.height,
    required this.spacing,
    required this.glowAnimation,
    required this.hasError,
    required this.isDark,
    required this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.symmetric(horizontal: spacing / 2),
      child: AnimatedBuilder(
        animation: glowAnimation,
        builder: (context, child) {
          final glow = glowAnimation.value;
          final isFocused = focusNode.hasFocus;
          final hasValue = controller.text.isNotEmpty;

          // Spark color: bright cyan for entry glow
          const sparkColor = AppColors.info;

          // Build electric glow intensity — more intense at peak, fades smoothly
          final glowIntensity = glow * (0.55 + 0.25 * (1 - glow));
          final glowRadius = 4.0 + glow * 16.0;
          final glowSpread = glow * 4.0;

          // Border color: transitions from normal → spark color → back
          Color borderColor;
          if (hasError) {
            borderColor = AppColors.error;
          } else if (glow > 0.02) {
            borderColor = Color.lerp(
              isFocused ? AppColors.primary : AppColors.outlineVariant,
              sparkColor,
              glow.clamp(0.0, 1.0),
            )!;
          } else if (isFocused) {
            borderColor = AppColors.primary;
          } else if (hasValue) {
            borderColor = AppColors.outlineVariant;
          } else {
            borderColor = Colors.white.withValues(alpha: 0.4);
          }

          // Glass container
          return ClipRRect(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            child: BackdropFilter(
              filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
              child: Container(
                width: size,
                height: height,
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: 0.7),
                  borderRadius: BorderRadius.circular(AppRadius.lg),
                  border: Border.all(
                    color: borderColor,
                    width: glow > 0.02 ? 2.5 : (isFocused ? 2.0 : 1.5),
                  ),
                  boxShadow: glow > 0.02
                      ? [
                          // Outer electric glow
                          BoxShadow(
                            color: sparkColor.withValues(
                                alpha: glowIntensity * 0.5),
                            blurRadius: glowRadius,
                            spreadRadius: glowSpread,
                          ),
                          // Secondary larger glow
                          BoxShadow(
                            color: sparkColor.withValues(
                                alpha: glowIntensity * 0.2),
                            blurRadius: glowRadius * 1.5,
                            spreadRadius: glowSpread * 0.5,
                          ),
                          // Keep base glass shadow
                          ...AppShadows.glass,
                        ]
                      : AppShadows.glass,
                ),
                child: Stack(
                  children: [
                    // Text input
                    TextFormField(
                      controller: controller,
                      focusNode: focusNode,
                      keyboardType: TextInputType.number,
                      textAlign: TextAlign.center,
                      maxLength: 1,
                      obscureText: false,
                      inputFormatters: [
                        FilteringTextInputFormatter.digitsOnly,
                      ],
                      onChanged: onChanged,
                      style: AppTypography.headingMedium
                          .copyWith(color: AppColors.of(context).onSurface),
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
                    // Spark overlay — subtle inner glow when sparking
                    if (glow > 0.02)
                      Positioned.fill(
                        child: IgnorePointer(
                          child: Container(
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(AppRadius.lg),
                              gradient: RadialGradient(
                                colors: [
                                  sparkColor.withValues(
                                      alpha: glowIntensity * 0.15),
                                  Colors.transparent,
                                ],
                                radius: 0.7,
                              ),
                            ),
                          ),
                        ),
                      ),
                  ],
                ),
              ),
            ),
          );
        },
      ),
    );
  }
}
