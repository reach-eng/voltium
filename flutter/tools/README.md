# Tooling — flutter/tools/

This directory contains one-shot Dart and Python scripts for
maintaining the Voltium rider app. They are not part of the app
runtime; they live here so contributors can find them and
external agents can use them to audit the codebase.

## `find_unused_arb.dart` (legacy)

The original, naive `find_unused_arb.dart` only greps for
`l10n.<key>` and over-reports dead keys (it misses
`l10n?.<key>` and `AppLocalizations.of(context)[!?].<key>`).
The script is kept here for historical reference but should
not be used for new audits.

## `find_truly_unused_arb.dart`

A fast, accurate ARB key audit. Walks `flutter/lib/` once and
matches every ARB key against four access patterns with
word-boundary checks:

- `l10n.<key>`
- `l10n?.<key>` (null-safe call)
- `AppLocalizations.of(context)!.<key>` (non-null assert)
- `AppLocalizations.of(context)?.<key>` (null-aware)
- Plus the line-broken form: `AppLocalizations.of(context)\n
  ?.txtXxx` (the regex allows whitespace between `(context)` and
  the access operator)

Run:

```bash
cd flutter
dart run tools/find_truly_unused_arb.dart
```

The script reports `Truly unused: N/Total` and a sorted list of
the dead keys. Spot-check 5-10 random dead keys with `git grep`
before deleting anything — the script is accurate but the
codebase evolves.

## `strip_dead_arb_keys.py`

Removes a list of keys from both `app_en.arb` and `app_hi.arb`.
Handles BOM, CRLF, and the `@-description` metadata block
immediately following each value line. Uses bytes I/O to avoid
the Windows encoding issues the Flutter `gen-l10n` parser
rejects.

Usage:

```bash
python tools/strip_dead_arb_keys.py keys.txt
```

Where `keys.txt` is one key per line. The script prints how many
keys it removed from each ARB; the counts should match unless
the EN and HI ARB files drifted apart.

## `verify_key_usage.dart` and `debug_keys.dart`

Debug helpers. `verify_key_usage.dart` checks whether a single
hardcoded key is found anywhere in `lib/`. `debug_keys.dart`
runs the same check for a small list of known-problematic keys.
Use these to validate the audit's algorithm before trusting the
output for a bulk deletion.
