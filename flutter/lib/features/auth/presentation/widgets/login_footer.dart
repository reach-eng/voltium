import 'package:flutter/material.dart';
import 'package:voltium_rider/gen/app_localizations.dart';
import 'package:voltium_rider/theme/app_theme.dart';
import 'package:voltium_rider/theme/app_typography.dart';
import 'package:voltium_rider/utils/accessibility.dart';
import 'dart:ui' as ui;

/// Floating footer for [LoginScreen]. Renders the "By signing in, you
/// agree to our Terms of Service and Privacy Policy" line as a
/// backdrop-blurred glass strip pinned to the bottom safe area.
///
/// The footer fades in last in the entry sequence (interval 0.5-1.0 of
/// the parent's [AnimationController]). All links open via the
/// platform's default external browser.
class LoginFooter extends StatelessWidget {
  /// AnimationController from the parent, used to drive the fade-in.
  final AnimationController entryController;

  /// Called when the user taps a link. The parent resolves the URL
  /// (e.g. to support deep-link overrides) and launches it.
  final Future<void> Function(String url) onLaunchUrl;

  const LoginFooter({
    super.key,
    required this.entryController,
    required this.onLaunchUrl,
  });

  @override
  Widget build(BuildContext context) {
    // LANGUAGE-AUDIT (2026-08-16) #5: the entire footer is now
    // localisable. The intro line ("By signing in, you agree to
    // our"), the connector (" and "), and both link labels
    // ("Terms of Service" / "Privacy Policy") all come from
    // `AppLocalizations.of(context)`. The two link labels are
    // already in the ARB as `txttermsOfService` /
    // `txtprivacyPolicy` (unblocked by this wiring). The intro
    // line is a new key `txtloginLegalIntro`.
    final l10n = AppLocalizations.of(context);
    final colors = AppColors.of(context);
    final intro = l10n?.txtloginLegalIntro ?? 'By signing in, you agree to our';
    final terms = l10n?.txttermsOfService ?? 'Terms of Service';
    final privacy = l10n?.txtprivacyPolicy ?? 'Privacy Policy';

    return ClipRRect(
      child: BackdropFilter(
        filter: ui.ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          padding: EdgeInsets.fromLTRB(
              20, 20, 20, MediaQuery.of(context).padding.bottom + 20),
          decoration: BoxDecoration(
            color: colors.card.withValues(alpha: 0.8),
            border: Border(
              top: BorderSide(
                color: colors.outline.withValues(alpha: 0.2),
                width: 1,
              ),
            ),
          ),
          child: Center(
            child: FadeTransition(
              opacity: CurvedAnimation(
                parent: entryController,
                curve: const Interval(0.5, 1.0),
              ),
              child: RichText(
                textAlign: TextAlign.center,
                text: TextSpan(
                  style: AppTypography.bodySmall.copyWith(
                    color: colors.onSurfaceVariant,
                    height: 1.6,
                  ),
                  children: [
                    TextSpan(text: a11yLabel('$intro\n')),
                    WidgetSpan(
                      child: Semantics(
                        button: true,
                        label: a11yButton(terms),
                        child: GestureDetector(
                          onTap: () => onLaunchUrl('https://voltium.app/terms'),
                          child: Text(
                            terms,
                            style: AppTypography.labelMedium
                                .copyWith(color: AppColors.primary),
                          ),
                        ),
                      ),
                    ),
                    const TextSpan(
                      text: ' and ',
                    ),
                    WidgetSpan(
                      child: Semantics(
                        button: true,
                        label: a11yButton(privacy),
                        child: GestureDetector(
                          onTap: () =>
                              onLaunchUrl('https://voltium.app/privacy'),
                          child: Text(
                            privacy,
                            style: AppTypography.labelMedium
                                .copyWith(color: AppColors.primary),
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
