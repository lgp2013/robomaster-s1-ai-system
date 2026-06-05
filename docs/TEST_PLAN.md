# Test Plan

## Phase 0

1. 确认 `AGENTS.md` 已读取。
2. 确认 `ros2_robomaster_codex_prompt_v5.md` 已读取。
3. 确认环境、远程部署、GitHub 工作流文档已存在。

## Phase 1

1. 执行 `npm run check`。
2. 远程执行 `bash scripts/check_environment.sh`。
3. 远程执行 `HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh`。
4. 浏览器打开 `http://<远程服务器IP>:3000`。
5. 确认页面为中文，且主流程不要求手填 `Stream URL`。
6. 确认默认视频源来自 `runtime/app_config.json`，或在不可用时退回本地模拟视频。
7. 在 `1920x1080`、`1600x900`、`1366x768` 的 100% 缩放下检查主视频区和主按钮可见。

## Phase 2

1. 执行 `npm run check`。
2. 启动服务后请求 `GET /api/control/state`，确认返回控制状态 JSON。
3. 浏览器打开页面，确认出现：
   - `底盘摇杆`
   - `云台摇杆`
   - `急停`
   - `解除急停`
4. 切换控制模式，确认状态区同步更新。
5. 拖动底盘摇杆，确认控制状态中的 `velocityCommand` 变化。
6. 拖动云台摇杆，确认控制状态中的 `gimbalCommand` 变化。
7. 松开摇杆，确认命令自动归零。
8. 点击急停，确认 `emergencyStop=true` 且命令清零。
9. 点击解除急停，确认恢复待命。
10. 关闭页面、切换标签页或断开连接，确认后端自动归零。

## 后续阶段

- Phase 3：待实现
- Phase 4：待实现
- Phase 5：待实现
