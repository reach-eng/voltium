#!/bin/bash
# integration_test/run_phased_tests.sh
#
# Top-level convenience wrapper for the E2E test suite. Forwards to
# the canonical script in e2e_individual/. TEST-STRATEGY-AUDIT T-P2-1
# (2026-08-08): this wrapper exists so a developer at the repo root
# can `cd flutter && bash integration_test/run_phased_tests.sh` without
# remembering the e2e_individual/ subdir.
#
# The canonical script remains e2e_individual/run_phased_tests.sh —
# CI invokes it directly to avoid the indirection.

set -e
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
exec "$SCRIPT_DIR/e2e_individual/run_phased_tests.sh" "$@"
