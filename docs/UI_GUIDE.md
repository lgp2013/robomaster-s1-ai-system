# UI Guide

## Main Areas

### Video Preview

- Main visual focus
- Detection boxes are rendered on top of the preview
- Person boxes can be clicked for Phase 4 target lock

### Manual Control

- Left joystick: chassis
- Right joystick: gimbal
- Mode switcher: chassis / gimbal / follow-gimbal
- Emergency stop is always visible

### Perception and Follow

- `启用感知`: starts mock or runtime detection display
- `取消锁定`: clears current person lock and stops follow
- `启用辅助跟随`: starts Phase 5 conservative follow after a person is locked
- `停止辅助跟随`: forces return to zero autonomous commands

## Locking Rules

- Only `person` detections are lockable
- Clicking non-person detections shows a refusal message
- Locking saves one snapshot into `runtime/locks/`

## Follow Rules

- Follow is disabled until a person is locked
- Follow drives the gimbal first
- Chassis motion remains low speed
- Lost target triggers search first, warning later
