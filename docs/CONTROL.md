# Control

## 当前阶段范围

当前实现 Phase 2 的手动遥控、安全链路和 ROS2 Topic 发布：

- 底盘摇杆
- 云台摇杆
- 模式切换
- 急停
- 解除急停
- 断连自动归零
- 失焦自动归零
- 心跳超时自动归零
- **ROS2 Topic 发布（真机控制）**

## 控制模式

### 1. 底盘模式

- 左摇杆控制底盘
- 右摇杆输入会被记录，但不驱动底盘

### 2. 云台模式

- 右摇杆控制云台
- 底盘保持静止

### 3. 联动模式

- 左摇杆控制底盘
- 右摇杆控制云台
- 云台左右偏转会叠加低速底盘角速度，便于对准目标

## 控制链路

前端通过 WebSocket 连接：

```text
/ws/control
```

后端提供控制状态接口：

```text
/api/control/state
```

## ROS2 真机控制桥接

### 架构

```text
前端虚拟手柄
    ↓ WebSocket
Node.js 后端（server.js）
    ↓ 写入 runtime/control_commands.json
Python3 ROS2 桥接节点（ros2_bridge.py）
    ↓ 发布 ROS2 Topic
RoboMaster S1 机器人
```

### 启动步骤

**1. 启动 Node.js 后端**

```bash
cd ~/robomaster-s1-ai-system
bash scripts/start_backend.sh
```

**2. 启动 ROS2 桥接节点（需要 ROS2 Foxy 环境）**

```bash
cd ~/robomaster-s1-ai-system
source /opt/ros/foxy/setup.bash
bash scripts/start_ros2_bridge.sh
```

或手动启动：

```bash
source /opt/ros/foxy/setup.bash
python3 ros2_bridge.py
```

**3. 停止 ROS2 桥接**

```bash
bash scripts/stop_ros2_bridge.sh
```

### 发布的 Topic

| Topic | 消息类型 | 说明 |
|-------|----------|------|
| `/cmd_vel` | `geometry_msgs/Twist` | 底盘线速度和角速度 |
| `/gimbal/yaw` | `std_msgs/Float64` | 云台偏航角速度 (deg/s) |
| `/gimbal/pitch` | `std_msgs/Float64` | 云台俯仰角速度 (deg/s) |

### 自动启用逻辑

当后端检测到以下条件时，自动启用 ROS 发布：

1. 发现可用的 `/cmd_vel` Topic
2. 当前运行环境为 Ubuntu + ROS2 Foxy

不满足条件时，ROS 发布保持禁用，仅验证控制状态机。

### 安全策略

1. 松开摇杆后自动归零。
2. 浏览器失焦后自动归零。
3. 页面关闭后自动归零。
4. WebSocket 断开后自动归零。
5. 心跳超时后自动归零。
6. 急停触发后忽略新的摇杆输入，直到解除急停。
7. **命令超时时自动归零**（ros2_bridge.py 中 500ms 无新命令则发送零指令）。
8. **进程终止时自动归零**（SIGINT/SIGTERM 时发送停止命令）。

## 当前限制

- Windows 开发环境无法直接测试 ROS2 发布，需在 Ubuntu 20.04 + ROS2 Foxy 环境验证。
- 云台 Topic 名称 `/gimbal/yaw` 和 `/gimbal/pitch` 为默认值，如机器人使用不同名称需调整 `ros2_bridge.py`。
