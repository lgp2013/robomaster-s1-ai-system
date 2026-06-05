# 远程测试服务器手册

## 适用范围

- 项目：RoboMaster S1 智能控制台
- 目标系统：Ubuntu 20.04
- 目标 ROS2：Foxy
- 当前阶段：Phase 2 手动遥控与安全链路

## 仓库检查项

- 当前正式仓库目录：`D:\codex\robomaster-s1-ai-system`
- 当前分支：`main`
- 目标远端：`https://github.com/lgp2013/robomaster-s1-ai-system.git`

## 前提条件

1. 远程服务器已安装 Ubuntu 20.04。
2. 远程服务器已安装 ROS2 Foxy。
3. 远程服务器已安装 `git`、`python3`、`node`、`npm`。
4. 远程服务器可以访问 GitHub。
5. 远程服务器可以访问机器人网络和 `web_video_server`。

建议先执行：

```bash
bash scripts/check_environment.sh
```

## 首次部署

```bash
cd ~
git clone https://github.com/lgp2013/robomaster-s1-ai-system.git
cd robomaster-s1-ai-system
chmod +x scripts/check_environment.sh scripts/start_backend.sh scripts/stop_backend.sh scripts/start_frontend.sh
```

## 后续更新

```bash
cd ~/robomaster-s1-ai-system
git branch --show-current
git pull origin <当前分支名>
```

## ROS2 Foxy 环境准备

```bash
source /opt/ros/foxy/setup.bash
printenv ROS_DISTRO
which ros2
ros2 node list
ros2 topic list -t
```

## `web_video_server` 配置检查

默认视频源来自：

- `runtime/app_config.json`

当前默认地址：

```text
http://10.10.10.140:8080/stream?topic=/camera/image_color&type=mjpeg
```

远程服务器部署前先验证该地址可达：

```bash
curl -I "http://10.10.10.140:8080/stream?topic=/camera/image_color&type=mjpeg"
```

## 启动方式

```bash
cd ~/robomaster-s1-ai-system
HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh
bash scripts/start_frontend.sh
```

说明：

- 前端由后端静态托管。
- `start_frontend.sh` 当前只输出说明，不启动独立进程。

## 浏览器访问

```text
http://<远程服务器IP>:3000
```

## 启动后验证

### 1. 健康检查

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/robot/discovery
curl http://127.0.0.1:3000/api/video/sources
curl http://127.0.0.1:3000/api/control/state
```

### 2. 日志检查

```bash
tail -f runtime/logs/backend.log
```

### 3. 浏览器检查

确认：

- 页面主文案为中文。
- 页面主流程不要求手填 `Stream URL`。
- 页面自动展示发现到的视频源。
- 页面出现底盘摇杆、云台摇杆、急停、解除急停。
- 视频预览可连接。
- 控制模式可切换。
- 摇杆松手后命令自动归零。

## 停止服务

```bash
cd ~/robomaster-s1-ai-system
bash scripts/stop_backend.sh
```

## 回滚

```bash
cd ~/robomaster-s1-ai-system
git log --oneline -n 10
git checkout <目标commit>
HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh
```

## 常见问题

### 1. `git clone` 或 `git pull` 失败

- 检查 GitHub 认证。
- 检查仓库地址是否正确。
- 检查服务器网络是否能访问 GitHub。

### 2. 页面只有本地模拟视频

- 检查 `runtime/app_config.json`。
- 检查 `web_video_server` 地址是否可达。
- 检查 ROS2 图像 Topic 是否存在。

### 3. 页面打不开

- 检查 `scripts/start_backend.sh` 是否成功执行。
- 检查 `3000` 端口是否被防火墙拦截。
- 检查访问的服务器 IP 是否正确。

### 4. 摇杆拖动但真机不动

- 当前版本默认先验证控制状态机，不默认对真机发布控制指令。
- 检查 `/api/control/state` 中的 `cmdVel` 候选 Topic。
- 后续需要在 Ubuntu 20.04 + ROS2 Foxy 环境接入真实控制桥。
