#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/runtime/logs"
PID_FILE="${ROOT_DIR}/runtime/backend.pid"

mkdir -p "${LOG_DIR}"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"

cd "${ROOT_DIR}"
HOST="${HOST}" PORT="${PORT}" nohup node server.js > "${LOG_DIR}/backend.log" 2>&1 &
echo $! > "${PID_FILE}"

echo "backend pid: $(cat "${PID_FILE}")"
echo "listen: http://${HOST}:${PORT}"
