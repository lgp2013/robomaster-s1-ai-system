# Control

## 当前范围

Phase 2 只解决手动遥控、安全归零、Topic 选择和 ROS2 控制桥接，不引入识别、锁定或跟随策略以外的自动行为。

当前已实现：

- 底盘摇杆
- 云台摇杆
- 三种控制模式
- 模式切换强制清零
- 急停 / 解除急停
- 页面失焦、关闭、断连、心跳超时自动归零
- 后端控制 Topic 选择
- `runtime/control_commands.json` 到 ROS2 Topic 的桥接发布

## 模式语义

### 1. 底盘模式

- 只有底盘摇杆生效
- 云台摇杆输入会被记录，但不会驱动云台
- 线速度和角速度仅由底盘摇杆产生

### 2. 云台模式

- 只有云台摇杆生效
- 底盘保持零速
- yaw / pitch 角速度仅由云台摇杆产生

### 3. 联动模式

- 由云台摇杆主控
- 右摇杆同时输出：
  - 云台 `yawRate`
  - 云台 `pitchRate`
  - 底盘跟随线速度 `linearX`
  - 底盘跟随角速度 `angularZ`
- 左摇杆输入在联动模式下被忽略
- 模式目的是让车体低速跟随云台指向，而不是开放双摇杆自由混控

## 安全策略

1. 任意模式切换时立即清零底盘和云台命令。
2. 松开摇杆后立即归零。
3. 页面失焦、标签页隐藏、窗口关闭时归零。
4. WebSocket 断开时归零。
5. 心跳超时后归零。
6. 急停锁定期间忽略新的摇杆输入。
7. `ros2_bridge.py` 在命令超时后自动发布零指令。
8. `ros2_bridge.py` 收到退出信号时先发零指令再退出。

## Topic 选择

前端会展示当前候选 Topic，并允许在 Phase 2 内手动改绑：

- `cmd_vel`
- `gimbalYaw`
- `gimbalPitch`

后端保存当前选择到 `runtime/control_commands.json`，桥接节点按该文件动态绑定发布器。

## 控制链路

```text
前端虚拟摇杆
  -> WebSocket /ws/control
Node.js 后端 server.js
  -> runtime/control_commands.json
Python 桥接 ros2_bridge.py
  -> 当前选定的 ROS2 Topic
RoboMaster S1
```

## 远程验证前提

- Ubuntu 20.04
- ROS2 Foxy
- 已能发现真实 `cmd_vel` 与云台 Topic
- 已启动 `ros2_bridge.py`

## 当前边界

- 联动模式仍是保守限速映射，不是闭环姿态控制。
- 云台合并 Topic 还没有单独发布器，当前 Phase 2 只处理 `yaw` / `pitch` 分离 Topic。
- 真机验收必须在远程 Ubuntu 20.04 + ROS2 Foxy 环境完成。
