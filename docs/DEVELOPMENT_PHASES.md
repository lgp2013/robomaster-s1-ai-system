# Development Phases

This plan follows `ros2_robomaster_codex_prompt_v5.md` and treats the repository as a clean rebuild.

## Phase 0: Audit And Repository Baseline

Goal: establish a minimal, inspectable project skeleton before adding behavior.

Status:

- Complete

Key outputs:

- 环境、部署、测试、故障排查文档
- 远程测试服务器手册
- GitHub 工作流手册

## Phase 1: ROS2 自动发现与视频预览基线

Goal: make the camera image clearly visible, stable, and independent from perception.

Status:

- Complete as a deployable baseline

Current result:

- Node HTTP 服务提供静态页面、自动发现接口、MJPEG 代理和本地模拟视频
- 前端不再以手填 Stream URL 作为主流程
- 中文界面和 100% 缩放布局已完成

Remaining validation:

- Ubuntu 20.04 + ROS2 Foxy 真实摄像头 Topic 自动发现
- 真实 `web_video_server` 链路验证

## Phase 2: 手动遥控与安全链路

Goal: implement safe, usable hand control with explicit mode separation.

Status:

- Implemented in degraded mode

Current result:

- 后端新增控制状态机、控制接口和 `/ws/control`
- 前端新增底盘摇杆、云台摇杆、模式切换、急停、解除急停
- 松手、失焦、断连、心跳超时都会自动归零

Remaining validation:

- Ubuntu 20.04 + ROS2 Foxy 环境中的真实 Topic 发布
- 真机 `cmd_vel` 与云台控制 Topic 联调

## Phase 3: 感知显示

Goal: display detection results without affecting preview or control.

Status:

- Not started

## Phase 4: 目标锁定

Goal: allow locking only on supported targets, with clear state and capture behavior.

Status:

- Not started

## Phase 5: 保守跟随 MVP

Goal: provide a conservative, low-speed follow mode behind a safety boundary.

Status:

- Not started

## Phase 6: 场景操作占位

Goal: preserve an expansion surface without adding complexity now.

Status:

- Not started
