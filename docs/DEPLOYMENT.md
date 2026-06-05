# Deployment

## 当前阶段

- Phase 0：文档和环境审计已补齐
- Phase 1：Node 单进程基线可运行，前端由后端静态托管
- Phase 2 及以后：未实现

## 当前工作区阻塞

- 当前目录不是 Git 仓库。
- 本阶段无法在当前目录执行 v5 要求的 `git status`、`git add`、`git commit`、`git push`。
- 若要满足 v5，必须先在正式仓库目录中继续开发，或将当前内容迁移到目标仓库工作树。

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
3. 后端优先读取 `runtime/app_config.json` 的 `video.defaultStreamUrl`。
4. 若未检测到 ROS2，接口返回中文降级原因和排查建议。
5. 页面默认列出已发现视频源，并自动接入默认源或本地模拟源。

## 默认 `web_video_server` 地址

来源文件：

- [app_config.json](D:\codex\robomaster-s1-ai\runtime\app_config.json)

当前配置值：

```text
http://10.10.10.140:8080/stream?topic=/camera/image_color&type=mjpeg
```

## 远程服务器验证命令

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/robot/discovery
curl http://127.0.0.1:3000/api/video/sources
tail -f runtime/logs/backend.log
```

## 停止服务

```bash
bash scripts/stop_backend.sh
```
