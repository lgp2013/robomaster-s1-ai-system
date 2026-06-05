# Test Plan

## Static Checks

```bash
node --check server.js
node --check web/app.js
python -m py_compile ros2_bridge.py
python -m py_compile yolo_bridge.py
```

## Phase 2

1. `GET /api/control/state`
2. Verify joystick UI is present
3. Verify mode switch zeroes commands
4. Verify emergency stop zeroes commands

## Phase 3

1. `POST /api/perception/toggle {"enabled": true}`
2. `GET /api/perception/state`
3. Confirm `detectionCount > 0`
4. Confirm preview shows overlay boxes
5. Confirm preview still renders normally while detections update

## Phase 4

1. Click a non-person detection box
2. Confirm lock is rejected
3. Click a person detection box
4. Confirm:
   - `lock.active=true`
   - `lock.status=locked`
   - `runtime/locks/` has a new PNG snapshot
5. Click `取消锁定`
6. Confirm lock returns to idle

## Phase 5

1. Lock a person
2. Click `启用辅助跟随`
3. Confirm:
   - `follow.enabled=true`
   - `follow.status=tracking`
   - control state now contains low-speed non-zero commands
4. Simulate target loss and confirm:
   - `follow.status=searching`
   - gimbal search commands continue
5. Keep target missing for 10 seconds and confirm:
   - `follow.status=warning`
   - motion commands return to zero
6. Click `停止辅助跟随`
7. Confirm follow returns to idle

## Remote Ubuntu 20.04 Validation

```bash
source /opt/ros/foxy/setup.bash
HOST=0.0.0.0 PORT=3000 bash scripts/start_backend.sh
bash scripts/start_ros2_bridge.sh
bash scripts/start_yolo_bridge.sh
```

Then verify:

1. Browser opens `http://<server-ip>:3000`
2. Real detection boxes appear when the detector publishes
3. Only people can be locked
4. Assisted follow stays low speed
5. Emergency stop always overrides follow
