#!/usr/bin/env bash
set -e
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
echo "BNB OTP WEB v3.0"
echo "Backend: http://127.0.0.1:8080"
echo "Public : http://127.0.0.1:5173"
PYTHONPATH="$ROOT/backend" python "$ROOT/backend/app/main.py" &
B=$!
trap "kill $B 2>/dev/null || true" EXIT
cd "$ROOT/frontend"
python -m http.server 5173 --bind 127.0.0.1
