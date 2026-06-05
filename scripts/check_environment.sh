#!/usr/bin/env bash
set -euo pipefail

echo "=== system ==="
if command -v lsb_release >/dev/null 2>&1; then
  lsb_release -a || true
fi
uname -a || true

echo
echo "=== runtimes ==="
python3 --version || true
node --version || true
npm --version || true

echo
echo "=== ros2 ==="
printenv ROS_DISTRO || true
which ros2 || true
ros2 --version || true
ros2 node list || true
ros2 topic list -t || true
