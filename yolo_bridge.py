#!/usr/bin/env python3
"""
ROS2 detection bridge.
Subscribes to a DetectionArray topic and writes a lightweight JSON snapshot
to runtime/detections.json for the web UI.
"""

import json
import os
import signal
import sys
from datetime import datetime, timezone

try:
    import rclpy
    from rclpy.node import Node
    from rclpy.qos import HistoryPolicy, QoSProfile, ReliabilityPolicy
    from yolo_msgs.msg import DetectionArray
except ImportError as exc:
    print(f"[ERROR] ROS2 or yolo_msgs is not available: {exc}")
    print("Run: source /opt/ros/foxy/setup.bash")
    sys.exit(1)

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
RUNTIME_DIR = os.path.join(ROOT_DIR, "runtime")
OUTPUT_PATH = os.path.join(RUNTIME_DIR, "detections.json")
DETECTION_TOPIC = os.environ.get("YOLO_DETECTION_TOPIC", "/yolo/tracking")
FRAME_WIDTH = float(os.environ.get("YOLO_FRAME_WIDTH", "1280"))
FRAME_HEIGHT = float(os.environ.get("YOLO_FRAME_HEIGHT", "720"))


def clamp(value, min_value, max_value):
    return max(min_value, min(max_value, value))


class YoloBridge(Node):
    def __init__(self):
        super().__init__("robomaster_s1_yolo_bridge")
        qos = QoSProfile(
            reliability=ReliabilityPolicy.BEST_EFFORT,
            history=HistoryPolicy.KEEP_LAST,
            depth=1,
        )
        self.subscription = self.create_subscription(
            DetectionArray,
            DETECTION_TOPIC,
            self.handle_message,
            qos,
        )
        os.makedirs(RUNTIME_DIR, exist_ok=True)
        self.get_logger().info(f"Detection bridge listening on {DETECTION_TOPIC}")
        self.get_logger().info(f"Detection output file: {OUTPUT_PATH}")

    def handle_message(self, message):
        detections = []
        for index, det in enumerate(message.detections):
            width = float(det.bbox.size.x or 0.0)
            height = float(det.bbox.size.y or 0.0)
            left = (float(det.bbox.center.position.x or 0.0) - width / 2.0) / FRAME_WIDTH
            top = (float(det.bbox.center.position.y or 0.0) - height / 2.0) / FRAME_HEIGHT
            detections.append(
                {
                    "targetId": str(det.id if det.id is not None else f"det-{index}"),
                    "trackId": str(det.id if det.id is not None else f"det-{index}"),
                    "classId": int(det.class_id),
                    "className": str(det.class_name),
                    "score": float(det.score),
                    "bbox": {
                        "x": clamp(left, 0.0, 1.0),
                        "y": clamp(top, 0.0, 1.0),
                        "width": clamp(width / FRAME_WIDTH, 0.0, 1.0),
                        "height": clamp(height / FRAME_HEIGHT, 0.0, 1.0),
                    },
                }
            )

        payload = {
            "generatedAt": datetime.now(timezone.utc).isoformat(),
            "provider": "ros2-yolo",
            "topic": DETECTION_TOPIC,
            "frame": {
                "width": FRAME_WIDTH,
                "height": FRAME_HEIGHT,
            },
            "inferenceFps": 6,
            "detections": detections,
        }

        with open(OUTPUT_PATH, "w", encoding="utf-8") as handle:
            json.dump(payload, handle, indent=2)


def main():
    rclpy.init()
    node = YoloBridge()

    def shutdown_handler(_sig, _frame):
        node.destroy_node()
        rclpy.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown_handler)
    signal.signal(signal.SIGTERM, shutdown_handler)

    try:
        rclpy.spin(node)
    finally:
        if rclpy.ok():
            node.destroy_node()
            rclpy.shutdown()


if __name__ == "__main__":
    main()
