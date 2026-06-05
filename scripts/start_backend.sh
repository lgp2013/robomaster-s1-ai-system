#!/usr/bin/env bash
# 使用 pm2 启动后端（推荐生产环境）
# 前提：npm install -g pm2

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
LOG_DIR="${ROOT_DIR}/runtime/logs"

mkdir -p "${LOG_DIR}"

cd "${ROOT_DIR}"

# 检查 pm2 是否安装
if ! command -v pm2 &> /dev/null; then
  echo "[INFO] pm2 未安装，正在全局安装..."
  npm install -g pm2
fi

# 检查 Node.js 版本
NODE_VERSION=$(node --version 2>/dev/null || echo "unknown")
echo "Node.js 版本: ${NODE_VERSION}"

# 检查 node 是否可用
if ! command -v node &> /dev/null; then
  echo "[ERROR] 未找到 node 命令，请先安装 Node.js"
  exit 1
fi

# 如果已有进程在运行，先停止
if pm2 describe robomaster-backend &> /dev/null; then
  echo "停止已有 pm2 进程..."
  pm2 stop robomaster-backend
  pm2 delete robomaster-backend
fi

# 使用 pm2 启动
HOST="${HOST:-0.0.0.0}" PORT="${PORT:-3000}" pm2 start server.js \
  --name robomaster-backend \
  --env HOST="${HOST:-0.0.0.0}" \
  --env PORT="${PORT:-3000}" \
  --log "${LOG_DIR}/backend.log" \
  --error "${LOG_DIR}/backend-error.log" \
  --output "${LOG_DIR}/backend-out.log"

echo ""
echo "后端已启动"
echo "查看状态: pm2 status"
echo "查看日志: pm2 logs robomaster-backend"
echo "停止后端: pm2 stop robomaster-backend"
echo "重启后端: pm2 restart robomaster-backend"
