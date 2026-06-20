import 'package:flutter/material.dart';
import '../theme/app_theme.dart';

class LoadingButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final String label;
  final bool isLoading;
  final bool isDestructive;
  final IconData? icon;

  const LoadingButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.isLoading = false,
    this.isDestructive = false,
    this.icon,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: isLoading ? null : onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: isDestructive ? Colors.red : AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: isDestructive
              ? Colors.red.withAlpha(128)
              : AppColors.primary.withAlpha(128),
          elevation: isLoading ? 0 : 5,
          shadowColor: (isDestructive ? Colors.red : AppColors.primary)
              .withValues(alpha: 0.4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(28),
          ),
        ),
        child: isLoading
            ? const SizedBox(
                width: 24,
                height: 24,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                ),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[
                    Icon(icon, size: 20),
                    const SizedBox(width: 8),
                  ],
                  Text(label),
                ],
              ),
      ),
    );
  }
}

class LoadingIconButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final IconData icon;
  final bool isLoading;
  final Color? color;
  final double size;

  const LoadingIconButton({
    super.key,
    required this.onPressed,
    required this.icon,
    this.isLoading = false,
    this.color,
    this.size = 24,
  });

  @override
  Widget build(BuildContext context) {
    return IconButton(
      onPressed: isLoading ? null : onPressed,
      icon: isLoading
          ? SizedBox(
              width: size,
              height: size,
              child: CircularProgressIndicator(
                strokeWidth: 2,
                color: color,
              ),
            )
          : Icon(icon, color: color),
    );
  }
}

class AsyncTextField extends StatelessWidget {
  final TextEditingController controller;
  final String hintText;
  final bool isLoading;
  final String? errorText;
  final TextInputType keyboardType;
  final int maxLines;
  final String? Function(String?)? validator;
  final void Function(String)? onChanged;

  const AsyncTextField({
    super.key,
    required this.controller,
    required this.hintText,
    this.isLoading = false,
    this.errorText,
    this.keyboardType = TextInputType.text,
    this.maxLines = 1,
    this.validator,
    this.onChanged,
  });

  @override
  Widget build(BuildContext context) {
    return TextFormField(
      controller: controller,
      keyboardType: keyboardType,
      maxLines: maxLines,
      validator: validator,
      onChanged: onChanged,
      decoration: InputDecoration(
        hintText: hintText,
        errorText: errorText,
        suffixIcon: isLoading
            ? const Padding(
                padding: EdgeInsets.all(12),
                child: SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              )
            : null,
      ),
    );
  }
}
