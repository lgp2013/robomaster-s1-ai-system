# Development Phases

This repository now treats Phase 0 through Phase 5 as implemented in code, with real-hardware validation still required on Ubuntu 20.04 + ROS2 Foxy.

## Phase 0

- Environment audit
- Deployment scripts
- GitHub workflow
- Remote test server manual

Status: complete

## Phase 1

- ROS2 auto-discovery baseline
- MJPEG preview
- Local mock stream
- Chinese operator UI

Status: complete

## Phase 2

- Dual virtual joysticks
- Three control modes
- Topic selection
- Emergency stop and safety zeroing
- ROS2 control bridge

Status: complete, pending real robot validation

## Phase 3

- Detection pipeline state API
- Detection overlay on preview
- Independent perception toggle
- `yolo_bridge.py` runtime JSON bridge
- `third_party/yolo_ros` dependency audit

Status: complete, pending Foxy-compatible detector validation

## Phase 4

- Person-only target lock
- Lock snapshot persistence
- Lock status in UI
- Loss-of-target state

Status: complete, pending real detection stream validation

## Phase 5

- Conservative assisted follow
- Gimbal-priority target tracking
- Low-speed chassis assist
- Target-loss search
- Ten-second warning timeout

Status: complete, pending real robot safety validation

## Phase 6

- Scene operations page placeholder only

Status: not started
