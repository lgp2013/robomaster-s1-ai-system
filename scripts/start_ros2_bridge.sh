#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/runtime/logs"
PID_FILE="${ROOT_DIR}/runtime/ros2_bridge.pid"

mkdir -p "${LOG_DIR}"

cd "${ROOT_DIR}"

# 检查 ROS2 环境
if [ -z "${ROS_DISTRO:-}" ]; then
  if [ -f "/opt/ros/foxy/setup.bash" ]; then
    source /opt/ros/foxy/setup.bash
  else
    echo "[ERROR] ROS2 Foxy 环境未找到，请先安装 ROS2 Foxy"
    exit 1
  fi
fi

echo "ROS2 发行版: ${ROS_DISTRO}"
echo "启动 ROS2 控制桥接节点..."

nohup python3 "${ROOT_DIR}/ros2_bridge.py" > "${LOG_DIR}/ros2_bridge.log" 2>&1 &
echo $! > "${PID_FILE}"

echo "ros2_bridge pid: $(cat "${PID_FILE}")"
echo "日志: ${LOG_DIR}/ros2_bridge.log"
