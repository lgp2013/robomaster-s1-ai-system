# Project Audit

Date: 2026-06-05

## Scope

This audit reflects the repository state after reading `AGENTS.md` and `ros2_robomaster_codex_prompt_v3.md`.

## Findings

- 一个最小可运行的 Phase 1 应用骨架已存在。
- 当前实现采用 `server.js + web/` 结构，而不是 v4 推荐的 `backend/ + frontend/` 结构。
- 已补充 ROS2 自动发现接口骨架与 `runtime/robot_discovery.json` 生成逻辑。
- 当前工作区未检测到 ROS2，因此自动发现处于降级模式，仅暴露本地模拟视频源。
- No ROS2 package structure is present yet.
- No teleoperation, perception, target-lock, or follow-control implementation is present yet.
- The repository currently contains:
  - `AGENTS.md`
  - `ros2_robomaster_codex_prompt_v3.md`
  - `package.json`
  - `server.js`
  - `web/index.html`
  - `web/app.js`
  - `web/styles.css`
  - `docs/PROJECT_AUDIT.md`
  - `docs/DEVELOPMENT_PHASES.md`
  - `docs/OPEN_SOURCE_DEPS.md`
  - `docs/RUNBOOK.md`
  - `docs/TEST_PLAN.md`
  - `docs/TROUBLESHOOTING.md`

## Current Stack

- Frontend: present, plain browser app under `web/`
- Backend: present, Node HTTP server in `server.js`
- ROS2 packages: not detected
- Video pipeline: present as MJPEG proxy plus local mock stream
- Control pipeline: not detected
- Perception integration: not detected
- Reusable code: present in the stream client/parser and server routing
- Legacy code candidates: none

## Implications

- This is a clean rebuild, not a continuation of an existing implementation.
- Old business code is not available and should not be assumed to exist.
- The first implementation step now exists: a minimal runnable video preview baseline.
- The current implementation partially aligns with v4 Phase 1:
  - done: Chinese UI, compact layout, auto-discovery APIs, local mock source
  - pending: real ROS2 Foxy discovery in Ubuntu 20.04, true camera topic scan, recommended backend/frontend directory split
- The phase order from the prompt remains valid:
  - Phase 0: audit and documentation
  - Phase 1: video preview baseline
  - Phase 2: manual teleop
  - Phase 3: perception display
  - Phase 4: target lock
  - Phase 5: follow MVP
  - Phase 6: scene operations placeholder

## Recommended Constraints For The First Build

- Keep video preview independent from perception.
- Keep manual control independent from perception.
- Keep future ROS2 bridge boundaries explicit, even if the initial implementation is minimal.
- Do not introduce automatic follow behavior before the lower-risk phases are stable.

## Unknowns To Resolve In The Next Step

- Actual camera topic names
- Actual ROS2 package names
- Existing robot transport or bridge mechanism, if any
- Existing frontend framework choice, if any
- Existing video source and whether `web_video_server`/MJPEG is already available
- Actual Ubuntu 20.04 runtime details in this workspace
