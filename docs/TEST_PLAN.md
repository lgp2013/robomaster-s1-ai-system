# Test Plan

## Phase 0

1. 确认 `AGENTS.md` 已读取。
2. 确认 `ros2_robomaster_codex_prompt_v5.md` 已读取。
3. 确认新增 `docs/REMOTE_TEST_SERVER.md`、`docs/GITHUB_WORKFLOW.md`、`docs/AGENTS_CONFLICTS.md`。
4. 确认当前目录不是 Git 仓库这一阻塞已写入环境和部署文档。
5. 确认远程 Ubuntu 20.04 + ROS2 Foxy 的部署步骤已写入文档。

## Phase 1

1. 本地执行 `node --check server.js`。
2. 本地执行 `node --check web/app.js`。
3. 远程执行 `bash scripts/check_environment.sh`。
4. 远程执行 `HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh`。
5. 浏览器打开 `http://<远程服务器IP>:3000`。
6. 确认页面普通文案为中文。
7. 确认页面默认显示“已发现视频源”，而不是 Stream URL 手工输入主流程。
8. 确认默认视频源来自 `runtime/app_config.json`，或在不可用时退回本地模拟视频。
9. 点击“重新扫描机器人”，确认发现区刷新。
10. 在 `1920x1080`、`1600x900`、`1366x768` 的 100% 缩放下检查主视频区和主按钮可见。

## 后续阶段

- Phase 2：待实现
- Phase 3：待实现
- Phase 4：待实现
- Phase 5：待实现
