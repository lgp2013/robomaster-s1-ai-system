# 控制链路

## 控制模式

### 底盘模式

- 只响应左侧底盘摇杆
- 发布底盘线速度和角速度
- 云台指令保持零值

### 云台模式

- 只响应右侧云台摇杆
- 发布云台偏航和俯仰指令
- 底盘速度保持零值

### 联动模式

- 右侧云台摇杆是唯一主控输入
- `X` 轴控制云台偏航，同时驱动底盘低速转向
- `Y` 轴控制云台俯仰，同时驱动底盘低速前进/后退
- 左侧底盘摇杆在该模式下被忽略，并立即归零

## 安全策略

- 切换模式前先归零，避免残留速度继续输出
- 松开摇杆后自动归零
- 页面失焦后自动归零
- 浏览器窗口失焦后自动归零
- WebSocket 断开后自动归零
- 心跳超时后自动归零
- 急停始终最高优先级，覆盖手动控制和辅助跟随

## Topic 绑定

当前后端会自动发现并允许前端选择：

- `cmdVel`
- `gimbalYaw`
- `gimbalPitch`
- `gimbalCombined`

当前选择结果通过以下接口查看：

- `GET /api/control/state`
- `GET /api/control/topics`
- `POST /api/control/topics`

## 运行时文件

- `runtime/control_commands.json`
- `runtime/media/locked_targets/`
- `runtime/media/locked_targets/index.json`

## 远程联调检查

1. `curl http://127.0.0.1:3000/api/control/state`
2. 确认 `mode`、`velocityCommand`、`gimbalCommand`、`selectedTopics` 正常返回
3. 打开控制台页面，分别测试三种模式
4. 在联动模式下确认只有右摇杆能驱动底盘跟随
5. 触发急停，确认底盘和云台命令同时归零
