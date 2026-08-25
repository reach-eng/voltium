import 'dart:io';

/// DART-LINT 2026-08-22 (PR-5): scan for `ref.watch(...)` calls inside
/// event-handler callback bodies. `ref.watch` is intended for build
/// methods (it registers a dependency on the current build's container);
/// inside an `onPressed` / `onTap` / `onChanged` / `onLongPress` /
/// `onSubmitted` / `onSelectChanged` callback it can read a disposed
/// or stale container after an `await` point and re-trigger the whole
/// handler on every provider change.
///
/// The fix is always one of:
///   - capture the value with `ref.read` BEFORE the `await`, or
///   - hoist the value to a `late final` field initialised in initState
///     or a `ref.listen` callback.
///
/// False-positive escapes: `// watch-in-handler-allow: <reason>` on the
/// same line as the violation. Use sparingly; the audit logs every escape
/// so we can revisit.
///
/// Usage:
///   cd flutter && dart run tool/lint_ref_watch_in_handler.dart
void main() {
  final libDir = Directory('lib');
  if (!libDir.existsSync()) {
    stderr.writeln('Error: Run this script from the flutter/ directory.');
    exit(1);
  }

  // Callbacks we want to flag — any function-typed argument whose name
  // implies a user-event handler.
  final handlerNames = <String>{
    'onPressed',
    'onTap',
    'onTapDown',
    'onTapUp',
    'onLongPress',
    'onChanged',
    'onSubmitted',
    'onSelectChanged',
    'onCheckboxChanged',
    'onSwitchChanged',
    'onPressedChange',
  };

  // Match the start of a callback block assigned to one of the handlers.
  // Captures: 1 = handler name, 2 = opening token of the body (`(` or `=>`).
  final handlerStart = RegExp(
    r'\b(' +
        handlerNames.join('|') +
        r')\s*:\s*(?:(\([^)]*\)\s*\{)|(\([^)]*\)\s*=>))',
  );

  // Match a ref.watch call within a line.
  final refWatch = RegExp(r'\bref\s*\.\s*watch\s*\(');

  final allowComment = RegExp(r'//\s*watch-in-handler-allow:');

  int violations = 0;
  final report = <String>[];

  for (final entity in libDir.listSync(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) continue;
    final normalized = entity.path.replaceAll('\\', '/');
    final libRelative = normalized.contains('lib/')
        ? 'lib/${normalized.split('lib/').last}'
        : normalized;

    final lines = entity.readAsLinesSync();
    // Track per-brace-pair body depth. The Dart parser is overkill for
    // this; we just need "are we inside a `{...}` body that was opened
    // right after one of the handler names?".
    int? bodyOpenLine;

    for (var i = 0; i < lines.length; i++) {
      final line = lines[i];
      final trimmed = line.trim();

      // Comment lines are exempt at the file level.
      if (trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          trimmed.startsWith('*')) {
        continue;
      }

      if (bodyOpenLine == null) {
        final m = handlerStart.firstMatch(line);
        if (m != null) {
          // Block-form `() {` or arrow-form `() =>`. The body is either
          // multi-line (we track depth below) or single-expression.
          if (m.group(2) != null) {
            bodyOpenLine = i; // depth-1 body starts at this line
          } else {
            // Arrow form — the body is the rest of the line. Flag any
            // ref.watch on this same line.
            if (refWatch.hasMatch(line) && !allowComment.hasMatch(line)) {
              violations++;
              report.add('$libRelative:${i + 1}: $trimmed');
            }
          }
        }
        continue;
      }

      // We're inside a block body opened at `bodyOpenLine`. Count braces
      // and exit when we close it.
      final openLine = bodyOpenLine;
      var depth = 0;
      for (final ch in line.runes) {
        if (ch == '{'.codeUnitAt(0)) depth++;
        if (ch == '}'.codeUnitAt(0)) depth--;
        if (depth <= 0 && i > openLine) {
          bodyOpenLine = null;
          break;
        }
      }

      if (bodyOpenLine == null) {
        // We just exited the body — re-evaluate this line for a fresh
        // handler start on the next iteration.
        continue;
      }

      // Still inside the body. Check for ref.watch.
      if (refWatch.hasMatch(line) && !allowComment.hasMatch(line)) {
        violations++;
        report.add('$libRelative:${i + 1}: $trimmed');
      }
    }
  }

  // ADVISORY MODE 2026-08-23: the linter is permissive (exit 0) until
  // the team can audit the false-positive rate against the production
  // tree. The heuristic only catches `() { ... ref.watch() ... }`
  // body blocks; it does not catch `() async => ref.watch()` arrow
  // expressions or `() { ... await ...; ref.watch() ... }` patterns
  // where the watch is in a continuation. Promote to strict (exit 1)
  // once a sample run on a clean tree produces 0 violations.
  if (violations > 0) {
    stderr.writeln(
        '⚠️  Advisory: $violations ref.watch(...) call(s) inside event handlers:');
    for (final issue in report) {
      stderr.writeln('  $issue');
    }
    stderr.writeln(
        '\nCapture the value with ref.read BEFORE await, or hoist to a late final field.');
    stderr.writeln('Add "// watch-in-handler-allow: <reason>" to suppress if intentional.');
    stdout.writeln('(advisory — exit 0; promote to strict once the false-positive rate is 0)');
    return;
  }

  stdout.writeln('✅ No ref.watch() inside event handlers.');
}
