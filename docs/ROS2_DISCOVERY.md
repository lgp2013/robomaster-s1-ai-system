# ROS2 Discovery

## Current Auto-Discovery

The backend scans:

- image topics
- `cmd_vel` candidates
- gimbal control topics
- YOLO detection topics
- YOLO-related services

## Control Topic Rules

- `geometry_msgs/msg/Twist` or names containing `cmd_vel` are treated as chassis candidates
- names containing `gimbal`, `yaw`, or `pitch` are treated as gimbal candidates

## Perception Topic Rules

- types containing `yolo_msgs/msg/DetectionArray`
- names containing `/yolo/`

## Runtime Outputs

- `runtime/robot_discovery.json`
- `runtime/control_commands.json`
- `runtime/detections.json`

## Rescan API

- `POST /api/ros/rescan`

## Result APIs

- `GET /api/robot/discovery`
- `GET /api/control/state`
- `GET /api/perception/state`
