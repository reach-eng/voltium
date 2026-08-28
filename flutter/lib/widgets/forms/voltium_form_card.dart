import 'package:flutter/material.dart';
import '../../theme/app_theme.dart';
import '../../theme/app_typography.dart';

/// Form card container wrapping fields with consistent modal radius, card background,
/// and an enclosing Form widget with onUserInteraction autovalidation.
class VoltiumFormCard extends StatelessWidget {
  final String title;
  final Widget? contextLine;
  final List<Widget> children;

  /// PR-E (2026-08-28): expose the form key so consumers can
  /// trigger validate() / save() from outside (e.g. a parent's
  /// "Continue" button). Optional — when null, the inner Form
  /// uses its default key.
  final GlobalKey<FormState>? formKey;

  /// When non-null, overrides the default
  /// [AutovalidateMode.onUserInteraction] on the inner Form.
  final AutovalidateMode? autovalidateMode;

  const VoltiumFormCard({
    super.key,
    required this.title,
    this.contextLine,
    required this.children,
    this.formKey,
    this.autovalidateMode,
  });

  @override
  Widget build(BuildContext context) {
    final colors = AppColors.of(context);

    return Container(
      decoration: BoxDecoration(
        color: colors.card,
        borderRadius: BorderRadius.circular(AppRadius.radiusModal),
      ),
      padding: Spacing.paddingLg,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: AppTypography.titleSmall.copyWith(
              color: colors.onSurface,
              letterSpacing: -0.2,
            ),
          ),
          if (contextLine != null) ...[
            const SizedBox(height: 8),
            contextLine!,
          ],
          const SizedBox(height: 16),
          Form(
            key: formKey,
            autovalidateMode:
                autovalidateMode ?? AutovalidateMode.onUserInteraction,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: _buildSeparatedChildren(),
            ),
          ),
        ],
      ),
    );
  }

  List<Widget> _buildSeparatedChildren() {
    if (children.isEmpty) return const [];
    final separated = <Widget>[];
    for (var i = 0; i < children.length; i++) {
      separated.add(children[i]);
      if (i < children.length - 1) {
        separated.add(const SizedBox(height: 12));
      }
    }
    return separated;
  }
}
