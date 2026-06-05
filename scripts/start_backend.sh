#!/usr/bin/env bash
# 注意：不使用 set -euo pipefail，因为 nohup 后台进程需要灵活处理

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

# 如果已有进程在运行，先停止
if [ -f "${PID_FILE}" ]; then
  OLD_PID=$(cat "${PID_FILE}" 2>/dev/null || echo "")
  if [ -n "${OLD_PID}" ] && kill -0 "${OLD_PID}" 2>/dev/null; then
    echo "停止已有后端进程 (pid: ${OLD_PID})..."
    kill "${OLD_PID}"
    sleep 1
  fi
fi

# 使用 nohup + disown 确保进程在 shell 退出后继续运行
# 重定向 stdout/stderr 到日志文件
HOST="${HOST}" PORT="${PORT}" nohup node server.js > "${LOG_DIR}/backend.log" 2>&1 &
PID=$!

# 立即 disown，防止 shell 作业控制影响
disown $PID 2>/dev/null || true

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
echo ""
echo "查看日志: tail -f ${LOG_DIR}/backend.log"
echo "停止后端: bash scripts/stop_backend.sh"
