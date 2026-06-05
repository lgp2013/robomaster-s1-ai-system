# Deployment

## 当前阶段

- Phase 0：完成
- Phase 1：完成
- Phase 2：已完成控制链路基线，待 Ubuntu 20.04 + ROS2 Foxy 真机验证

## 本地 Windows 启动

```bash
& 'C:\Users\LGP\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe' server.js
```

访问地址：

- `http://127.0.0.1:3000`

## 远程 Ubuntu 20.04 启动

```bash
chmod +x scripts/check_environment.sh scripts/start_backend.sh scripts/stop_backend.sh scripts/start_frontend.sh
bash scripts/check_environment.sh
source /opt/ros/foxy/setup.bash
HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh
bash scripts/start_frontend.sh
```

访问地址：

- `http://<远程服务器IP>:3000`

## 当前页面主流程

1. 页面加载时自动请求 `/api/config`。
2. 后端自动读取或生成 `runtime/robot_discovery.json`。
3. 后端优先读取 `runtime/app_config.json` 中的默认视频源配置。
4. 页面默认列出已发现视频源，并自动连接默认视频源。
5. 前端建立 `/ws/control` 控制链路，进入控制待命。
6. 用户可切换控制模式、拖动摇杆、执行急停或解除急停。

## 默认 `web_video_server` 地址

来源文件：

- `runtime/app_config.json`

当前配置值：

```text
http://10.10.10.140:8080/stream?topic=/camera/image_color&type=mjpeg
```

## 远程服务器验证命令

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/robot/discovery
curl http://127.0.0.1:3000/api/video/sources
curl http://127.0.0.1:3000/api/control/state
tail -f runtime/logs/backend.log
```

## 停止服务

```bash
bash scripts/stop_backend.sh
```
