import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import '../theme/app_theme.dart';

class OtpInput extends StatefulWidget {
  final int length;
  final ValueChanged<String> onCompleted;
  final ValueChanged<String>? onChanged;
  final bool autoFocus;
  final TextStyle? textStyle;
  final BoxDecoration? boxDecoration;
  final BoxDecoration? focusedDecoration;
  final BoxDecoration? errorDecoration;
  final double spacing;
  final double size;

  const OtpInput({
    super.key,
    this.length = 6,
    required this.onCompleted,
    this.onChanged,
    this.autoFocus = true,
    this.textStyle,
    this.boxDecoration,
    this.focusedDecoration,
    this.errorDecoration,
    this.spacing = 12,
    this.size = 50,
  });

  @override
  State<OtpInput> createState() => _OtpInputState();
}

class _OtpInputState extends State<OtpInput> {
  late List<TextEditingController> _controllers;
  late List<FocusNode> _focusNodes;
  late List<String> _values;
  String? _error;

  @override
  void initState() {
    super.initState();
    _controllers = List.generate(widget.length, (_) => TextEditingController());
    _focusNodes = List.generate(widget.length, (_) => FocusNode());
    _values = List.filled(widget.length, '');

    if (widget.autoFocus) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        _focusNodes[0].requestFocus();
      });
    }
  }

  @override
  void dispose() {
    for (var controller in _controllers) {
      controller.dispose();
    }
    for (var node in _focusNodes) {
      node.dispose();
    }
    super.dispose();
  }

  void _onChanged(String value, int index) {
    HapticFeedback.lightImpact();

    _values[index] = value;
    widget.onChanged?.call(_values.join());

    if (value.isNotEmpty && index < widget.length - 1) {
      _focusNodes[index + 1].requestFocus();
    }

    if (_values.every((v) => v.isNotEmpty)) {
      final otp = _values.join();
      widget.onCompleted(otp);
    }

    setState(() {});
  }

  void clear() {
    for (var controller in _controllers) {
      controller.clear();
    }
    _values = List.filled(widget.length, '');
    _focusNodes[0].requestFocus();
    setState(() {});
  }

  void setError(String? error) {
    setState(() => _error = error);
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final defaultDecoration = BoxDecoration(
      color: isDark ? const Color(0xFF1E293B) : Colors.grey[100],
      borderRadius: BorderRadius.circular(12),
      border: Border.all(color: Colors.transparent),
    );
    final focused = widget.focusedDecoration ??
        BoxDecoration(
          color: isDark ? const Color(0xFF1E293B) : Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: AppColors.primary, width: 2),
          boxShadow: [
            BoxShadow(
              color: AppColors.primary.withValues(alpha: 0.2),
              blurRadius: 8,
              offset: const Offset(0, 2),
            ),
          ],
        );
    final errorDecoration = widget.errorDecoration ??
        BoxDecoration(
          color: isDark ? const Color(0xFF1E293B) : Colors.red[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.red, width: 2),
        );

    return Column(
      children: [
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: List.generate(widget.length, (index) {
            final hasError = _error != null;
            final isFocused = _focusNodes[index].hasFocus;

            BoxDecoration decoration;
            if (hasError) {
              decoration = errorDecoration;
            } else if (isFocused) {
              decoration = focused;
            } else {
              decoration = widget.boxDecoration ?? defaultDecoration;
            }

            return Padding(
              padding: EdgeInsets.symmetric(horizontal: widget.spacing / 2),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 200),
                width: widget.size,
                height: widget.size,
                decoration: decoration,
                child: TextFormField(
                  controller: _controllers[index],
                  focusNode: _focusNodes[index],
                  textAlign: TextAlign.center,
                  maxLength: 1,
                  keyboardType: TextInputType.number,
                  style: widget.textStyle ??
                      TextStyle(
                        fontSize: widget.size * 0.5,
                        fontWeight: FontWeight.bold,
                        color: isDark ? Colors.white : Colors.black,
                      ),
                  decoration: const InputDecoration(
                    border: InputBorder.none,
                    counterText: '',
                  ),
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                  ],
                  onChanged: (value) => _onChanged(value, index),
                ),
              ),
            );
          }),
        ),
        if (_error != null) ...[
          const SizedBox(height: 12),
          Text(
            _error!,
            style: const TextStyle(
              color: Colors.red,
              fontSize: 12,
            ),
          ),
        ],
      ],
    );
  }
}

class OtpInputCompact extends StatelessWidget {
  final int length;
  final ValueChanged<String> onCompleted;

  const OtpInputCompact({
    super.key,
    this.length = 6,
    required this.onCompleted,
  });

  @override
  Widget build(BuildContext context) {
    return OtpInput(
      length: length,
      onCompleted: onCompleted,
      size: 40,
      spacing: 8,
    );
  }
}
