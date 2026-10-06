#!/usr/bin/env bash
set -e

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

mkdir -p backend/app/{api,core,db,models,services} backend/tests frontend/{assets,css,js} data logs

touch backend/app/__init__.py

echo "OTP TESTING PANEL"
echo "================="
echo "Project: $ROOT"
echo "Architecture:"
echo "  frontend/        Dashboard UI"
echo "  backend/app/api/ API endpoints"
echo "  backend/app/db/  Database"
echo "  backend/app/services/ OTP + number services"
echo "  data/            Local application data"
echo "  logs/            Runtime logs"
echo
echo "BOOTSTRAP OK"
