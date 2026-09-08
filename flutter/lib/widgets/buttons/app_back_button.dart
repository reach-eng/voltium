import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';

/// Canonical circular back button (44×44, card, outline 20%, card shadow).
/// Replaces hand-rolled GestureDetector+Container circles in legal/onboarding.
class AppBackButton extends StatelessWidget {
  final VoidCallback? onPressed;

  const AppBackButton({super.key, this.onPressed});

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);
    return GestureDetector(
      onTap: onPressed ?? () => Navigator.maybePop(context),
      child: Container(
        width: 44,
        height: 44,
        decoration: BoxDecoration(
          color: colors.card.withValues(alpha: 0.8),
          borderRadius: BorderRadius.circular(AppRadius.full),
          border: Border.all(color: colors.outline.withValues(alpha: 0.2)),
          boxShadow: AppShadows.card,
        ),
        child: Icon(
          Icons.arrow_back,
          size: 20,
          color: colors.onSurface,
        ),
      ),
    );
  }
}
