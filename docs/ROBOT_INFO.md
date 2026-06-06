# 机器人信息

## 字段来源

机器人信息模块由后端在请求 `GET /api/robot/info` 时即时读取 ROS2 Topic，不允许用固定假值冒充真实状态。

| 字段 | 当前读取策略 |
|---|---|
| 电池电量 | 依次尝试 `/battery`、`/battery_state` |
| 底盘速度 | 读取 `/odom` |
| 云台偏航 | 依次尝试 `/gimbal/angle`、`/state`、`/joint_states` |
| 云台俯仰 | 依次尝试 `/gimbal/angle`、`/state`、`/joint_states` |
| IMU 状态 | 依次尝试 `/imu`、`/imu/data` |
| 连接质量 | 依次尝试 `/robot_status`、`/status` |
| 运行时长 | 依次尝试 `/robot_status`、`/status` |
| 错误码 | 依次尝试 `/robot_status`、`/status` |
| 固件版本 | 依次尝试 `/robot_status`、`/status` |
| 最后更新 | 后端生成当前时间戳 |

## 返回规则

- ROS2 未连接时，只显示 `未连接 ROS2` 或 `未发现`
- Topic 有数据时才显示真实值
- Topic 无数据或字段缺失时显示 `未发现`
- 不再用“良好 / 运行中 / 已连接 / 无”之类推断值冒充真实机器人状态

## API 示例

```json
{
  "generatedAt": "2026-06-06T10:00:00.000Z",
  "battery": "84.0%",
  "velocity": "0.15 / 0.02",
  "gimbalYaw": "12.4°",
  "gimbalPitch": "-3.0°",
  "imuStatus": "正常",
  "connectionQuality": "91.0%",
  "uptime": "3600s",
  "errorCode": "0",
  "firmwareVersion": "1.2.3",
  "lastUpdateAt": "2026-06-06T10:00:00.000Z"
}
```

## 注意事项

1. 当前实现通过 `ros2 topic echo --once` 做只读拉取，适合 Phase 2-6 联调，不适合高频遥测展示。
2. 若实际机器人 Topic 名称不同，应先看 `docs/ROS2_DISCOVERY.md` 中的发现结果，再调整读取候选列表。
3. 远程 Ubuntu 20.04 + ROS2 Foxy 是正式验收环境，本地 Windows 只能做 UI 和接口验证。
