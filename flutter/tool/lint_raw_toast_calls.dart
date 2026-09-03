import 'dart:io';

/// Linter that ensures all user feedback notifications use the canonical
/// `Toast.success / .error / .info / .warning` methods from `lib/utils/toast.dart`.
///
/// Direct calls to `showSnackBar(` or `SnackBar(` outside `lib/utils/toast.dart`
/// are prohibited unless explicitly marked with `// toast-allow: <reason>`.
///
/// Usage:
///   cd flutter && dart run tool/lint_raw_toast_calls.dart
void main() {
  final libDir = Directory('lib');
  if (!libDir.existsSync()) {
    stderr.writeln('Error: Run this script from the flutter/ directory.');
    exit(1);
  }

  const excludedPaths = {
    'lib/utils/toast.dart',
  };

  final rawSnackBarPattern = RegExp(r'\b(showSnackBar|SnackBar)\(');
  final allowCommentPattern = RegExp(r'//\s*toast-allow:');

  int violations = 0;
  final report = <String>[];

  for (final entity in libDir.listSync(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) continue;

    final normalizedPath = entity.path.replaceAll('\\', '/');
    final libRelative = normalizedPath.contains('lib/')
        ? 'lib/${normalizedPath.split('lib/').last}'
        : normalizedPath;

    if (excludedPaths.contains(libRelative)) continue;

    final lines = entity.readAsLinesSync();
    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      final trimmed = line.trim();

      // Skip comments
      if (trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*')) {
        continue;
      }

      if (rawSnackBarPattern.hasMatch(line) &&
          !allowCommentPattern.hasMatch(line)) {
        violations++;
        report.add('$libRelative:${i + 1}: $trimmed');
      }
    }
  }

  if (violations > 0) {
    stderr.writeln(
        '❌ Found $violations raw SnackBar / showSnackBar call(s) outside lib/utils/toast.dart:');
    for (final issue in report) {
      stderr.writeln('  $issue');
    }
    stderr.writeln(
        '\nPlease migrate to Toast.success / .error / .info / .warning or add "// toast-allow: <reason>" if intentional.');
    exit(1);
  }

  stdout.writeln(
      '✅ Toast call lint passed: 0 raw SnackBar calls outside lib/utils/toast.dart.');
  exit(0);
}
