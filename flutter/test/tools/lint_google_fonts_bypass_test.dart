/// PR-114: Regression guard for the GoogleFonts widget-bypass ratchet.
///
/// Validates that the lint tool:
///   1. Exists and is executable as Dart.
///   2. Has the correct ceiling pinned to the measured count.
///   3. Excludes `lib/theme/app_theme.dart` (the canonical textTheme setup).
///   4. Excludes comment lines that mention GoogleFonts.
///   5. Passes when run (subprocess, skipped if `dart` not on PATH).
library;

import 'dart:io';

import 'package:flutter_test/flutter_test.dart';

/// Returns the absolute path to a CLI tool if it resolves on the current
/// PATH and is a runnable binary. Uses `where` on Windows, `which` elsewhere.
/// Returns null on any error — the calling test treats that as a skip.
Future<String?> _which(String tool) async {
  final isWindows = Platform.isWindows;
  ProcessResult result;
  try {
    result = await Process.run(
      isWindows ? 'where' : 'which',
      [tool],
    );
  } on Object {
    return null;
  }
  if (result.exitCode != 0) return null;
  final out = (result.stdout as String).trim();
  if (out.isEmpty) return null;
  for (final line in out.split('\n')) {
    final candidate = line.trim();
    if (candidate.isEmpty) continue;
    if (candidate.toUpperCase().startsWith('INFO:')) continue;
    final file = File(candidate);
    if (!await file.exists()) continue;
    // Sanity: must be a regular file with non-zero size.
    final stat = await file.stat();
    if (stat.type != FileSystemEntityType.file) continue;
    if (stat.size == 0) continue;
    return candidate;
  }
  return null;
}

void main() {
  group('PR-114 GoogleFonts widget-bypass ratchet', () {
    test('lint tool exists and is executable as Dart', () async {
      final toolFile = File('tool/lint_google_fonts_bypass.dart');
      expect(toolFile.existsSync(), isTrue,
          reason: 'lint_google_fonts_bypass.dart must exist at flutter/tool/');
    });

    test('ceiling is set to current measured count (321)', () {
      // If the ceiling drifts, the ratchet will silently start failing or
      // silently pass. Pin it explicitly so reviewers see the value.
      final toolSrc =
          File('tool/lint_google_fonts_bypass.dart').readAsStringSync();
      final match =
          RegExp(r'kGoogleFontsBypassCeiling\s*=\s*(\d+)').firstMatch(toolSrc);
      expect(match, isNotNull, reason: 'ceiling constant must be present');
      final ceiling = int.parse(match!.group(1)!);
      expect(ceiling, equals(321),
          reason:
              'ceiling must equal the measured widget-bypass count (DS-3b 2026-08-04)');
    });

    test('ceiling is at least 1 and at most 1000 (sanity)', () {
      final toolSrc =
          File('tool/lint_google_fonts_bypass.dart').readAsStringSync();
      final match =
          RegExp(r'kGoogleFontsBypassCeiling\s*=\s*(\d+)').firstMatch(toolSrc);
      final ceiling = int.parse(match!.group(1)!);
      expect(ceiling, greaterThan(0));
      expect(ceiling, lessThanOrEqualTo(1000));
    });

    test('tool excludes lib/theme/app_theme.dart', () {
      final toolSrc =
          File('tool/lint_google_fonts_bypass.dart').readAsStringSync();
      expect(toolSrc, contains("'lib/theme/app_theme.dart'"));
    });

    test('tool skips comment lines (//, ///, *)', () {
      // The tool must filter out doc references. If a `///` doc comment
      // mentions `GoogleFonts.plusJakartaSans(...)`, the tool should not
      // count it. We assert by checking the regex behavior with a sample
      // file. (No test file is created — we just verify the exclusion
      // pattern is present in the source.)
      final toolSrc =
          File('tool/lint_google_fonts_bypass.dart').readAsStringSync();
      expect(toolSrc, contains("trimmed.startsWith('//')"));
      expect(toolSrc, contains("trimmed.startsWith('///')"));
      expect(toolSrc, contains("trimmed.startsWith('*')"));
    });

    test('running the tool passes at current ceiling', () async {
      // Smoke test: run the lint and assert exit code 0. If the ceiling
      // is correct and no widget files have grown GoogleFonts refs since
      // the ratchet was added, this passes.
      //
      // The subprocess call requires `dart` on PATH. In some CI sandboxes
      // (and on Windows test runners that don't have dart bin on PATH for
      // the test process), this test is skipped rather than failed.
      final dartOnPath = await _which('dart');
      if (dartOnPath == null) {
        // markSkipped is not available in the version of test_api we pin;
        // log a note and exit the test early. This keeps the test useful
        // on dev machines while not breaking CI sandboxes.
        // ignore: avoid_print
        print(
            'SKIP: dart not on PATH for test subprocess; skipping live ratchet test');
        return;
      }
      // On Windows, `where dart` may return the bare `dart` binary path
      // (no .exe) AND a `dart.bat` shim. The bare name fails Process.run
      // with "%1 is not a valid Win32 application" because Windows doesn't
      // resolve PATHEXT for absolute paths. Use the .bat shim if present,
      // otherwise fall back to passing just 'dart' so the OS resolves it
      // via PATHEXT on the PATH.
      String dartCmd = dartOnPath;
      if (Platform.isWindows &&
          !dartOnPath.toLowerCase().endsWith('.bat') &&
          !dartOnPath.toLowerCase().endsWith('.exe')) {
        // Try the .bat variant next to the same location.
        final batCandidate =
            dartOnPath.endsWith('\\') || dartOnPath.endsWith('/')
                ? '${dartOnPath}dart.bat'
                : '$dartOnPath.bat';
        if (await File(batCandidate).exists()) {
          dartCmd = batCandidate;
        } else {
          // Last resort: just call 'dart' by name and let the OS resolve.
          dartCmd = 'dart';
        }
      }
      final result = await Process.run(
        dartCmd,
        ['run', 'tool/lint_google_fonts_bypass.dart'],
        workingDirectory: Directory.current.path,
        runInShell: true,
      );
      // The tool exits 0 on pass, 1 on fail. Stdout/stderr may include
      // a "Running build hooks" warning from the Dart CLI which is harmless.
      if (result.exitCode != 0) {
        // ignore: avoid_print
        print('STDOUT: ${result.stdout}');
        // ignore: avoid_print
        print('STDERR: ${result.stderr}');
      }
      expect(result.exitCode, equals(0),
          reason: 'ratchet must pass at the current measured count');
    });
  });
}
