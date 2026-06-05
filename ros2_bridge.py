#!/usr/bin/env python3
"""
ROS2 Foxy 控制桥接节点
负责读取 Node.js 后端写入的 runtime/control_commands.json，
并将当前控制命令发布到后端选定的 ROS2 Topic。
"""

import json
import os
import signal
import sys
import time

try:
    import rclpy
    from geometry_msgs.msg import Twist
    from rclpy.node import Node
    from rclpy.qos import HistoryPolicy, QoSProfile, ReliabilityPolicy
    from std_msgs.msg import Float64
except ImportError as exc:
    print(f"[ERROR] ROS2 environment is not ready: {exc}")
    print("Run: source /opt/ros/foxy/setup.bash")
    sys.exit(1)

RUNTIME_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "runtime")
COMMAND_PATH = os.path.join(RUNTIME_DIR, "control_commands.json")
PUBLISH_HZ = 20


class RoboMasterBridge(Node):
    def __init__(self):
        super().__init__("robomaster_s1_control_bridge")

        self.qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=1,
        )
        self.timeout_sec = 0.5
        self.topic_bindings = {
            "cmdVel": "",
            "gimbalYaw": "",
            "gimbalPitch": "",
            "gimbalCombined": "",
        }
        self.cmd_vel_pub = None
        self.gimbal_yaw_pub = None
        self.gimbal_pitch_pub = None
        self.gimbal_combined_pub = None

        self.timer = self.create_timer(1.0 / PUBLISH_HZ, self.publish_commands)

        self.get_logger().info("RoboMaster S1 控制桥接已启动")
        self.get_logger().info(f"发布频率: {PUBLISH_HZ} Hz")
        self.get_logger().info(f"命令文件: {COMMAND_PATH}")

    def read_commands(self):
        if not os.path.exists(COMMAND_PATH):
            return None

        try:
            with open(COMMAND_PATH, "r", encoding="utf-8") as handle:
                return json.load(handle)
        except (json.JSONDecodeError, OSError):
            return None

    def ensure_publishers(self, data):
        selected = data.get("selectedTopics", {}) if isinstance(data, dict) else {}
        cmd_vel_topic = str(selected.get("cmdVel", "") or "")
        gimbal_yaw_topic = str(selected.get("gimbalYaw", "") or "")
        gimbal_pitch_topic = str(selected.get("gimbalPitch", "") or "")
        gimbal_combined_topic = str(selected.get("gimbalCombined", "") or "")

        if cmd_vel_topic and cmd_vel_topic != self.topic_bindings["cmdVel"]:
            self.cmd_vel_pub = self.create_publisher(Twist, cmd_vel_topic, self.qos)
            self.topic_bindings["cmdVel"] = cmd_vel_topic
            self.get_logger().info(f"cmd_vel publisher bound to {cmd_vel_topic}")

        if gimbal_yaw_topic and gimbal_yaw_topic != self.topic_bindings["gimbalYaw"]:
            self.gimbal_yaw_pub = self.create_publisher(Float64, gimbal_yaw_topic, self.qos)
            self.topic_bindings["gimbalYaw"] = gimbal_yaw_topic
            self.get_logger().info(f"gimbal yaw publisher bound to {gimbal_yaw_topic}")

        if gimbal_pitch_topic and gimbal_pitch_topic != self.topic_bindings["gimbalPitch"]:
            self.gimbal_pitch_pub = self.create_publisher(Float64, gimbal_pitch_topic, self.qos)
            self.topic_bindings["gimbalPitch"] = gimbal_pitch_topic
            self.get_logger().info(f"gimbal pitch publisher bound to {gimbal_pitch_topic}")

        if gimbal_combined_topic and gimbal_combined_topic != self.topic_bindings["gimbalCombined"]:
            # 组合云台 Topic 使用 Twist 消息，linear.x = yaw, linear.y = pitch
            self.gimbal_combined_pub = self.create_publisher(Twist, gimbal_combined_topic, self.qos)
            self.topic_bindings["gimbalCombined"] = gimbal_combined_topic
            self.get_logger().info(f"gimbal combined publisher bound to {gimbal_combined_topic}")

    def publish_commands(self):
        data = self.read_commands()
        if data is None:
            self.publish_zero()
            return

        self.ensure_publishers(data)

        if not data.get("rosPublishActive", False):
            self.publish_zero()
            return

        if data.get("emergencyStop", False):
            self.publish_zero()
            return

        command_age_ms = int(data.get("commandAgeMs", 9999) or 9999)
        if command_age_ms > int(self.timeout_sec * 1000):
            self.publish_zero()
            return

        if self.cmd_vel_pub is not None:
            twist = Twist()
            twist.linear.x = float(data.get("linearX", 0.0))
            twist.angular.z = float(data.get("angularZ", 0.0))
            self.cmd_vel_pub.publish(twist)

        if self.gimbal_yaw_pub is not None:
            yaw_msg = Float64()
            yaw_msg.data = float(data.get("yawRate", 0.0))
            self.gimbal_yaw_pub.publish(yaw_msg)

        if self.gimbal_pitch_pub is not None:
            pitch_msg = Float64()
            pitch_msg.data = float(data.get("pitchRate", 0.0))
            self.gimbal_pitch_pub.publish(pitch_msg)

        if self.gimbal_combined_pub is not None:
            combined_msg = Twist()
            combined_msg.linear.x = float(data.get("yawRate", 0.0))
            combined_msg.linear.y = float(data.get("pitchRate", 0.0))
            self.gimbal_combined_pub.publish(combined_msg)

        now_sec = int(time.time())
        if now_sec % 2 == 0 and now_sec != getattr(self, "_last_log_sec", -1):
            self._last_log_sec = now_sec
            self.get_logger().info(
                "mode=%s linear_x=%.3f angular_z=%.3f yaw=%.1f pitch=%.1f age=%dms"
                % (
                    data.get("mode", "unknown"),
                    float(data.get("linearX", 0.0)),
                    float(data.get("angularZ", 0.0)),
                    float(data.get("yawRate", 0.0)),
                    float(data.get("pitchRate", 0.0)),
                    command_age_ms,
                )
            )

    def publish_zero(self):
        if self.cmd_vel_pub is not None:
            self.cmd_vel_pub.publish(Twist())

        if self.gimbal_yaw_pub is not None:
            yaw_msg = Float64()
            yaw_msg.data = 0.0
            self.gimbal_yaw_pub.publish(yaw_msg)

        if self.gimbal_pitch_pub is not None:
            pitch_msg = Float64()
            pitch_msg.data = 0.0
            self.gimbal_pitch_pub.publish(pitch_msg)

        if self.gimbal_combined_pub is not None:
            combined_msg = Twist()
            self.gimbal_combined_pub.publish(combined_msg)

    def shutdown(self):
        self.get_logger().info("Bridge shutdown, publishing zero command.")
        self.publish_zero()
        self.destroy_node()


def main():
    rclpy.init()
    node = RoboMasterBridge()

    def handle_signal(_sig, _frame):
        node.shutdown()
        rclpy.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, handle_signal)
    signal.signal(signal.SIGTERM, handle_signal)

    try:
        rclpy.spin(node)
    finally:
        if rclpy.ok():
            node.shutdown()
            rclpy.shutdown()


if __name__ == "__main__":
    main()
