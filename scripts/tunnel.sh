#!/usr/bin/env bash
# Starts an Alpic tunnel forwarding the public URL to LINEUP_PORT (default 3000).
# Kills any pre-existing local alpic tunnel processes first to avoid
# "A tunnel is already open" collisions.
set -euo pipefail
source "$(dirname "$0")/_common.sh"

if pgrep -f "alpic tunnel" >/dev/null 2>&1; then
  warn "killing existing alpic tunnel processes…"
  pkill -f "alpic tunnel" || true
  sleep 2
fi

info "Opening Alpic tunnel → $LOCAL_URL (Ctrl+C to stop). The /mcp endpoint will be at <tunnel-url>/mcp."
cd "$PROJECT_DIR"
exec npx alpic tunnel --port "$PORT"
