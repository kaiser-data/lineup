#!/usr/bin/env bash
# Calls generate-lineup with a named payload and writes every artifact to disk:
#   out/<key>/event.ics
#   out/<key>/event-qr.svg
#   out/<key>/badges/<slug>-avatar.svg
#   out/<key>/badges/<slug>-vcard-qr.svg
#   out/<key>/response.json
#
# Usage:
#   ./scripts/save-artifacts.sh                 # berlin_hack_night
#   ./scripts/save-artifacts.sh launch_party
#
# Target URL override: LINEUP_URL=https://<tunnel>.alpic.dev
set -euo pipefail
source "$(dirname "$0")/_common.sh"
require_cmd jq curl

key="${1:-berlin_hack_night}"
target="${LINEUP_URL:-$LOCAL_URL}"
outdir="$PROJECT_DIR/out/$key"
mkdir -p "$outdir/badges"

body="$(payload "$key")"
[[ "$body" == "null" || -z "$body" ]] && { err "no payload '$key'"; exit 2; }

info "POST $target/mcp — saving to $outdir"
resp="$(mcp_post_url "$target" "$body")"

if echo "$resp" | jq -e '.error' >/dev/null 2>&1; then
  err "MCP error:"; echo "$resp" | jq '.error'; exit 1
fi

echo "$resp" | jq . > "$outdir/response.json"

# Event-level
echo "$resp" | jq -r '.result.structuredContent.event.icsString' > "$outdir/event.ics"
echo "$resp" | jq -r '.result.structuredContent.event.qrSvg'    > "$outdir/event-qr.svg"
ok "wrote event.ics + event-qr.svg"

# Per badge
count=$(echo "$resp" | jq '.result.structuredContent.badges | length')
for ((i=0; i<count; i++)); do
  name=$(echo "$resp" | jq -r ".result.structuredContent.badges[$i].name")
  slug=$(echo "$name" | tr '[:upper:]' '[:lower:]' | sed 's/[^a-z0-9]\{1,\}/-/g; s/^-//; s/-$//')
  echo "$resp" | jq -r ".result.structuredContent.badges[$i].avatarSvg"   > "$outdir/badges/${slug}-avatar.svg"
  echo "$resp" | jq -r ".result.structuredContent.badges[$i].vcardQrSvg" > "$outdir/badges/${slug}-vcard-qr.svg"
  ok "  ${slug}: avatar + vCard QR"
done

ok "done — open: $outdir"
