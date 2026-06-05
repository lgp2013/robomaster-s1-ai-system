# Open Source Dependencies

## yolo_ros

- Project: `yolo_ros`
- URL: `https://github.com/mgonzs13/yolo_ros`
- Branch: `main`
- Commit: `61c9cf363403d1eaa360c8f12f6bcfe7ca993c7f`
- Local path: `third_party/yolo_ros`
- License: `GPL-3.0`
- Usage in this repository:
  - Referenced for ROS2 detection topic shape and launch expectations
  - Audited as the default upstream candidate for Phase 3
  - Not vendored into runtime execution directly

## Compatibility Notes

- Current upstream README documents builds for Humble, Iron, Jazzy, Kilted, Lyrical, and Rolling.
- The current upstream main branch does not declare ROS2 Foxy support.
- `pyproject.toml` pins `ultralytics==8.4.6`, which also raises compatibility risk for Ubuntu 20.04 + ROS2 Foxy.
- Because of that, this repository uses an independent bridge:
  - `yolo_bridge.py`
  - `runtime/detections.json`
  - `/api/perception/state`

## Final Decision

- Keep `yolo_ros` as the audited upstream reference.
- Do not assume its latest main branch is deployable on Foxy.
- Use the local detection bridge and UI overlay path as the stable integration seam.
