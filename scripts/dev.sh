#!/usr/bin/env bash
# Starts the Skybridge dev server in this terminal (foreground).
# Default port 3000. Override with LINEUP_PORT=4000 ./scripts/dev.sh
set -euo pipefail
source "$(dirname "$0")/_common.sh"

cd "$PROJECT_DIR"
info "Starting skybridge dev on port $PORT (Ctrl+C to stop)…"
exec npx skybridge dev --port "$PORT"
