# Deployment

## Start Order

1. Source ROS2 Foxy
2. Start backend
3. Start control bridge when real robot control is needed
4. Start detection bridge when real detection topics are available
5. Open the browser UI

## Backend

```bash
cd ~/robomaster-s1-ai-system
HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh
```

## Control Bridge

```bash
cd ~/robomaster-s1-ai-system
source /opt/ros/foxy/setup.bash
bash scripts/start_ros2_bridge.sh
```

## Detection Bridge

```bash
cd ~/robomaster-s1-ai-system
source /opt/ros/foxy/setup.bash
export YOLO_DETECTION_TOPIC=/yolo/tracking
export YOLO_FRAME_WIDTH=1280
export YOLO_FRAME_HEIGHT=720
bash scripts/start_yolo_bridge.sh
```

## Stop Commands

```bash
bash scripts/stop_ros2_bridge.sh
bash scripts/stop_yolo_bridge.sh
```

## Validation URLs

- UI: `http://<server-ip>:3000`
- Health: `http://<server-ip>:3000/api/health`
- Control state: `http://<server-ip>:3000/api/control/state`
- Perception state: `http://<server-ip>:3000/api/perception/state`

## Expected Runtime Files

- `runtime/control_commands.json`
- `runtime/detections.json`
- `runtime/locks/*.png`
