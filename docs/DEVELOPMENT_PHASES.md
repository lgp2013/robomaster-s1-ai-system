# Development Phases

This plan follows `ros2_robomaster_codex_prompt_v5.md` and treats the repository as a clean rebuild.

## Phase 0: Audit And Repository Baseline

Goal: establish a minimal, inspectable project skeleton before adding behavior.

Deliverables:

- `docs/PROJECT_AUDIT.md`
- `docs/DEVELOPMENT_PHASES.md`
- `docs/OPEN_SOURCE_DEPS.md`
- `docs/RUNBOOK.md`
- `docs/TEST_PLAN.md`
- `docs/TROUBLESHOOTING.md`
- `docs/REMOTE_TEST_SERVER.md`
- `docs/GITHUB_WORKFLOW.md`
- `docs/AGENTS_CONFLICTS.md`

Verification:

- Repository structure is explicit
- The next implementation entry points are clear
- Old business code is not being reused as the new system foundation
- Remote Ubuntu 20.04 deployment flow is documented

Current status:

- Complete
- v5 GitHub delivery path is currently blocked because `D:\codex\robomaster-s1-ai` is not a Git repository

## Phase 1: Video Preview Baseline

Goal: make the camera image clearly visible, stable, and independent from perception.

Target outcome:

- Browser can open a video preview page
- Preview works without YOLO being enabled
- Preview reconnects after disconnects
- UI shows stream status, FPS, latency, and reconnect state

Implementation constraints:

- Do not carry raw 1080P frames through ROS bridge JSON/WebSocket
- Keep overlay rendering separate from the video stream itself
- Prefer the simplest available baseline first, typically MJPEG or an existing web video server

Verification:

- 1080P preview is visible
- Disabling perception does not break preview
- Disconnect state is visible and recovers automatically when the stream returns
- Video preview does not depend on YOLO or follow logic

Current status:

- Implemented as a local browser app plus Node HTTP server and MJPEG proxy
- Local mock stream is available for smoke testing
- Real MJPEG sources can be injected through backend discovery or environment configuration
- Frontend no longer requires Stream URL input as the main flow
- Chinese UI and compact responsive layout are implemented
- Real ROS2 auto-discovery remains blocked by the current non-ROS Windows environment
- Remote-server binding and deployment scripts are now present for Ubuntu-side validation

## Phase 2: Manual Teleoperation

Goal: implement safe, usable hand control with clear mode separation.

Target outcome:

- Left joystick controls chassis motion
- Right joystick controls gimbal motion
- Emergency stop is always accessible
- Control mode switching is explicit

Verification:

- Manual motion works
- Emergency stop takes priority
- Release returns to neutral

## Phase 3: Perception Display

Goal: display detection results without affecting preview or control.

Target outcome:

- Detection results are published asynchronously
- Overlay is drawn on a separate layer
- Person and object results are visually distinguishable

Verification:

- Video remains usable when perception is on or off
- Perception failures do not block the UI

## Phase 4: Target Lock

Goal: allow locking only on supported targets, with clear state and capture behavior.

Target outcome:

- Person target can be locked
- Non-person targets are rejected unless explicitly supported by the model
- Locked target state is visible

Verification:

- Locking and canceling work
- Locked capture or snapshot storage works

## Phase 5: Follow MVP

Goal: provide a conservative, low-speed follow mode behind a safety boundary.

Target outcome:

- Follow mode depends on a locked person
- Manual override can take control immediately
- Lost-target search and timeout behavior are implemented

Verification:

- Follow behavior is stable at low speed
- Timeout and safety stop work as specified

## Phase 6: Scene Operations Placeholder

Goal: preserve an expansion surface without adding complexity now.

Target outcome:

- A scene-operations page or tab exists
- It shows a reserved/coming-soon state
- It does not interfere with existing functions

## Working Rule

Only advance one phase at a time unless the current phase is already demonstrably stable and testable.

## Environment Constraint

- Target runtime and installation instructions should assume Ubuntu 20.04 unless a later document explicitly states otherwise.
