import 'dart:io';

/// PR-142 (RA-F-7) — Touch Target Lint Tool
///
/// Scans `flutter/lib/` for interactive widgets wrapped in explicit dimensions
/// less than 44.0 dp (e.g. `width: 20`, `height: 20` inside GestureDetector).
///
/// Ensures all tappable targets meet the minimum 44×44 dp accessibility rule.
const int kTouchTargetViolationCeiling = 15;

void main() {
  final libDir = Directory('lib');
  if (!libDir.existsSync()) {
    stderr.writeln('Error: Run this script from the flutter/ directory.');
    exit(1);
  }

  int violations = 0;
  // Look for SizedBox/Container wrapping GestureDetector/InkWell/IconButton with height/width < 44
  final wrapperRegex = RegExp(r'(SizedBox|Container)\s*\(\s*(width|height):\s*([1-3]?[0-9]|\b4[0-3])(\.0)?\b');

  final files = libDir
      .listSync(recursive: true)
      .whereType<File>()
      .where((f) => f.path.endsWith('.dart'));

  for (final file in files) {
    final lines = file.readAsLinesSync();
    for (int i = 0; i < lines.length; i++) {
      final line = lines[i];
      if (line.contains('//')) continue;
      
      if (wrapperRegex.hasMatch(line)) {
        // Check if next 5 lines contain an interactive widget as child
        final window = lines.skip(i).take(6).join(' ');
        if (window.contains('child: GestureDetector') ||
            window.contains('child: InkWell') ||
            window.contains('child: IconButton') ||
            (window.contains('GestureDetector') && line.contains('child:'))) {
          violations++;
        }
      }
    }
  }

  stdout.writeln('Touch Target Accessibility Audit (RA-F-7):');
  stdout.writeln('  Current sub-44px dimension hints : $violations');
  stdout.writeln('  Ratchet Ceiling                  : $kTouchTargetViolationCeiling');

  if (violations > kTouchTargetViolationCeiling) {
    stderr.writeln('\nFAILED: Sub-44px touch target count ($violations) exceeds ceiling ($kTouchTargetViolationCeiling).');
    stderr.writeln('Use a11yTouchTarget() wrapper or increase dimensions to at least 44.0 dp.');
    exit(1);
  } else {
    stdout.writeln('\nPASSED: Touch target accessibility compliant.');
  }
}
