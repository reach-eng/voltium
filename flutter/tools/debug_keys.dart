// Debug: check whether the script finds these specific keys.
import 'dart:io';

Future<void> main() async {
  for (final key in [
    'txtwelcome',
    'txtsplashTagline',
    'txtloginWelcomeSubtitle',
    'txtphoneNumberVerified',
  ]) {
    bool used = false;
    String? foundIn;
    await for (final entity in Directory('lib').list(recursive: true)) {
      if (entity is! File) continue;
      if (!entity.path.endsWith('.dart')) continue;
      final content = await entity.readAsString();
      if (_hasMatch(content, key)) {
        used = true;
        foundIn = entity.path;
        break;
      }
    }
    print('$key -> $used (in $foundIn)');
  }
}

bool isWordBoundary(String text, int after) {
  if (after >= text.length) return true;
  final ch = text[after];
  return !((ch.codeUnitAt(0) >= 0x61 && ch.codeUnitAt(0) <= 0x7A) ||
      (ch.codeUnitAt(0) >= 0x41 && ch.codeUnitAt(0) <= 0x5A) ||
      (ch.codeUnitAt(0) >= 0x30 && ch.codeUnitAt(0) <= 0x39) ||
      ch == '_');
}

bool _hasMatch(String content, String key) {
  for (final prefix in ['l10n.', 'l10n?.']) {
    final direct = '$prefix$key';
    var from = 0;
    while (true) {
      final idx = content.indexOf(direct, from);
      if (idx < 0) break;
      if (isWordBoundary(content, idx + direct.length)) return true;
      from = idx + direct.length;
    }
  }
  final re = RegExp(
    r'App?Localizations\.of\(context\)\s*[!?]\s*\.' +
        RegExp.escape(key) +
        r'\b',
  );
  if (re.hasMatch(content)) return true;
  return false;
}
