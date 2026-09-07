import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../gen/app_localizations.dart';
import 'package:voltium_rider/core/localization/locale_provider.dart';
import 'package:voltium_rider/theme/app_theme.dart';

/// Displays the unified language selection dialog across all app screens.
///
/// PR-28 (DARK_MODE P0-1): the previous `LanguageToggle` widget
/// (ConsumerStatefulWidget) is gone — it was never instantiated
/// anywhere in the app, but its file was imported by `settings_screen`
/// and `profile_screen` as a dead dependency. Both screens now call
/// this dialog directly via `showAppLanguageDialog(context, ref)`,
/// which is the single source of truth for language selection.
///
/// LANGUAGE-AUDIT (2026-08-16) #11: the dialog now iterates over
/// `LocaleNotifier.supportedLanguages` instead of hard-coding 3
/// ListTiles. Adding a 3rd language is a one-line change in
/// [LocaleNotifier.supportedLanguages] (plus the ARB file).
void showAppLanguageDialog(BuildContext context, WidgetRef ref) {
  final l10n = AppLocalizations.of(context);
  final colors = AppColors.of(context);

  // PR-SETTINGS-2026-09-07 (P3-3): the dialog body is wrapped in a
  // `Consumer` that `ref.watch`es the `localeProvider`. Without
  // this, a locale change triggered while the dialog is open (e.g.
  // a debug intent, an automated test, or another code path that
  // calls `setLocale`) would leave the radio on the stale selection.
  // The `Consumer` re-renders the body when the provider changes.
  // Mirrors the same pattern in `_showThemeDialog`.
  showDialog(
    context: context,
    builder: (ctx) => Consumer(
      builder: (consumerCtx, consumerRef, _) {
        final localeState = consumerRef.watch(localeProvider);
        final currentLocale = localeState.locale.languageCode;
        final followingSystem = localeState.isFollowingSystem;
        // Radio group value: `'system'` when following the OS locale,
        // otherwise the explicit language code.
        final groupValue = followingSystem ? 'system' : currentLocale;

        return AlertDialog(
          backgroundColor: colors.surface,
          title: Text(l10n?.menu_selectLanguage ?? 'Select Language'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              ListTile(
                title: Text(l10n?.settings_followSystem ?? 'Follow system'),
                leading: Radio<String>(
                  key: const Key('systemRadio'),
                  value: 'system',
                  groupValue: groupValue,
                  onChanged: (v) {
                    ref.read(localeProvider.notifier).setFollowSystem();
                    Navigator.pop(ctx);
                  },
                ),
                onTap: () {
                  ref.read(localeProvider.notifier).setFollowSystem();
                  Navigator.pop(ctx);
                },
              ),
              // Iterate over supportedLanguages so adding a 3rd
              // language is purely a data change in
              // LocaleNotifier.supportedLanguages.
              for (final lang in LocaleNotifier.supportedLanguages)
                ListTile(
                  title: Text(l10n != null
                      ? LocaleNotifier.displayNameFor(lang.locale, l10n)
                      : lang.nativeName),
                  leading: Radio<String>(
                    key: Key('${lang.code}Radio'),
                    value: lang.code,
                    groupValue: groupValue,
                    onChanged: (v) {
                      ref.read(localeProvider.notifier).setLocale(lang.locale);
                      Navigator.pop(ctx);
                    },
                  ),
                  onTap: () {
                    ref.read(localeProvider.notifier).setLocale(lang.locale);
                    Navigator.pop(ctx);
                  },
                ),
            ],
          ),
        );
      },
    ),
  );
}
