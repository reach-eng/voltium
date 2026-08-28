#!/usr/bin/env python3
"""Remove a list of ARB keys from both app_en.arb and app_hi.arb.

The script preserves BOM, line endings, and exact byte content for
keys that are NOT in the remove list. It handles the ARB value-of-truth
relationship (EN ARB drives gen; HI ARB must mirror) by removing
matching key/value pairs from both files, plus their @-description
metadata blocks that immediately follow.

Usage:
  python tools/strip_dead_arb_keys.py keys.txt

Where keys.txt is a list of keys, one per line.
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent  # flutter/
EN = ROOT / "lib" / "l10n" / "app_en.arb"
HI = ROOT / "lib" / "l10n" / "app_hi.arb"


def strip_keys(path: Path, keys: set[str]) -> tuple[int, bytes]:
    """Strip a set of keys from an ARB file. Returns (count_removed, new_bytes)."""
    raw = path.read_bytes()
    if raw.startswith(b"\xef\xbb\xbf"):
        bom = b"\xef\xbb\xbf"
        text = raw[3:].decode("utf-8")
    else:
        bom = b""
        text = raw.decode("utf-8")
    lines = text.splitlines(keepends=True)
    out: list[str] = []
    i = 0
    removed = 0
    while i < len(lines):
        line = lines[i]
        # Match a key line: "  "<key>": "<value>", OR
        #                   "  "<key>": "<value>"
        m = re.match(r'^(\s+)"([a-zA-Z][a-zA-Z0-9_]*)"\s*:\s*".*"(,?)\s*$', line)
        if m and m.group(2) in keys:
            # If the value line is a key (no @-description on the SAME line),
            # the @-description may be on the next lines. Skip until
            # we exit the @-description block.
            removed += 1
            i += 1
            # Detect if this is a key that has a following @-description
            # block. The convention is: the line after a value line is
            # the @-description if it starts with the same indent + "@<key>":.
            # But that's not reliable — sometimes @-descriptions are
            # several lines AFTER the value, with other keys in between.
            # The safest rule: skip the next 1 line only if it starts
            # with `"@<key>":` at the same indent.
            if i < len(lines):
                desc_m = re.match(
                    r'^(\s+)"@([a-zA-Z][a-zA-Z0-9_]*)"\s*:\s*\{', lines[i]
                )
                if desc_m and desc_m.group(2) == m.group(2):
                    # Skip the @-description opening line. The block ends
                    # at the matching "}". Walk forward to find the close.
                    depth = 1
                    i += 1
                    while i < len(lines) and depth > 0:
                        depth += lines[i].count("{")
                        depth -= lines[i].count("}")
                        i += 1
            continue
        # Otherwise keep the line
        out.append(line)
        i += 1
    new_text = "".join(out)
    return removed, bom + new_text.encode("utf-8")


def main() -> None:
    if len(sys.argv) < 2:
        print("usage: strip_dead_arb_keys.py <keys_file>")
        sys.exit(2)
    keys_path = Path(sys.argv[1])
    keys = {
        line.strip()
        for line in keys_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    }
    print(f"Stripping {len(keys)} keys from {EN.name} and {HI.name}...")
    en_removed, en_bytes = strip_keys(EN, keys)
    hi_removed, hi_bytes = strip_keys(HI, keys)
    print(f"  app_en.arb: {en_removed} removed")
    print(f"  app_hi.arb: {hi_removed} removed")
    if en_removed != hi_removed:
        print(f"  WARNING: removal counts differ — check carefully.")
    EN.write_bytes(en_bytes)
    HI.write_bytes(hi_bytes)
    print("Done.")


if __name__ == "__main__":
    main()
