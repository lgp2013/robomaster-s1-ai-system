# Environment

## 目标环境

- 操作系统：Ubuntu 20.04
- ROS2：Foxy
- Python：3.8
- Node.js：LTS
- 浏览器：Chrome / Chromium

## 当前仓库检查结果

- 仓库目录：`D:\codex\robomaster-s1-ai-system`
- Git 分支：`main`
- 远端：`origin -> https://github.com/lgp2013/robomaster-s1-ai-system.git`
- 当前开发机操作系统：Windows 10
- 当前开发机 Shell：PowerShell
- Node.js：`v24.14.0`
- Python：`3.8.10`
- `ROS_DISTRO`：未设置
- `ros2`：当前开发机未检测到

## 结论

- 当前仓库已经进入正式 Git 工作树，可以执行 `git add`、`git commit`、`git push`。
- 当前开发机仍然不是目标联调环境，只能完成本地基线开发、文档维护和模拟链路验证。
- 真实 ROS2 自动发现、摄像头 Topic 扫描、`cmd_vel` 联调，必须在 Ubuntu 20.04 + ROS2 Foxy 服务器验证。

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
4. 若 RoboMaster S1 通过 ROS2 封装节点接入，还需先启动相机节点和控制节点。

## 当前版本降级策略

- 未检测到 ROS2 时，后端返回本地模拟视频源和中文排查说明。
- 若 `runtime/app_config.json` 存在 `video.defaultStreamUrl`，系统优先将其作为默认视频源。
- 控制链路在无 ROS2 环境下仍可验证 WebSocket、虚拟手柄、急停和自动归零，但不会真实发到机器人。
