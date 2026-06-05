#!/usr/bin/env bash

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PID_FILE="${ROOT_DIR}/runtime/backend.pid"

if [ -f "${PID_FILE}" ]; then
  PID=$(cat "${PID_FILE}" 2>/dev/null || echo "")
  if [ -n "${PID}" ] && kill -0 "${PID}" 2>/dev/null; then
    echo "停止后端 (pid: ${PID})..."
    kill "${PID}"
    sleep 1
    # 如果进程还在，强制终止
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
