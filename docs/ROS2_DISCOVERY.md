# ROS2 Discovery

## 当前实现状态

当前后端已提供自动发现接口骨架，但由于工作区未检测到 ROS2，发现结果处于降级模式。

## 当前接口

- `GET /api/config`
- `GET /api/health`
- `GET /api/ros/status`
- `POST /api/ros/rescan`
- `GET /api/robot/discovery`
- `GET /api/robot/capabilities`
- `GET /api/video/sources`
- `GET /api/video/status`

## 当前发现文件

- `runtime/robot_discovery.json`

## 当前发现逻辑

1. 检测运行环境。
2. 检测 `ROS_DISTRO`。
3. 检测 `ros2` 命令是否存在。
4. 优先读取 `runtime/app_config.json` 中的默认视频源。
5. 若配置文件未提供地址，则回退到 `ROBOMASTER_STREAM_URL` 环境变量。
6. 无论 ROS2 是否存在，始终提供本地模拟视频源用于 Phase 1 测试。

## 当前限制

- 未进入真实 ROS2 Topic 扫描。
- 未扫描 `sensor_msgs/msg/Image`。
- 未扫描 `sensor_msgs/msg/CompressedImage`。
- 未扫描 `geometry_msgs/msg/Twist`。

## 下一步

在 Ubuntu 20.04 + ROS2 Foxy 环境中补齐：

```bash
ros2 node list
ros2 topic list -t
ros2 service list -t
ros2 param list
ros2 action list -t || true
```
