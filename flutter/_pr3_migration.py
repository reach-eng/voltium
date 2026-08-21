#!/usr/bin/env python3
"""
PR-3 (2026-08-21): bulk-migrate test files from the AppProvider shim
to direct Riverpod provider overrides.

Transformations:
  1. Drop the import of `...app_provider.dart`
  2. Drop the `class _TestAppProvider extends AppProvider { ... }` block
  3. Drop the `appProvider.overrideWith((ref) => ...)` line
"""
import re
import sys
from pathlib import Path

REPO = Path(r"D:\voltium\flutter")

TEST_FILES = [
    r"test\support\faq_screen_test.dart",
    r"test\kyc\kyc_screen_test.dart",
    r"test\rental\active_rental_test.dart",
    r"test\dashboard\pre_dashboard_screen_test.dart",
    r"test\plans\plan_selection_test.dart",
    r"test\guarantor\guarantor_screen_test.dart",
    r"test\return\return_request_test.dart",
    r"test\notifications\notifications_test.dart",
    r"test\wallet\topup_flow_test.dart",
    r"test\profile\edit_profile_screen_test.dart",
    r"test\pickup\vehicle_photos_screen_test.dart",
    r"test\pickup\tl_details_screen_test.dart",
    r"test\workflows\rider_workflow_hub_screen_test.dart",
    r"test\wallet\wallet_screen_enhanced_test.dart",
    r"test\emergency\emergency_sos_screen_test.dart",
    r"test\emergency\emergency_sos_backend_alert_test.dart",
    r"test\app\router_pickup_draft_test.dart",
    r"test\app\router_body_test.dart",
    r"test\dashboard\active_dashboard_screen_test.dart",
    r"test\features\notifications\presentation\screens\notifications_screen_test.dart",
    r"test\features\guarantor\presentation\screens\guarantor_onboarding_screen_test.dart",
]


def transform(text: str) -> str:
    # 1. Drop the import line (with trailing newline)
    text = re.sub(
        r"^import\s+['\"]package:voltium_rider/core/state/app_provider\.dart['\"];\s*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    # 2. Drop the class definition block:
    #    "class _TestAppProvider extends AppProvider { ... }"
    # Use a DOTALL regex to span multiple lines, balancing braces.
    # The class body is well-formed: starts after `{`, ends at matching `}`.
    def drop_class(match: re.Match) -> str:
        # Return empty string (drop the class). The leading whitespace
        # before the class is consumed by the regex's `^[ \t]*`.
        return ""

    # Find each "class XXX extends AppProvider" and drop it.
    pattern = re.compile(
        r"^[ \t]*class\s+\w+\s+extends\s+AppProvider\s*\{",
        re.MULTILINE,
    )

    while True:
        m = pattern.search(text)
        if not m:
            break
        # Walk forward, tracking brace depth
        start = m.start()
        i = m.end()  # position right after `{`
        depth = 1
        while i < len(text) and depth > 0:
            c = text[i]
            if c == "{":
                depth += 1
            elif c == "}":
                depth -= 1
            i += 1
        # Drop from start to i (exclusive of trailing newline, included
        # if present).
        end = i
        if end < len(text) and text[end] == "\n":
            end += 1
        text = text[:start] + text[end:]

    # 3. Drop the override line.
    text = re.sub(
        r"^[ \t]*appProvider\.overrideWith\([^)]*\),?\s*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    return text


def main() -> int:
    failures: list[str] = []
    for rel in TEST_FILES:
        path = REPO / rel
        if not path.exists():
            failures.append(f"missing: {rel}")
            continue
        original = path.read_text(encoding="utf-8")
        new = transform(original)
        if new == original:
            failures.append(f"no change: {rel}")
            continue
        path.write_text(new, encoding="utf-8")
        print(f"updated: {rel}")
    if failures:
        print()
        print("issues:")
        for f in failures:
            print(f"  {f}")
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
