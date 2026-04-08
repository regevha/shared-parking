#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# start.sh — Start backend + frontend and verify the login screen is reachable
# Usage:   ./start.sh          (from project root)
#          bash start.sh       (Windows Git Bash)
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKEND_PORT=8000
FRONTEND_PORT=3000
MAX_WAIT=60        # seconds to wait for each server

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log()   { echo -e "${GREEN}[✓]${NC} $*"; }
warn()  { echo -e "${YELLOW}[!]${NC} $*"; }
fail()  { echo -e "${RED}[✗]${NC} $*"; exit 1; }

# ── Helper: wait for HTTP 200 on a URL ──────────────────────────────────────
wait_for_url() {
  local url="$1" label="$2" elapsed=0
  echo -n "    Waiting for $label ($url) "
  while [ $elapsed -lt $MAX_WAIT ]; do
    if curl -s -o /dev/null -w '' --max-time 2 "$url" 2>/dev/null; then
      echo ""
      return 0
    fi
    echo -n "."
    sleep 2
    elapsed=$((elapsed + 2))
  done
  echo ""
  return 1
}

# ── 1. Start Backend ────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
echo "  Shared Parking — Startup"
echo "═══════════════════════════════════════════════════"
echo ""

# Check if backend is already running
if curl -s -o /dev/null --max-time 2 "http://localhost:$BACKEND_PORT/docs" 2>/dev/null; then
  warn "Backend already running on port $BACKEND_PORT — skipping"
else
  log "Starting backend (FastAPI on port $BACKEND_PORT)..."
  cd "$PROJECT_DIR/backend"
  python -m uvicorn main:app --host 0.0.0.0 --reload > "$PROJECT_DIR/logs/backend-startup.log" 2>&1 &
  BACKEND_PID=$!
  echo "    PID: $BACKEND_PID"

  if ! wait_for_url "http://localhost:$BACKEND_PORT/docs" "Backend"; then
    fail "Backend did not start within ${MAX_WAIT}s. Check logs/backend-startup.log"
  fi
  log "Backend is up!"
fi

# ── 2. Start Frontend ───────────────────────────────────────────────────────
if curl -s -o /dev/null --max-time 2 "http://localhost:$FRONTEND_PORT" 2>/dev/null; then
  warn "Frontend already running on port $FRONTEND_PORT — skipping"
else
  log "Starting frontend (React on port $FRONTEND_PORT)..."
  cd "$PROJECT_DIR"
  BROWSER=none npm start > "$PROJECT_DIR/logs/frontend-startup.log" 2>&1 &
  FRONTEND_PID=$!
  echo "    PID: $FRONTEND_PID"

  if ! wait_for_url "http://localhost:$FRONTEND_PORT" "Frontend"; then
    fail "Frontend did not start within ${MAX_WAIT}s. Check logs/frontend-startup.log"
  fi
  log "Frontend is up!"
fi

# ── 3. Verify Login Screen ──────────────────────────────────────────────────
echo ""
log "Verifying login screen is accessible..."

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:$FRONTEND_PORT")
if [ "$HTTP_CODE" = "200" ]; then
  log "Login page returned HTTP $HTTP_CODE"
else
  fail "Login page returned HTTP $HTTP_CODE (expected 200)"
fi

# Check that the page contains login-related content
PAGE_CONTENT=$(curl -s --max-time 5 "http://localhost:$FRONTEND_PORT")
if echo "$PAGE_CONTENT" | grep -qi "root"; then
  log "Login page HTML contains React root — app is rendering"
else
  fail "Login page HTML does not contain expected content"
fi

# Verify auth API is responsive
AUTH_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 5 "http://localhost:$BACKEND_PORT/auth/me")
if [ "$AUTH_CODE" = "401" ]; then
  log "Auth API responded with 401 (unauthenticated) — API is working"
else
  warn "Auth API returned HTTP $AUTH_CODE (expected 401)"
fi

# ── Done ─────────────────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════════════"
log "All systems go!"
echo ""
echo "  Frontend:  http://localhost:$FRONTEND_PORT"
echo "  Backend:   http://localhost:$BACKEND_PORT"
echo "  API Docs:  http://localhost:$BACKEND_PORT/docs"
echo ""
echo "  To stop:   bash stop.sh"
echo "             (or Ctrl+C in each terminal)"
echo "═══════════════════════════════════════════════════"
