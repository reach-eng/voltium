#!/bin/bash
# integration_test/e2e_individual/run_web_tests.sh
#
# Runs all E2E tests in the suite against Google Chrome using chromedriver.
# Usage: ./run_web_tests.sh [--shard-index N] [--shard-count M]
#
# Prerequisites:
#   - Chrome installed
#   - chromedriver installed (must match your Chrome version)
#   - Backend running at http://localhost:8081

# Exit immediately if a command exits with a non-zero status
set -e

echo "Starting chromedriver on port 4444..."
# Start chromedriver in the background and redirect output to a log file
chromedriver --port=4444 > chromedriver.log 2>&1 &
CHROMEDRIVER_PID=$!

# Ensure chromedriver is killed when the script exits (even on failure)
cleanup() {
    echo "Stopping chromedriver (PID: $CHROMEDRIVER_PID)..."
    kill $CHROMEDRIVER_PID
    rm -f chromedriver.log
}
trap cleanup EXIT

# Wait a couple of seconds for chromedriver to initialize
sleep 2

# Check if chromedriver is actually running
if ! ps -p $CHROMEDRIVER_PID > /dev/null; then
    echo "Error: chromedriver failed to start. Ensure it is installed and in your PATH."
    cat chromedriver.log
    exit 1
fi

echo "chromedriver is running. Executing E2E tests on web-server..."

# Run the phased tests script passing "web-server" as the device
# Forward any extra arguments (like shard-index) to the underlying script
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$DIR/run_phased_tests.sh" web-server "$@"
