#!/usr/bin/env python3
"""Migrate `debugPrint(...)` to `appDebug(...)` across flutter/lib/.

Adds `import '...app_logger.dart';` if missing. Idempotent.

Skips mentions inside Dart doc comments (lines starting with `//` or `///`)
because those reference the original `debugPrint` API and must stay accurate.

Usage:
  python flutter/scripts/migrate-debug-print.py            # rewrite
  python flutter/scripts/migrate-debug-print.py --dry-run  # print only
"""
from __future__ import annotations

import argparse
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LIB = ROOT / "lib"
APP_LOGGER = LIB / "utils" / "app_logger.dart"
DEBUG_PRINT_RE = re.compile(r"\bdebugPrint\b")
IMPORT_RE = re.compile(r"^\s*import\s+", re.MULTILINE)
LINE_COMMENT_RE = re.compile(r"^\s*//")
BLOCK_COMMENT_RE = re.compile(r"/\*.*?\*/", re.DOTALL)


def rel_import(from_dir: Path) -> str:
    """Return a forward-slash relative path from `from_dir` to APP_LOGGER."""
    rel = os.path.relpath(APP_LOGGER, start=from_dir)
    return rel.replace(os.sep, "/")


def add_import(content: str, import_line: str) -> str:
    """Insert `import_line` after the last existing import statement."""
    matches = list(IMPORT_RE.finditer(content))
    if not matches:
        return import_line + "\n" + content
    last = matches[-1]
    end_of_line = content.index("\n", last.end())
    return content[: end_of_line + 1] + import_line + "\n" + content[end_of_line + 1 :]


def code_renames(text: str) -> int:
    """Count `debugPrint` mentions that are NOT in single-line comments.

    A mention is "in a comment" if the line it appears on (in the source)
    starts with `//` (after whitespace). Doc comments (///) also count.
    Block comments are stripped first to avoid double-counting.
    """
    stripped = BLOCK_COMMENT_RE.sub("", text)
    count = 0
    for line in stripped.splitlines():
        if LINE_COMMENT_RE.match(line):
            continue
        count += len(DEBUG_PRINT_RE.findall(line))
    return count


def rewrite(text: str) -> str:
    """Rename code-level `debugPrint` calls; leave doc comments alone.

    Strategy: walk line by line, only rewrite non-comment lines.
    """
    new_lines = []
    for line in text.splitlines(keepends=True):
        if LINE_COMMENT_RE.match(line):
            new_lines.append(line)
        else:
            new_lines.append(DEBUG_PRINT_RE.sub("appDebug", line))
    return "".join(new_lines)


def process_file(path: Path, dry_run: bool) -> tuple[int, bool]:
    text = path.read_text(encoding="utf-8")
    renames = code_renames(text)
    if renames == 0:
        return 0, False
    new_text = rewrite(text)
    if "app_logger.dart" not in new_text:
        import_line = f"import '{rel_import(path.parent)}';"
        new_text = add_import(new_text, import_line)
    if new_text == text:
        return renames, False
    if not dry_run:
        path.write_text(new_text, encoding="utf-8")
    return renames, True


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()

    files = [
        p
        for p in LIB.rglob("*.dart")
        if code_renames(p.read_text(encoding="utf-8")) > 0
    ]
    print(f"Found {len(files)} files with code-level debugPrint calls")
    total_renames = 0
    changed = 0
    for f in files:
        renames, dirty = process_file(f, dry_run=args.dry_run)
        rel = f.relative_to(ROOT)
        tag = "DRY" if args.dry_run else "WROTE"
        if dirty:
            print(f"  [{tag}] {rel} — {renames} rename(s)")
            changed += 1
        total_renames += renames
    print()
    print(f"Total: {total_renames} renames across {changed} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())

