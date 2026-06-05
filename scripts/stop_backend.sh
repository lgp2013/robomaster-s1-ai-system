#!/usr/bin/env bash

# 使用 pm2 停止后端

if command -v pm2 &> /dev/null; then
  if pm2 describe robomaster-backend &> /dev/null; then
    echo "停止 pm2 进程 robomaster-backend..."
    pm2 stop robomaster-backend
    pm2 delete robomaster-backend
    echo "已停止"
  else
    echo "pm2 进程 robomaster-backend 未运行"
  fi
else
  echo "pm2 未安装，尝试通过 PID 文件停止..."

  ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
  PID_FILE="${ROOT_DIR}/runtime/backend.pid"

  if [ -f "${PID_FILE}" ]; then
    PID=$(cat "${PID_FILE}" 2>/dev/null || echo "")
    if [ -n "${PID}" ] && kill -0 "${PID}" 2>/dev/null; then
      echo "停止后端 (pid: ${PID})..."
      kill "${PID}"
      sleep 1
      if kill -0 "${PID}" 2>/dev/null; then
        echo "强制终止..."
        kill -9 "${PID}"
      fi
      rm -f "${PID_FILE}"
      echo "已停止"
    else
      echo "后端未运行"
      rm -f "${PID_FILE}"
    fi
  else
    echo "后端未运行 (pid 文件不存在)"
  fi
fi
