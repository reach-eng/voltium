#!/usr/bin/env python3
"""
PR-3 pass 2: catch what the first pass missed.

Patterns to remove:
  - Any line containing `appProvider.overrideWith`
  - Any line matching `final ... = AppProvider();`
  - For guarantor_onboarding_screen_test.dart: also drop the
    `testAppProvider.riderProvider.setRider(const RiderModel(...))` blocks.
"""
import re
from pathlib import Path

REPO = Path(r"D:\voltium\flutter")

TEST_FILES = [
    r"test\app\router_body_test.dart",
    r"test\app\router_pickup_draft_test.dart",
    r"test\dashboard\active_dashboard_screen_test.dart",
    r"test\dashboard\pre_dashboard_screen_test.dart",
    r"test\emergency\emergency_sos_backend_alert_test.dart",
    r"test\emergency\emergency_sos_screen_test.dart",
    r"test\features\guarantor\presentation\screens\guarantor_onboarding_screen_test.dart",
    r"test\features\notifications\presentation\screens\notifications_screen_test.dart",
    r"test\guarantor\guarantor_screen_test.dart",
    r"test\kyc\kyc_screen_test.dart",
    r"test\notifications\notifications_test.dart",
    r"test\plans\plan_selection_test.dart",
    r"test\profile\edit_profile_screen_test.dart",
    r"test\return\return_request_test.dart",
    r"test\rental\active_rental_test.dart",
    r"test\support\faq_screen_test.dart",
    r"test\wallet\topup_flow_test.dart",
    r"test\wallet\wallet_screen_enhanced_test.dart",
    r"test\wallet\wallet_screen_test.dart",
    r"test\pickup\vehicle_photos_screen_test.dart",
    r"test\pickup\tl_details_screen_test.dart",
    r"test\workflows\rider_workflow_hub_screen_test.dart",
]


def transform(text: str) -> str:
    original = text

    # 1. Drop any line containing appProvider.overrideWith
    text = re.sub(
        r"^[ \t]*[^\n]*appProvider\.overrideWith[^\n]*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    # 2. Drop any line `final X = AppProvider();`
    text = re.sub(
        r"^[ \t]*final\s+\w+\s*=\s*AppProvider\(\);\s*\n",
        "",
        text,
        flags=re.MULTILINE,
    )

    # 3. Drop `testAppProvider.riderProvider.setRider(const RiderModel(...))`
    #    blocks (for guarantor_onboarding_screen_test.dart). The block is
    #    a `const RiderModel(\n ...\n)` so we need to find the matching paren.
    pattern = re.compile(
        r"^[ \t]*testAppProvider\.riderProvider\.setRider\(",
        re.MULTILINE,
    )
    while True:
        m = pattern.search(text)
        if not m:
            break
        i = m.end()
        depth = 1
        while i < len(text) and depth > 0:
            c = text[i]
            if c == "(":
                depth += 1
            elif c == ")":
                depth -= 1
            i += 1
        end = i
        if end < len(text) and text[end] == ";":
            end += 1
        if end < len(text) and text[end] == "\n":
            end += 1
        text = text[: m.start()] + text[end:]

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
            continue  # no change needed
        path.write_text(new, encoding="utf-8")
        print(f"updated: {rel}")
    return 0


if __name__ == "__main__":
    import sys
    sys.exit(main())
