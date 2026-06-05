# Test Plan

## Phase 0

1. 确认已读取 `AGENTS.md`。
2. 确认已读取最新提示词 `ros2_robomaster_codex_prompt_v6.md`。
3. 确认环境、部署、GitHub 工作流文档存在且可用。

## Phase 1

1. 执行 `node --check server.js`。
2. 执行 `node --check web/app.js`。
3. 启动后端并访问页面。
4. 确认视频源来自自动发现或配置文件默认地址。
5. 确认页面 100% 缩放下主视频区、状态区、控制区都可见。

## Phase 2

### 本地烟雾检查

1. 执行 `node --check server.js`。
2. 执行 `node --check web/app.js`。
3. 请求 `GET /api/control/state`，确认返回：
   - `mode`
   - `modeNotice`
   - `selectedTopics`
   - `candidateTopics`
   - `velocityCommand`
   - `gimbalCommand`
4. 页面确认出现：
   - `底盘摇杆`
   - `云台摇杆`
   - `急停`
   - Topic 选择下拉框

### 模式矩阵

1. 切到 `底盘模式`：
   - 左摇杆前推，`linearX` 变化
   - 左摇杆左右，`angularZ` 变化
   - 右摇杆动作时，`yawRate` / `pitchRate` 维持零
2. 切到 `云台模式`：
   - 右摇杆左右，`yawRate` 变化
   - 右摇杆上下，`pitchRate` 变化
   - 左摇杆动作时，`linearX` / `angularZ` 维持零
3. 切到 `联动模式`：
   - 右摇杆左右，`yawRate` 和 `angularZ` 同时变化
   - 右摇杆上下，`pitchRate` 和 `linearX` 同时变化
   - 左摇杆动作时，底盘与云台输出不应被其驱动
4. 每次切模式后，确认命令先被清零，再接受新输入。

### 安全矩阵

1. 松开摇杆，命令归零。
2. 点击 `急停`，确认：
   - `emergencyStop=true`
   - 底盘与云台命令立刻归零
   - 新摇杆输入被忽略
3. 点击 `解除急停`，确认恢复待命。
4. 切换标签页、窗口失焦、关闭页面，确认后端归零。
5. 断开 WebSocket，确认后端归零。
6. 停止发送心跳，确认后端归零。

### Topic 绑定矩阵

1. 修改 `cmd_vel` 下拉框，确认 `GET /api/control/state` 中 `selectedTopics.cmdVel` 更新。
2. 修改 `gimbalYaw` / `gimbalPitch` 下拉框，确认状态同步更新。
3. 检查 `runtime/control_commands.json`，确认写入了最新 `selectedTopics`。

### 远程真机验证

1. `source /opt/ros/foxy/setup.bash`
2. 启动后端：`HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh`
3. 启动桥接：`bash scripts/start_ros2_bridge.sh`
4. 浏览器访问 `http://<server-ip>:3000`
5. 用 `ros2 topic echo` 验证当前选定 Topic 上有正确的零值与非零值输出。

## 后续阶段

- Phase 3：待实现
- Phase 4：待实现
- Phase 5：待实现
- Phase 6：待实现
