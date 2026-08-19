# DEPRECATED — DO NOT USE

This directory was renamed from `e2e/` on 2026-08-08 as part of
TEST-STRATEGY-AUDIT T-P0-3 (cleanup follow-up).

**Canonical E2E suite: `../e2e_individual/`** — 49 numbered tests,
run via `e2e_individual/run_phased_tests.sh`.

**Why this directory was retired:**
- It had 9 broad-flow tests that overlapped with the 49 finer-grained
  tests in `e2e_individual/`.
- The two directories had file-numbering collisions (multiple files
  named `34_*.dart` / `35_*.dart`) that made phase-based parallel
  execution ambiguous.
- `AGENTS.md` only tracked `e2e_individual/`, so tests here quietly
  drifted and never ran in CI.

**Backup:** All 9 deprecated files + the original `DEPRECATED.md`
notice are preserved in `D:\voltium\.deprecated\e2e-old-snapshot-2026-08-08\`
for 90 days. After 2026-11-08 they can be permanently removed.

**If you need to add a new E2E test:** use `e2e_individual/`.
Pick the next free number (currently `49_` is the next slot).
