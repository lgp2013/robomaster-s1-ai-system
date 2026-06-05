# 机器人信息

## 功能说明

机器人信息模块通过 ROS2 Topic 读取 RoboMaster S1 的实时状态信息，并在控制台页面显示。

## 显示字段

| 字段 | 说明 | 数据来源 | 未读取时显示 |
|------|------|----------|-------------|
| 电池电量 | 电池剩余百分比 | `/battery_state` | `-` |
| 底盘速度 | 线速度 / 角速度 | `/odom` | `-` |
| 云台偏航 | 云台当前偏航角度 | `/gimbal/angle` | `-` |
| 云台俯仰 | 云台当前俯仰角度 | `/gimbal/angle` | `-` |
| IMU 状态 | 惯性测量单元状态 | `/imu/data` | `-` |
| 连接质量 | WiFi/网络连接质量 | 系统检测 | `-` |
| 运行时长 | 机器人累计运行时间 | `/robot_status` | `-` |
| 错误码 | 当前错误代码 | `/robot_status` | `-` |
| 固件版本 | 机器人固件版本 | `/robot_status` | `-` |
| 最后更新 | 数据最后更新时间 | 系统生成 | `-` |

## ROS2 Topic 映射

### 电池状态

```
Topic: /battery_state
Type: sensor_msgs/BatteryState
Fields:
  - percentage: 电池百分比 (0.0 ~ 1.0)
```

### 底盘速度

```
Topic: /odom
Type: nav_msgs/Odometry
Fields:
  - twist.linear.x: 线速度 (m/s)
  - twist.angular.z: 角速度 (rad/s)
```

### 云台角度

```
Topic: /gimbal/angle
Type: geometry_msgs/Vector3 (或自定义消息)
Fields:
  - x (yaw): 偏航角度 (度)
  - y (pitch): 俯仰角度 (度)
```

### IMU 数据

```
Topic: /imu/data
Type: sensor_msgs/Imu
Fields:
  - orientation: 姿态四元数
  - angular_velocity: 角速度
  - linear_acceleration: 线加速度
```

### 机器人状态

```
Topic: /robot_status
Type: std_msgs/String (或自定义消息，JSON格式)
Fields:
  - uptime: 运行时长 (秒)
  - error_code: 错误码
  - firmware_version: 固件版本
  - connection_quality: 连接质量 (0-100)
```

## API 接口

### 获取机器人信息

```
GET /api/robot/info
```

**响应：**
```json
{
  "generatedAt": "2026-06-05T12:00:00.000Z",
  "battery": "85%",
  "velocity": "0.50 / 0.30",
  "gimbalYaw": "15.5°",
  "gimbalPitch": "-5.2°",
  "imuStatus": "正常",
  "connectionQuality": "92%",
  "uptime": "3600s",
  "errorCode": "0",
  "firmwareVersion": "1.2.3",
  "lastUpdateAt": "2026-06-05T12:00:00.000Z"
}
```

## 数据刷新

- 前端每 2 秒轮询一次 `/api/robot/info`
- 后端每次请求时实时读取 ROS2 Topic
- 读取失败时返回 `-`，不显示假数据

## 注意事项

1. 所有 Topic 读取都是**只读**的，不会影响机器人运行
2. 如果 ROS2 环境未就绪，所有字段显示为 `-`
3. Topic 名称可能因机器人固件版本不同而变化，需要根据实际情况调整
4. 当前实现使用 `ros2 topic echo --once` 命令读取，可能有一定延迟
5. 建议在实际部署前确认机器人发布的 Topic 名称和消息类型

## 扩展建议

如需添加更多字段，可在 `server.js` 的 `updateRobotInfoFromRos()` 函数中添加新的 Topic 读取逻辑。
