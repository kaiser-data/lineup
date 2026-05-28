#!/usr/bin/env bash
# Shows what's running and whether the local MCP endpoint is healthy.
set -euo pipefail
source "$(dirname "$0")/_common.sh"

echo "== Skybridge dev =="
pgrep -afl "skybridge dev" || warn "no skybridge dev running"
echo
echo "== Alpic tunnel =="
pgrep -afl "alpic tunnel"  || warn "no alpic tunnel running"
echo
echo "== Listening ports (node) =="
lsof -i -P 2>/dev/null | awk '/node/ && /LISTEN/' || warn "no node listeners"
echo
echo "== Local MCP health ($LOCAL_URL/mcp) =="
resp=$(mcp_post '{"jsonrpc":"2.0","id":0,"method":"tools/list"}' || true)
if command -v jq >/dev/null 2>&1 && echo "$resp" | jq -e '.result.tools' >/dev/null 2>&1; then
  ok "MCP up — tools:"
  echo "$resp" | jq -r '.result.tools[] | "  - \(.name)"'
else
  err "MCP not responding at $LOCAL_URL/mcp"
  echo "$resp" | head -c 400; echo
fi
