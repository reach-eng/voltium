import 'dart:io';

/// DART-LINT 2026-08-22 (PR-5): scan for `GestureDetector` widgets that act
/// as buttons but are not wrapped in a `Semantics(button: true, ...)` ancestor
/// (or have no `Semantics.label` / `tooltip` to expose the action).
///
/// Bare `GestureDetector` as button is a recurring a11y leak: the touch
/// target exists, but TalkBack/VoiceOver do not announce it as a button
/// and the user cannot tell what tapping it will do.
///
/// False-positive escape: `// button-semantics-allow: <reason>` on the
/// same line as the violation. Use sparingly.
///
/// Usage:
///   cd flutter && dart run tool/lint_button_semantics.dart
void main() {
  final libDir = Directory('lib');
  if (!libDir.existsSync()) {
    stderr.writeln('Error: Run this script from the flutter/ directory.');
    exit(1);
  }

  // Recognise a GestureDetector whose constructor is on a line by itself
  // (the common style: `child: GestureDetector(` or `GestureDetector(`).
  final gestureDetectorOpen = RegExp(r'\bGestureDetector\s*\(');
  // Same line as a Tooltip means the surrounding widget already exposes
  // a label — counts as a11y-good.
  final tooltipRe = RegExp(r'\bTooltip\s*\(');
  // Semantics(...) wrapping the gesture.
  final semanticsRe = RegExp(r'\bSemantics\s*\(');
  // InkWell already has Material's a11y wiring.
  final inkWellRe = RegExp(r'\bInkWell\s*\(');
  // GestureDetector variants that are NOT buttons (drag, scale, etc.).
  // These don't need Semantics — they're continuous gestures.
  final nonButtonHandlerNames = <String>{
    'onPanDown',
    'onPanUpdate',
    'onPanEnd',
    'onPanStart',
    'onPanCancel',
    'onScaleStart',
    'onScaleUpdate',
    'onScaleEnd',
    'onHorizontalDragDown',
    'onHorizontalDragUpdate',
    'onHorizontalDragEnd',
    'onVerticalDragDown',
    'onVerticalDragUpdate',
    'onVerticalDragEnd',
    'onForcePressStart',
    'onForcePressEnd',
    'onLongPressMoveUpdate',
  };

  final allowComment = RegExp(r'//\s*button-semantics-allow:');

  int violations = 0;
  final report = <String>[];

  for (final entity in libDir.listSync(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) continue;
    final normalized = entity.path.replaceAll('\\', '/');
    final libRelative = normalized.contains('lib/')
        ? 'lib/${normalized.split('lib/').last}'
        : normalized;

    final lines = entity.readAsLinesSync();
    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      final trimmed = line.trim();
      if (trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*')) {
        continue;
      }
      if (!gestureDetectorOpen.hasMatch(line)) continue;
      if (allowComment.hasMatch(line)) continue;

      // Look ahead up to 50 lines for the closing `)`. Inside the
      // constructor body, look for a non-button handler-only setup.
      var depth = 0;
      var sawOpen = false;
      var usesNonButtonOnly = true;
      var sawButtonHandler = false;
      String? singleHandler;
      var lookEnd = (i + 50).clamp(0, lines.length);
      for (var j = i; j < lookEnd; j++) {
        for (final ch in lines[j].runes) {
          if (ch == '('.codeUnitAt(0)) {
            depth++;
            sawOpen = true;
          }
          if (ch == ')'.codeUnitAt(0)) depth--;
          if (sawOpen && depth <= 0) {
            lookEnd = j;
            break;
          }
        }
        if (sawOpen && depth <= 0) break;

        // Sniff for handler names.
        final handlerRe = RegExp(r'\b(on\w+)\s*:');
        for (final m in handlerRe.allMatches(lines[j])) {
          final name = m.group(1)!;
          if (nonButtonHandlerNames.contains(name)) {
            // non-button handler — keep usesNonButtonOnly true
          } else {
            sawButtonHandler = true;
            if (singleHandler == null) {
              singleHandler = name;
            } else {
              singleHandler = null; // multiple, not a single-button case
            }
          }
        }
      }

      // We only flag GestureDetectors that look like a button (have a
      // click-style handler), are not the sole non-button handler, and
      // are not wrapped in Tooltip/Semantics/InkWell.
      if (!sawButtonHandler) continue;
      if (usesNonButtonOnly && singleHandler == null) continue;

      // Search nearby (50 lines above and 20 below) for Tooltip,
      // Semantics, or InkWell that wrap this GestureDetector.
      final scanStart = (i - 50).clamp(0, lines.length);
      final scanEnd = (i + 20).clamp(0, lines.length);
      var a11yCovered = false;
      for (var j = scanStart; j < scanEnd; j++) {
        if (tooltipRe.hasMatch(lines[j]) ||
            semanticsRe.hasMatch(lines[j]) ||
            inkWellRe.hasMatch(lines[j])) {
          a11yCovered = true;
          break;
        }
      }
      if (a11yCovered) continue;

      violations++;
      report.add('$libRelative:${i + 1}: $trimmed');
    }
  }

  if (violations > 0) {
    stderr.writeln(
        '❌ Found $violations bare GestureDetector(s) acting as a button without Semantics:');
    for (final issue in report) {
      stderr.writeln('  $issue');
    }
    stderr.writeln('\nWrap in Semantics(button: true, label: ...) or use IconButton/InkWell.');
    stderr.writeln('Add "// button-semantics-allow: <reason>" to suppress if intentional.');
    exit(1);
  }

  stdout.writeln('✅ All GestureDetectors with click-style handlers are a11y-wrapped.');
}
