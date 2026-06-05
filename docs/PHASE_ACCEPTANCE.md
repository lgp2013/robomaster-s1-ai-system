# Phase Acceptance

## Phase 1

- No manual stream URL required
- Preview connects to discovered or configured source
- Main layout works at 100% browser zoom

## Phase 2

- Dual joystick teleop works
- Emergency stop works
- Mode switching zeroes stale commands
- Topic selection writes back to state

## Phase 3

- Perception can be enabled independently
- Detection boxes appear on the preview
- Video preview remains usable while detections update
- `/api/perception/state` returns current detections

## Phase 4

- Only `person` detections can be locked
- Locking stores one snapshot
- Lock state is visible in the UI
- Unlock returns to plain detection mode

## Phase 5

- Assisted follow requires an explicit person lock
- Gimbal tracks first
- Chassis speed remains conservative
- Lost target triggers search
- Lost target for 10 seconds raises a warning
- Emergency stop remains effective during follow
