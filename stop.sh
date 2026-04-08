#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# stop.sh — Gracefully stop backend + frontend servers
# Usage:   ./stop.sh          (from project root)
#          bash stop.sh       (Windows Git Bash)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

BACKEND_PORT=8000
FRONTEND_PORT=3000

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; }

stopped_any=false

echo ""
echo "═══════════════════════════════════════════════════"
echo "  Shared Parking — Shutdown"
echo "═══════════════════════════════════════════════════"
echo ""

# ── Helper: find and kill processes on a given port ────────────────────────
kill_port() {
  local port="$1" label="$2"

  # Windows: use netstat + taskkill via cmd.exe
  if command -v cmd.exe &>/dev/null; then
    local pids
    pids=$(cmd.exe /c "netstat -ano | findstr :$port | findstr LISTENING" 2>/dev/null \
      | awk '{print $NF}' | sort -u | tr -d '\r')

    if [ -z "$pids" ]; then
      warn "$label — nothing running on port $port"
      return
    fi

    for pid in $pids; do
      cmd.exe /c "taskkill /PID $pid /F" >/dev/null 2>&1 && \
        log "$label stopped (PID $pid)" || \
        fail "$label — could not stop PID $pid"
    done
    stopped_any=true
    return
  fi

  # Unix/macOS: use lsof + kill
  local pids
  pids=$(lsof -ti :"$port" 2>/dev/null || true)

  if [ -z "$pids" ]; then
    warn "$label — nothing running on port $port"
    return
  fi

  for pid in $pids; do
    kill "$pid" 2>/dev/null && \
      log "$label stopped (PID $pid)" || \
      fail "$label — could not stop PID $pid"
  done
  stopped_any=true
}

# ── Stop Backend ───────────────────────────────────────────────────────────
kill_port "$BACKEND_PORT" "Backend (port $BACKEND_PORT)"

# ── Stop Frontend ──────────────────────────────────────────────────────────
kill_port "$FRONTEND_PORT" "Frontend (port $FRONTEND_PORT)"

# ── Summary ────────────────────────────────────────────────────────────────
echo ""
if [ "$stopped_any" = true ]; then
  log "Shutdown complete."
else
  warn "No servers were running."
fi
echo ""
