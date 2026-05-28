#!/usr/bin/env bash
# Shared helpers. Source this from other scripts: `source "$(dirname "$0")/_common.sh"`
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PAYLOADS="$PROJECT_DIR/test-payloads.json"
PORT="${LINEUP_PORT:-3000}"
LOCAL_URL="http://localhost:$PORT"

c_green=$'\033[0;32m'; c_red=$'\033[0;31m'; c_yel=$'\033[0;33m'; c_dim=$'\033[2m'; c_off=$'\033[0m'

info()  { printf "%s%s%s\n" "$c_dim" "$*" "$c_off" >&2; }
ok()    { printf "%s✓ %s%s\n" "$c_green" "$*" "$c_off" >&2; }
warn()  { printf "%s⚠ %s%s\n" "$c_yel"   "$*" "$c_off" >&2; }
err()   { printf "%s✗ %s%s\n" "$c_red"   "$*" "$c_off" >&2; }

require_cmd() {
  for cmd in "$@"; do
    if ! command -v "$cmd" >/dev/null 2>&1; then
      err "missing required command: $cmd"
      exit 1
    fi
  done
}

mcp_post() {
  # $1 = JSON body
  curl -s -X POST "$LOCAL_URL/mcp" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "$1"
}

mcp_post_url() {
  # $1 = base URL (http://... no trailing slash, no /mcp), $2 = JSON body
  curl -s -X POST "$1/mcp" \
    -H "Content-Type: application/json" \
    -H "Accept: application/json, text/event-stream" \
    -d "$2"
}

payload() {
  # $1 = key in test-payloads.json, e.g. berlin_hack_night
  # Strips the doc-only "_comment" field so the body is valid JSON-RPC.
  require_cmd jq
  jq -c ".\"$1\" | del(._comment)" "$PAYLOADS"
}
