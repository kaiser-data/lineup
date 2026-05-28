#!/usr/bin/env bash
# Invoke a test payload against the local MCP and pretty-print the result.
#
# Usage:
#   ./scripts/test.sh                       # default: berlin_hack_night
#   ./scripts/test.sh launch_party
#   ./scripts/test.sh wedding_after_party
#   ./scripts/test.sh berlin_hack_night raw # full JSON, no summary
#
# Override target URL with LINEUP_URL=https://<tunnel>.alpic.dev
set -euo pipefail
source "$(dirname "$0")/_common.sh"
require_cmd jq curl

key="${1:-berlin_hack_night}"
mode="${2:-summary}"
target="${LINEUP_URL:-$LOCAL_URL}"

body="$(payload "$key")"
if [[ "$body" == "null" || -z "$body" ]]; then
  err "no payload named '$key' in $PAYLOADS"
  echo "Available:" >&2
  jq -r 'keys[]' "$PAYLOADS" | sed 's/^/  - /' >&2
  exit 2
fi

info "POST $target/mcp — payload: $key"
resp="$(mcp_post_url "$target" "$body")"

if echo "$resp" | jq -e '.error' >/dev/null 2>&1; then
  err "MCP error:"
  echo "$resp" | jq '.error'
  exit 1
fi

case "$mode" in
  raw)
    echo "$resp" | jq .
    ;;
  *)
    echo "$resp" | jq '{
      summary: .result.content[0].text,
      event: {
        title: .result.structuredContent.event.title,
        date:  .result.structuredContent.event.dateISO,
        venue: .result.structuredContent.event.venue,
        accent: .result.structuredContent.event.accentHex,
        rsvpUrl: .result.structuredContent.event.rsvpUrl
      },
      attendees: [.result.structuredContent.badges[] | {name, role}],
      svgSizes: {
        eventQrBytes:  (.result.structuredContent.event.qrSvg | length),
        firstAvatarBytes: (.result.structuredContent.badges[0].avatarSvg | length),
        firstVcardQrBytes: (.result.structuredContent.badges[0].vcardQrSvg | length)
      }
    }'
    ;;
esac
