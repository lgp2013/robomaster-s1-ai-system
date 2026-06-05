#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/runtime/logs"
PID_FILE="${ROOT_DIR}/runtime/backend.pid"

mkdir -p "${LOG_DIR}"

HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-3000}"

cd "${ROOT_DIR}"

# 检查 Node.js 版本
NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
echo "Node.js 版本: ${NODE_VERSION}"

# 检查 node 是否可用
if ! command -v node &> /dev/null; then
  echo "[ERROR] 未找到 node 命令，请先安装 Node.js"
  exit 1
fi

# 启动后端，捕获退出码
HOST="${HOST}" PORT="${PORT}" nohup node server.js > "${LOG_DIR}/backend.log" 2>&1 &
PID=$!
echo $PID > "${PID_FILE}"

echo "backend pid: ${PID}"
echo "listen: http://${HOST}:${PORT}"
echo "日志: ${LOG_DIR}/backend.log"

# 等待几秒检查进程是否仍在运行
sleep 2
if ! kill -0 "${PID}" 2>/dev/null; then
  echo "[ERROR] 后端进程已退出，请查看日志:"
  tail -n 20 "${LOG_DIR}/backend.log"
  rm -f "${PID_FILE}"
  exit 1
fi

echo "后端启动成功"
