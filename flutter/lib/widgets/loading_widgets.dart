import 'package:flutter/material.dart';
import '../theme/app_theme.dart';
import '../utils/haptic_service.dart';

class LoadingButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final String label;

  /// PR #6: shown in place of [label] while [isLoading] is true. Falls
  /// back to the spinner (no text) if null. Use for verbs the rider
  /// expects to see: "Sending…", "Verifying…", "Processing…".
  final String? loadingLabel;
  final bool isLoading;
  final bool isDestructive;
  final IconData? icon;

  /// PR #6: when true, fires [HapticService.medium] on press. Default
  /// true (most callers are high-stakes actions). Set false for
  /// low-stakes buttons where a heavy tap feels wrong.
  final bool hapticOnPress;

  const LoadingButton({
    super.key,
    required this.onPressed,
    required this.label,
    this.loadingLabel,
    this.isLoading = false,
    this.isDestructive = false,
    this.icon,
    this.hapticOnPress = true,
  });

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: double.infinity,
      height: 56,
      child: ElevatedButton(
        onPressed: isLoading
            ? null
            : () {
                if (hapticOnPress) HapticService.medium();
                onPressed?.call();
              },
        style: ElevatedButton.styleFrom(
          backgroundColor: isDestructive ? AppColors.error : AppColors.primary,
          foregroundColor: Colors.white,
          disabledBackgroundColor: isDestructive
              ? AppColors.error.withAlpha(128)
              : AppColors.primary.withAlpha(128),
          elevation: isLoading ? 0 : 5,
          shadowColor: (isDestructive ? AppColors.error : AppColors.primary)
              .withValues(alpha: 0.4),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadius.radiusModal),
          ),
        ),
        child: isLoading
            ? (loadingLabel != null
                ? Row(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const SizedBox(
                        width: 20,
                        height: 20,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          valueColor:
                              AlwaysStoppedAnimation<Color>(Colors.white),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Text(loadingLabel!),
                    ],
                  )
                : const SizedBox(
                    width: 24,
                    height: 24,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      valueColor: AlwaysStoppedAnimation<Color>(Colors.white),
                    ),
                  ))
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
  final String? tooltip;

  const LoadingIconButton({
    super.key,
    required this.onPressed,
    required this.icon,
    this.isLoading = false,
    this.color,
    this.size = 24,
    this.tooltip,
  });

  @override
  Widget build(BuildContext context) {
    return IconButton(
      tooltip: tooltip,
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
                padding: EdgeInsets.all(Spacing.sm),
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
