#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/runtime/logs"
PID_FILE="${ROOT_DIR}/runtime/yolo_bridge.pid"

mkdir -p "${LOG_DIR}"
cd "${ROOT_DIR}"

if [ -z "${ROS_DISTRO:-}" ] && [ -f "/opt/ros/foxy/setup.bash" ]; then
  source /opt/ros/foxy/setup.bash
fi

nohup python3 "${ROOT_DIR}/yolo_bridge.py" > "${LOG_DIR}/yolo_bridge.log" 2>&1 &
echo $! > "${PID_FILE}"

echo "yolo_bridge pid: $(cat "${PID_FILE}")"
echo "log: ${LOG_DIR}/yolo_bridge.log"
