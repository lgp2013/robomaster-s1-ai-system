# 测试计划

## 静态检查

```bash
node --check server.js
node --check web/app.js
python -m py_compile ros2_bridge.py
python -m py_compile yolo_bridge.py
```

## Phase 2 控制模式矩阵

| 测试项 | 操作 | 正常结果 |
|---|---|---|
| 底盘模式前进后退 | 点击“底盘模式”，拖动左摇杆上下 | 车辆前进/后退，云台不动 |
| 底盘模式左右转向 | 点击“底盘模式”，拖动左摇杆左右 | 车辆左转/右转，云台不动 |
| 底盘模式右摇杆保护 | 点击“底盘模式”，拖动右摇杆 | 不发送云台运动命令 |
| 云台模式偏航俯仰 | 点击“云台模式”，拖动右摇杆 | 云台左右/上下转动，车辆不移动 |
| 云台模式左摇杆保护 | 点击“云台模式”，拖动左摇杆 | 不发送底盘移动命令 |
| 联动模式右摇杆主控 | 点击“联动模式”，拖动右摇杆 | 云台偏航/俯仰变化，底盘按右摇杆方向低速跟随 |
| 联动模式左摇杆保护 | 点击“联动模式”，拖动左摇杆 | 左摇杆被忽略，底盘不应继续被左摇杆驱动 |
| 急停 | 任意模式点击“急停” | 底盘和云台立即停止 |
| 页面失焦 | 任意模式操作时切换浏览器窗口 | 底盘和云台自动停止 |
| WebSocket 断开 | 模拟断开后端连接 | 底盘和云台自动停止 |

## Phase 3 感知链路

1. 点击 `启用感知`
2. 确认视频叠加检测框
3. `GET /api/perception/state`
4. 确认 `detectionCount > 0`
5. 确认视频仍可持续刷新

## Phase 4 人物锁定与媒体管理

1. 点击非 `person` 检测框
2. 确认锁定被拒绝
3. 点击 `person` 检测框
4. 确认：
   - `lock.active=true`
   - `lock.status=locked`
   - `runtime/media/locked_targets/` 出现新 PNG
   - `runtime/media/locked_targets/index.json` 被刷新
5. 打开 `/media`
6. 确认照片列表可见，空状态和刷新按钮可用

## Phase 5 辅助跟随

1. 先锁定人物
2. 点击 `启用辅助跟随`
3. 确认：
   - `follow.enabled=true`
   - `follow.status=tracking`
   - 控制状态出现低速非零命令
4. 模拟目标丢失，确认进入 `searching`
5. 持续丢失 10 秒，确认进入 `warning` 且运动命令归零
6. 点击 `停止辅助跟随`，确认恢复空闲

## Phase 6 场景操作占位页

1. 点击顶部 `场景操作`
2. 确认新 Tab 打开 `/scene`
3. 确认页面显示“后续阶段开放”含义，而不是假控制按钮

## 远程 Ubuntu 20.04 验证

```bash
source /opt/ros/foxy/setup.bash
HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh
bash scripts/start_ros2_bridge.sh
bash scripts/start_yolo_bridge.sh
curl http://127.0.0.1:3000/api/control/state
curl http://127.0.0.1:3000/api/perception/state
curl http://127.0.0.1:3000/api/robot/info
curl http://127.0.0.1:3000/api/media/photos
```
