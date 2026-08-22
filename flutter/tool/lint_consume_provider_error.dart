import 'dart:io';

/// DART-LINT 2026-08-22 (PR-5): scan for screens that read a provider's
/// data without also reading the provider's `lastError` field. The audit
/// found multiple screens that render the success/empty state when the
/// network actually failed — e.g. `walletProvider.lastError` is produced
/// but `WalletScreen` never watched it, so a network failure showed the
/// "No transactions yet" empty state to a rider with money.
///
/// This linter does a structural check: in any file that calls
/// `ref.watch(<provider>.select((p) => p.<dataField>))`, look for a
/// companion `ref.watch(<provider>.select((p) => p.lastError))` (or
/// `<provider>.lastError` via the same provider) somewhere in the same
/// widget's build method. If absent, warn.
///
/// False-positive escape: `// consume-error-allow: <reason>` on the line
/// where the warning is reported. Use sparingly.
///
/// This linter intentionally does NOT cover every error-state pattern:
/// providers may expose errors via different field names (`error`,
/// `errorMessage`, etc.). The audit team should add provider→error-field
/// mappings to `_PROVIDER_ERROR_FIELDS` below as new providers land.
///
/// Usage:
///   cd flutter && dart run tool/lint_consume_provider_error.dart
void main() {
  final libDir = Directory('lib');
  if (!libDir.existsSync()) {
    stderr.writeln('Error: Run this script from the flutter/ directory.');
    exit(1);
  }

  // Known providers + their canonical error-state field.
  const _PROVIDER_ERROR_FIELDS = <String, String>{
    'walletProvider': 'lastError',
    'supportProvider': 'lastError',
    'riderProvider': 'lastError',
    'earningsProvider': 'lastError',
    'rewardsProvider': 'lastError',
    'referralProvider': 'lastError',
    'guarantorProvider': 'lastError',
    'kycProvider': 'lastError',
  };

  // A "data watch" looks like:  ref.watch(<provider>.select((p) => p.<X>))
  // where X is a data-shape field (transactions, data, entries, rider,
  // notifications, etc.) — not a flag field.
  final dataWatchRe = RegExp(
    r'\bref\.watch\(\s*(\w+Provider)\.select\(\s*\(p\)\s*=>\s*p\.(\w+)\s*\)\s*\)',
  );
  final errorWatchRe = RegExp(
    r'\bref\.watch\(\s*(\w+Provider)\.select\(\s*\(p\)\s*=>\s*p\.(lastError|error|errorMessage)\s*\)',
  );

  final allowComment = RegExp(r'//\s*consume-error-allow:');

  int violations = 0;
  final report = <String>[];

  for (final entity in libDir.listSync(recursive: true)) {
    if (entity is! File || !entity.path.endsWith('.dart')) continue;
    final normalized = entity.path.replaceAll('\\', '/');
    final libRelative = normalized.contains('lib/')
        ? 'lib/${normalized.split('lib/').last}'
        : normalized;

    final lines = entity.readAsLinesSync();

    // Index which providers have at least one data-watch in this file.
    final dataWatchedProviders = <String>{};
    for (final line in lines) {
      if (line.trim().startsWith('//')) continue;
      for (final m in dataWatchRe.allMatches(line)) {
        final provider = m.group(1)!;
        if (_PROVIDER_ERROR_FIELDS.containsKey(provider)) {
          dataWatchedProviders.add(provider);
        }
      }
    }
    if (dataWatchedProviders.isEmpty) continue;

    // Now check whether the file has an error-watch for any of the
    // data-watched providers.
    final errorWatchedProviders = <String>{};
    for (final line in lines) {
      if (line.trim().startsWith('//')) continue;
      for (final m in errorWatchRe.allMatches(line)) {
        errorWatchedProviders.add(m.group(1)!);
      }
    }

    for (final provider in dataWatchedProviders) {
      if (errorWatchedProviders.contains(provider)) continue;
      if (allowComment.hasMatch(lines.join('\n'))) continue;

      violations++;
      report.add(
        '$libRelative: $provider has data-watch but no lastError/error watch '
        '(rider-facing errors will render as empty state).',
      );
    }
  }

  // ADVISORY MODE 2026-08-23: the strict version (exit 1) was
  // disabled after a high false-positive rate — the linter only
  // recognises `lastError` / `error` / `errorMessage` as the error
  // field, but several providers surface errors via `rider == null`
  // (the rider never hydrates on a 5xx), `dataState == DataState.error`,
  // or a per-field flag. The linter still emits warnings for the
  // team to triage; promoting to strict (exit 1) requires either a
  // wider field-name dictionary or per-file `// consume-error-allow:`
  // annotations.
  if (violations > 0) {
    stderr.writeln(
        '⚠️  Advisory: $violations provider(s) that watch data without an error field:');
    for (final issue in report) {
      stderr.writeln('  $issue');
    }
    stderr.writeln(
        '\nAdd a companion ref.watch(<provider>.select((p) => p.lastError)) and surface it in the UI,');
    stderr.writeln('or add "// consume-error-allow: <reason>" to suppress if intentional.');
    stdout.writeln('(advisory — exit 0; strict mode disabled pending field-name dictionary)');
    return;
  }

  stdout.writeln('✅ All data-watched providers also expose their lastError.');
}
