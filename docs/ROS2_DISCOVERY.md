# ROS2 自动发现机制

> 文档版本：v9
> 更新日期：2026-06-05

---

## 1. 自动发现启动流程

后端启动时执行：

```bash
source /opt/ros/foxy/setup.bash
# 如果存在项目工作空间
source install/setup.bash || true
```

然后执行以下发现：

```bash
ros2 node list
ros2 topic list -t
ros2 service list -t
ros2 param list
ros2 action list -t || true
```

---

## 2. 自动发现内容

### 2.1 必须识别的信息

| 类别 | 内容 | 识别方法 |
|------|------|----------|
| ROS2 发行版 | Foxy / 其他 | `printenv ROS_DISTRO` |
| 当前可见 Node | 所有节点 | `ros2 node list` |
| 当前可见 Topic | 所有 Topic | `ros2 topic list -t` |
| 当前可见 Service | 所有 Service | `ros2 service list -t` |

### 2.2 摄像头 Topic 候选

- 消息类型：`sensor_msgs/msg/Image` 或 `sensor_msgs/msg/CompressedImage`
- 常见名称：`/camera/image_color`、`/camera/image_raw`、`/image`

### 2.3 控制 Topic 候选

- 消息类型：`geometry_msgs/msg/Twist`
- 常见名称：`/cmd_vel`、`/cmd_vel_raw`、`/robot/cmd_vel`
- 识别规则：名称包含 `cmd_vel` 或消息类型为 `Twist`

### 2.4 云台控制候选

- 消息类型：`std_msgs/msg/Float64`（独立 yaw/pitch）或 `geometry_msgs/msg/Twist`（组合）
- 常见名称：
  - Yaw：`/gimbal/yaw`、`/gimbal_yaw`
  - Pitch：`/gimbal/pitch`、`/gimbal_pitch`
  - Combined：`/cmd_gimbal`、`/gimbal_cmd`
- 识别规则：名称包含 `gimbal`、`yaw`、`pitch`、`head`

### 2.5 状态 Topic 候选

| 状态 | Topic | 消息类型 |
|------|-------|----------|
| 电池 | `/battery` | `sensor_msgs/BatteryState` |
| 里程计 | `/odom` | `nav_msgs/Odometry` |
| IMU | `/imu` | `sensor_msgs/Imu` |
| 机器人状态 | `/state` | 自定义 |

---

## 3. 发现结果存储

发现结果保存到：

```text
runtime/robot_discovery.json
```

包含：
- ROS2 环境状态
- 视频源列表
- 控制 Topic 候选
- 云台 Topic 候选
- 感知 Topic 候选

---

## 4. 后端 API

### 获取发现结果

```
GET /api/robot/discovery
```

### 重新扫描

```
POST /api/ros/rescan
```

### 获取视频源

```
GET /api/video/sources
```

### 获取控制状态

```
GET /api/control/state
```

### 获取感知状态

```
GET /api/perception/state
```

---

## 5. 前端行为

1. 页面加载后自动调用 `/api/robot/discovery`
2. 显示 ROS2 连接状态
3. 显示发现到的视频源
4. 自动连接默认视频源
5. 提供"重新扫描机器人"按钮

---

## 6. 常见问题排查

### 问题：未发现 ROS2 环境

**排查步骤：**
1. 确认已执行 `source /opt/ros/foxy/setup.bash`
2. 检查 `printenv ROS_DISTRO` 输出是否为 `foxy`
3. 确认 `ros2` 命令可用：`which ros2`

### 问题：未发现摄像头 Topic

**排查步骤：**
1. 确认摄像头节点已启动：`ros2 node list | grep camera`
2. 检查摄像头 Topic：`ros2 topic list | grep image`
3. 确认 Topic 有数据：`ros2 topic hz /camera/image_color`

### 问题：未发现 cmd_vel

**排查步骤：**
1. 确认机器人控制节点已启动
2. 检查 Topic 列表：`ros2 topic list | grep cmd_vel`
3. 确认消息类型：`ros2 topic info /cmd_vel`

---

## 7. 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `ROS_DISTRO` | `foxy` | ROS2 发行版 |
| `YOLO_DETECTION_TOPIC` | `/yolo/tracking` | YOLO 检测 Topic |
| `YOLO_FRAME_WIDTH` | `1280` | 视频帧宽度 |
| `YOLO_FRAME_HEIGHT` | `720` | 视频帧高度 |
