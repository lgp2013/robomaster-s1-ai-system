# 远程测试服务器手册

## 适用范围

- 项目：RoboMaster S1 智能控制台
- 目标系统：Ubuntu 20.04
- 目标 ROS2：Foxy
- 当前阶段：Phase 1 视频预览基线

## 当前工作区检查项

- 当前本地环境是 Windows。
- 当前目录 `D:\codex\robomaster-s1-ai` 不是 Git 仓库。
- 因此当前工作区不能直接执行完整的 GitHub 交付链路。
- 远程服务器部署必须基于正式 GitHub 仓库目录执行。

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

如果仓库是私有的，先完成 GitHub 认证再执行 `git clone`。

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

如果后续项目引入 `ros2_ws/install/setup.bash`，再追加加载。当前阶段不要伪造该步骤已存在。

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

当前阶段使用单进程 Node 服务：

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

如果启用了防火墙，开放 `3000/tcp`。

## 启动后验证

### 1. 健康检查

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/robot/discovery
curl http://127.0.0.1:3000/api/video/sources
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
- 视频预览可连接。
- 状态区显示 FPS、分辨率、连接状态。
- 在 100% 缩放下主视频区和主按钮可见。

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
