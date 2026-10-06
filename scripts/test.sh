#!/usr/bin/env bash
set -e

cd "$(dirname "$0")/.."

echo "[1/4] Python syntax check..."
PYTHONDONTWRITEBYTECODE=1 python -m py_compile backend/app/main.py

echo "[2/4] Starting backend..."
LOGFILE="$PWD/logs/test-server.log"
rm -f "$LOGFILE"

PYTHONPATH="$PWD" python backend/app/main.py >"$LOGFILE" 2>&1 &
PID=$!

cleanup() {
    kill "$PID" 2>/dev/null || true
}
trap cleanup EXIT

sleep 1

echo "[3/4] Health check..."
curl -fsS http://127.0.0.1:8080/health
echo

echo "[4/4] Login check..."
LOGIN=$(curl -fsS \
  -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"admin12345"}' \
  http://127.0.0.1:8080/api/auth/login)

echo "$LOGIN"
echo
echo "================================"
echo "BACKEND TEST OK"
echo "================================"
