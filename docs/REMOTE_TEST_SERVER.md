# Remote Test Server

## First Deploy

```bash
cd ~
git clone https://github.com/lgp2013/robomaster-s1-ai-system.git
cd robomaster-s1-ai-system
chmod +x scripts/*.sh
```

## Update to Latest Code

```bash
cd ~/robomaster-s1-ai-system
git pull origin main
```

## Start Phase 1-5 Stack

```bash
source /opt/ros/foxy/setup.bash
HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh
bash scripts/start_ros2_bridge.sh
export YOLO_DETECTION_TOPIC=/yolo/tracking
export YOLO_FRAME_WIDTH=1280
export YOLO_FRAME_HEIGHT=720
bash scripts/start_yolo_bridge.sh
```

## Open Browser

- `http://<server-ip>:3000`

## Quick Checks

```bash
curl http://127.0.0.1:3000/api/health
curl http://127.0.0.1:3000/api/control/state
curl http://127.0.0.1:3000/api/perception/state
ros2 topic list -t
ros2 service list -t
```

## Expected Results

- Video preview is visible
- Control panel is visible without browser zoom hacks
- Detection overlay appears after enabling perception
- Only person boxes can be locked
- Assisted follow remains low speed and can be stopped immediately

## Rollback

```bash
git log --oneline -5
git checkout <commit>
```
