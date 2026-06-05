# Environment

## 目标环境

- 操作系统：Ubuntu 20.04
- ROS2 发行版：Foxy
- Python：3.8
- Node.js：LTS
- 浏览器：Chrome / Chromium

## 当前工作区检查结果

- 工作目录：`D:\codex\robomaster-s1-ai`
- 操作系统：Windows 10.0.26200.0
- Shell：PowerShell
- Node.js：`v24.14.0`
- Python：`3.8.10`
- `ROS_DISTRO`：未设置
- `ros2`：未检测到
- Git 仓库状态：当前目录不是 Git 仓库，无法在此目录直接执行 v5 要求的 `git add/commit/push`

## 结论

- 当前工作区只能完成 Phase 1 的本地基线开发、文档补齐和模拟视频验证。
- 真实 ROS2 自动发现、摄像头 Topic 扫描、`cmd_vel` 联调，必须在 Ubuntu 20.04 + ROS2 Foxy 服务器验证。
- GitHub 交付链路当前被目录形态阻塞，需先进入正式仓库目录，或在该目录重新克隆目标仓库后再执行阶段提交。

## 远程服务器环境检查命令

```bash
bash scripts/check_environment.sh
source /opt/ros/foxy/setup.bash
printenv ROS_DISTRO
which ros2
ros2 node list
ros2 topic list -t
ros2 topic hz /camera/image_color
ros2 topic echo /cmd_vel --once
```

## 运行前提

1. 服务器必须能访问项目代码目录。
2. 服务器必须已安装 Node.js，并能执行 `node server.js`。
3. 真实联调时必须先 `source /opt/ros/foxy/setup.bash`。
4. 若 RoboMaster S1 通过 ROS2 封装节点接入，还需先启动相机和控制节点。

## 当前版本降级策略

- 未检测到 ROS2 时，后端返回本地模拟视频源和中文排查说明。
- 若 `runtime/app_config.json` 存在 `video.defaultStreamUrl`，系统优先将其作为默认视频源。
- 前端主流程不要求手填 `Stream URL`。
