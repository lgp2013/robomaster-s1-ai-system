# 远程测试服务器

## 1. 系统要求

- Ubuntu 20.04
- ROS2 Foxy
- Node.js 可用
- Python 3 可用

## 2. 登录方式

- 通过 SSH 登录远程服务器后执行以下命令

## 3. 首次部署

```bash
cd ~
git clone https://github.com/lgp2013/robomaster-s1-ai-system.git
cd robomaster-s1-ai-system
chmod +x scripts/*.sh
```

## 4. 后续更新

```bash
cd ~/robomaster-s1-ai-system
git pull origin main
```

## 5. ROS2 环境准备

```bash
source /opt/ros/foxy/setup.bash
printenv ROS_DISTRO
which ros2
ros2 topic list -t
ros2 service list -t
```

## 6. Python / Node.js / 构建检查

```bash
python3 --version
node --version
npm --version
```

## 7. 后端启动

```bash
cd ~/robomaster-s1-ai-system
HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh
```

## 8. ROS2 控制桥接启动

```bash
cd ~/robomaster-s1-ai-system
bash scripts/start_ros2_bridge.sh
```

## 9. YOLO 桥接启动

```bash
cd ~/robomaster-s1-ai-system
export YOLO_DETECTION_TOPIC=/yolo/tracking
export YOLO_FRAME_WIDTH=1280
export YOLO_FRAME_HEIGHT=720
bash scripts/start_yolo_bridge.sh
```

## 10. 浏览器访问地址

- 控制台：`http://<服务器IP>:3000`
- 媒体管理：`http://<服务器IP>:3000/media`
- 场景操作：`http://<服务器IP>:3000/scene`

## 11. 端口开放说明

- 确认服务器已放行 `3000`
- 后端必须绑定 `0.0.0.0`，不能只绑定 `127.0.0.1`

## 12. 如何确认服务已启动

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/control/state
curl http://127.0.0.1:3000/api/perception/state
curl http://127.0.0.1:3000/api/robot/info
curl http://127.0.0.1:3000/api/media/photos
```

## 13. 如何确认 ROS2 Topic 可发现

```bash
curl http://127.0.0.1:3000/api/robot/discovery
ros2 topic list -t
ros2 topic echo /cmd_vel --once
```

## 14. 如何确认视频源可预览

1. 打开控制台首页
2. 点击 `重新扫描机器人`
3. 确认视频源列表出现
4. 若无真机视频源，点击 `使用本地模拟视频`

## 15. 如何回滚

```bash
git log --oneline -5
git checkout <commit>
```

## 16. 如何停止服务

```bash
bash scripts/stop_yolo_bridge.sh
bash scripts/stop_ros2_bridge.sh
bash scripts/stop_backend.sh
```
