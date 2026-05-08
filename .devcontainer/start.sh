#!/bin/bash
# Runs every time the dev container starts (postStartCommand).
# Idempotent — safe to run when services are already up.

mkdir -p logs

# Start backend
if pgrep -f 'uvicorn main:app' > /dev/null 2>&1; then
    echo "[start.sh] Backend already running, skipping."
else
    echo "[start.sh] Starting backend..."
    cd backend
    nohup python -m uvicorn main:app --host 0.0.0.0 --reload \
        > ../logs/backend.out 2>&1 &
    cd ..
fi

# Start frontend
if pgrep -f 'react-scripts start' > /dev/null 2>&1; then
    echo "[start.sh] Frontend already running, skipping."
else
    echo "[start.sh] Starting frontend..."
    BROWSER=none nohup npm start > logs/frontend.out 2>&1 &
fi

echo "[start.sh] Done. Logs: logs/backend.out  logs/frontend.out"
