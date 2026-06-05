#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="${ROOT_DIR}/runtime/ros2_bridge.pid"

if [ -f "${PID_FILE}" ]; then
  PID=$(cat "${PID_FILE}")
  if kill -0 "${PID}" 2>/dev/null; then
    echo "停止 ros2_bridge (pid: ${PID})..."
    kill "${PID}"
    rm -f "${PID_FILE}"
    echo "已停止"
  else
    echo "ros2_bridge 未运行"
    rm -f "${PID_FILE}"
  fi
else
  echo "ros2_bridge 未运行 (pid 文件不存在)"
fi
