#!/usr/bin/env bash
# Stops local skybridge dev and alpic tunnel processes.
set -euo pipefail
source "$(dirname "$0")/_common.sh"

stopped=0
for pat in "alpic tunnel" "skybridge dev"; do
  if pgrep -f "$pat" >/dev/null 2>&1; then
    pkill -f "$pat" || true
    ok "stopped: $pat"
    stopped=1
  fi
done
[[ $stopped -eq 0 ]] && info "nothing to stop"
