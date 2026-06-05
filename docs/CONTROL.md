# Control

## Manual Modes

### 底盘模式

- Only chassis joystick drives the robot
- Gimbal commands stay zero

### 云台模式

- Only gimbal joystick drives yaw and pitch
- Chassis velocity stays zero

### 联动模式

- Right joystick is primary
- Gimbal follows right-stick yaw and pitch
- Chassis follows right-stick direction at limited speed
- Left joystick is ignored in this mode

## Safety

- Mode switch zeroes stale commands
- Releasing joysticks zeroes commands
- Blur, page hide, WebSocket disconnect, and heartbeat timeout zero commands
- Emergency stop overrides all manual and follow output

## Topic Binding

- `cmdVel`
- `gimbalYaw`
- `gimbalPitch`

Current selections are exposed by:

- `/api/control/state`
- `/api/control/topics`

## Assisted Follow

- Requires an explicit Phase 4 person lock
- Gimbal tracks the target first
- Chassis only assists at conservative low speed
- Target loss triggers search before warning
- Target loss for 10 seconds stops follow and raises warning

## Runtime Artifacts

- `runtime/control_commands.json`
- `runtime/locks/*.png`
