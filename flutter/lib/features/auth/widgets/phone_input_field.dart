import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:voltium_rider/theme/app_theme.dart';

/// A reusable phone input field aligned with the Voltium design system.
class PhoneInputField extends StatelessWidget {
  final TextEditingController controller;
  final FocusNode? focusNode;
  final String? errorText;
  final ValueChanged<String>? onChanged;
  final VoidCallback? onSubmitted;
  final String hintText;
  final Key? textFormFieldKey;

  const PhoneInputField({
    super.key,
    required this.controller,
    this.focusNode,
    this.errorText,
    this.onChanged,
    this.onSubmitted,
    this.hintText = '00000 00000',
    this.textFormFieldKey,
  });

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          height: 56,
          decoration: BoxDecoration(
            color: AppColors.inputBackground,
            borderRadius: BorderRadius.circular(999),
            border: errorText != null
                ? Border.all(color: AppColors.error, width: 1.5)
                : null,
          ),
          child: Row(
            children: [
              const Padding(
                padding: EdgeInsets.only(left: 20),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(
                      Icons.phone_outlined,
                      size: 20,
                      color: AppColors.primary,
                    ),
                    SizedBox(width: 8),
                    Text(
                      '+91',
                      style: TextStyle(
                        fontSize: 16,
                        fontWeight: FontWeight.w700,
                        color: AppColors.onSurface,
                      ),
                    ),
                  ],
                ),
              ),
              Container(
                width: 1,
                height: 20,
                color: AppColors.divider,
              ),
              const SizedBox(width: 12),
              Expanded(
                child: TextFormField(
                  key: textFormFieldKey,
                  controller: controller,
                  focusNode: focusNode,
                  keyboardType: TextInputType.phone,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(10),
                  ],
                  onChanged: onChanged,
                  onFieldSubmitted:
                      onSubmitted != null ? (_) => onSubmitted!() : null,
                  style: const TextStyle(
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
                    hintText: hintText,
                    hintStyle: const TextStyle(
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
        if (errorText != null)
          Padding(
            padding: const EdgeInsets.only(left: 20, top: 8),
            child: Semantics(
              liveRegion: true,
              child: Text(
                errorText!,
                style: const TextStyle(
                  fontSize: 12,
                  color: AppColors.error,
                  fontWeight: FontWeight.w500,
                ),
              ),
            ),
          ),
      ],
    );
  }
}
