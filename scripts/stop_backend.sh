#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="${ROOT_DIR}/runtime/backend.pid"

if [[ ! -f "${PID_FILE}" ]]; then
  echo "backend pid file not found"
  exit 0
fi

PID="$(cat "${PID_FILE}")"
if kill "${PID}" >/dev/null 2>&1; then
  echo "stopped backend pid ${PID}"
else
  echo "backend pid ${PID} is not running"
fi

rm -f "${PID_FILE}"
