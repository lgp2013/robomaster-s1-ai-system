# Environment

## Target

- Ubuntu 20.04
- ROS2 Foxy
- Python 3.8
- Node.js LTS
- Chromium or Chrome

## Required Checks

```bash
lsb_release -a
uname -a
python3 --version
node --version
npm --version
printenv ROS_DISTRO
which ros2
ros2 --version || true
ros2 topic list -t
ros2 service list -t
```

## ROS2 Prerequisites

```bash
source /opt/ros/foxy/setup.bash
printenv ROS_DISTRO
ros2 node list
ros2 topic list -t
```

## Control Bridge Prerequisites

- A valid chassis topic, usually `cmd_vel`
- Available gimbal topics when real gimbal control is needed
- `ros2_bridge.py` started after sourcing ROS2 Foxy

## Perception Bridge Prerequisites

- A `yolo_msgs/DetectionArray` publisher or equivalent compatible topic
- `yolo_bridge.py` started after sourcing ROS2 Foxy
- Frame size env vars matched to the real video stream when needed:

```bash
export YOLO_DETECTION_TOPIC=/yolo/tracking
export YOLO_FRAME_WIDTH=1280
export YOLO_FRAME_HEIGHT=720
```

## Compatibility Constraint

- Latest `yolo_ros` upstream main branch is not declared compatible with ROS2 Foxy.
- Real remote validation therefore depends on one of:
  - a Foxy-compatible detector node publishing equivalent detection messages
  - a separately adapted `yolo_ros` branch in the remote ROS2 workspace

## Browser and Network

- The backend must bind to `HOST=0.0.0.0`
- Default HTTP port is `3000`
- Browser must be able to reach `http://<server-ip>:3000`
