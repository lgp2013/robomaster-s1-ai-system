# Troubleshooting

## Preview Works but No Detection Boxes

1. Check `GET /api/perception/state`
2. Confirm `enabled=true`
3. If `providerMode=mock-fallback`, you are still on mock detections
4. If using ROS2 detections, verify `runtime/detections.json` is being updated

## Detection Bridge Has No Output

```bash
source /opt/ros/foxy/setup.bash
ros2 topic list -t | grep yolo
ros2 topic echo /yolo/tracking --once
cat runtime/detections.json
```

## Cannot Lock Target

- Phase 4 only allows `person`
- Non-person detections are intentionally rejected
- If no `person` box exists, first verify the detector output classes

## Follow Does Not Start

- Lock a person first
- Check `GET /api/perception/state`
- Confirm `lock.active=true`
- Confirm `follow.enabled=true`

## Follow Stops Immediately

- Target may be too stale or missing
- Assisted follow auto-stops on target loss warning
- Emergency stop or manual disable may have reset commands

## ROS2 Control Does Not Move Robot

```bash
source /opt/ros/foxy/setup.bash
ros2 topic list -t
cat runtime/control_commands.json
ros2 topic echo /cmd_vel
```

- Also verify current selected topics in `GET /api/control/state`

## Foxy Compatibility Risk

- Current `third_party/yolo_ros` upstream main branch is not declared compatible with Foxy
- If it fails to build on Ubuntu 20.04, use a compatible detector publisher and keep `yolo_bridge.py` unchanged
