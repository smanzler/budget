#!/usr/bin/env bash
# down.sh — stop the stack: dev servers, then containers, then the session.
#
# Usage:
#   pnpm down              # graceful stop
#   pnpm down -- --purge   # also delete volumes (wipes the database)

set -uo pipefail

SESSION="${SETTLE_SESSION:-settle}"
ROOT=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)
COMPOSE="$ROOT/docker/docker-compose.yml"
PORTS=(24000 23000 28081 25432 25433 9090 21025 28025)
PURGE=0

step() { printf '\n\033[1m==> %s\033[0m\n' "$*"; }
info() { printf '  %s\n' "$*"; }
warn() { printf '\033[33m  %s\033[0m\n' "$*"; }

while [ $# -gt 0 ]; do
  case "$1" in
    --purge)   PURGE=1 ;;
    -h|--help) sed -n '2,7p' "$0" | sed 's/^# \{0,1\}//'; exit 0 ;;
    *)         printf '\033[31mdown: unknown flag %s\033[0m\n' "$1" >&2; exit 2 ;;
  esac
  shift
done

# macOS ships no coreutils `timeout`, so guard the blocking docker calls.
with_timeout() {
  local secs="$1"; shift
  ( eval "$@" ) & local pid=$!
  ( sleep "$secs"; kill -0 "$pid" 2>/dev/null && {
      printf '\033[33m  timed out after %ss — killing\033[0m\n' "$secs"
      kill -TERM "$pid" 2>/dev/null; sleep 2; kill -KILL "$pid" 2>/dev/null
    } ) & local watch=$!
  wait "$pid" 2>/dev/null; local rc=$?
  kill "$watch" 2>/dev/null; wait "$watch" 2>/dev/null
  return $rc
}

port_busy() { lsof -nP -iTCP:"$1" -sTCP:LISTEN >/dev/null 2>&1; }

# ------------------------------------------------------------- 1. dev servers
step "Stopping dev servers"
if tmux has-session -t "=$SESSION:" 2>/dev/null; then
  while read -r pane; do
    tmux send-keys -t "$pane" C-c 2>/dev/null
  done < <(tmux list-panes -s -t "=$SESSION:" -F '#{pane_id}' 2>/dev/null)
  info "sent interrupt to every pane in '$SESSION'"

  # Wait for the watchers to release their ports before taking the database
  # away, so tsx and vite exit cleanly instead of on a dropped connection.
  for _ in $(seq 1 10); do
    port_busy 24000 || port_busy 23000 || port_busy 28081 || break
    sleep 1
  done
else
  info "no session '$SESSION'"
fi

# --------------------------------------------------------------- 2. containers
step "Stopping containers"
if docker info >/dev/null 2>&1; then
  if [ "$PURGE" = 1 ]; then
    warn "--purge: this DELETES volumes — the database will be wiped"
    with_timeout 120 "docker compose -f '$COMPOSE' down --remove-orphans --volumes"
  else
    with_timeout 120 "docker compose -f '$COMPOSE' down --remove-orphans"
  fi
  info "compose project down"
else
  warn "Docker is not responding — containers left alone"
fi

# ------------------------------------------------------------------ 3. verify
step "Verifying"
BUSY=""
for p in "${PORTS[@]}"; do port_busy "$p" && BUSY="$BUSY $p"; done
if [ -n "$BUSY" ]; then
  warn "ports still bound:$BUSY"
  for p in $BUSY; do
    holder=$(lsof -nP -iTCP:"$p" -sTCP:LISTEN 2>/dev/null | tail -n +2 | awk '{print $2}' | sort -u | head -1)
    [ -n "$holder" ] && printf '    %-6s pid=%-7s %s\n' "$p" "$holder" \
      "$(ps -o command= -p "$holder" 2>/dev/null | cut -c1-64)"
  done
else
  info "all stack ports free"
fi

# ----------------------------------------------------------------- 4. session
if tmux has-session -t "=$SESSION:" 2>/dev/null; then
  if [ "$(tmux display-message -p '#S' 2>/dev/null)" = "$SESSION" ]; then
    # Killing the session from inside it would kill this script first.
    # run-shell -b runs on the tmux server, so it outlives this pane.
    tmux run-shell -b "sleep 1; tmux kill-session -t '=$SESSION:'"
    printf '\n\033[32mDone — session '\''%s'\'' closing.\033[0m\n' "$SESSION"
  else
    tmux kill-session -t "=$SESSION:"
    printf '\n\033[32mDone — session '\''%s'\'' killed.\033[0m\n' "$SESSION"
  fi
else
  printf '\n\033[32mDone.\033[0m\n'
fi
