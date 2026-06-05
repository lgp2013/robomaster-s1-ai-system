#!/usr/bin/env python3
"""
ROS2 Foxy 控制桥接节点
负责将 Node.js 后端计算的控制命令发布到 ROS2 Topic

运行前提：
  source /opt/ros/foxy/setup.bash
  python3 ros2_bridge.py

通信方式：
  - 从 runtime/control_commands.json 读取最新命令
  - 发布 geometry_msgs/Twist 到 /cmd_vel
  - 发布 std_msgs/Float64 到 /gimbal/yaw 和 /gimbal/pitch
"""

import json
import os
import sys
import time
import signal

# ROS2 导入
try:
    import rclpy
    from rclpy.node import Node
    from rclpy.qos import QoSProfile, ReliabilityPolicy, HistoryPolicy
    from geometry_msgs.msg import Twist
    from std_msgs.msg import Float64
except ImportError as e:
    print(f"[ERROR] ROS2 环境未就绪: {e}")
    print("请先执行: source /opt/ros/foxy/setup.bash")
    sys.exit(1)

RUNTIME_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'runtime')
COMMAND_PATH = os.path.join(RUNTIME_DIR, 'control_commands.json')
PUBLISH_HZ = 20  # 发布频率 20Hz


class RoboMasterBridge(Node):
    def __init__(self):
        super().__init__('robomaster_s1_control_bridge')

        # QoS 配置
        qos = QoSProfile(
            reliability=ReliabilityPolicy.RELIABLE,
            history=HistoryPolicy.KEEP_LAST,
            depth=1,
        )

        # 发布器
        self.cmd_vel_pub = self.create_publisher(Twist, '/cmd_vel', qos)
        self.gimbal_yaw_pub = self.create_publisher(Float64, '/gimbal/yaw', qos)
        self.gimbal_pitch_pub = self.create_publisher(Float64, '/gimbal/pitch', qos)

        # 定时器
        self.timer = self.create_timer(1.0 / PUBLISH_HZ, self.publish_commands)

        # 状态
        self.last_command = {
            'linear_x': 0.0,
            'angular_z': 0.0,
            'yaw_rate': 0.0,
            'pitch_rate': 0.0,
            'emergency_stop': False,
            'ros_publish_active': False,
        }
        self.last_read_time = 0.0
        self.timeout_sec = 0.5  # 命令超时时间

        self.get_logger().info('RoboMaster S1 控制桥接节点已启动')
        self.get_logger().info(f'发布频率: {PUBLISH_HZ} Hz')
        self.get_logger().info(f'命令文件: {COMMAND_PATH}')

    def read_commands(self):
        """从 JSON 文件读取最新控制命令"""
        if not os.path.exists(COMMAND_PATH):
            return None

        try:
            with open(COMMAND_PATH, 'r') as f:
                data = json.load(f)
            self.last_read_time = time.time()
            return data
        except (json.JSONDecodeError, IOError):
            return None

    def publish_commands(self):
        """定时发布控制命令"""
        data = self.read_commands()

        if data is None:
            # 文件不存在或读取失败，发送零命令
            self.publish_zero()
            return

        # 检查是否启用发布
        if not data.get('rosPublishActive', False):
            self.publish_zero()
            return

        # 检查急停
        if data.get('emergencyStop', False):
            self.publish_zero()
            return

        # 检查命令时效
        command_age_ms = data.get('commandAgeMs', 9999)
        if command_age_ms > int(self.timeout_sec * 1000):
            self.publish_zero()
            return

        # 发布底盘命令
        twist = Twist()
        twist.linear.x = float(data.get('linearX', 0.0))
        twist.linear.y = 0.0
        twist.linear.z = 0.0
        twist.angular.x = 0.0
        twist.angular.y = 0.0
        twist.angular.z = float(data.get('angularZ', 0.0))
        self.cmd_vel_pub.publish(twist)

        # 发布云台命令
        yaw_msg = Float64()
        yaw_msg.data = float(data.get('yawRate', 0.0))
        self.gimbal_yaw_pub.publish(yaw_msg)

        pitch_msg = Float64()
        pitch_msg.data = float(data.get('pitchRate', 0.0))
        self.gimbal_pitch_pub.publish(pitch_msg)

        # 记录日志（低频）
        if int(time.time() * 10) % 50 == 0:  # 每 5 秒左右
            self.get_logger().debug(
                f'cmd_vel: linear_x={twist.linear.x:.3f}, angular_z={twist.angular.z:.3f} | '
                f'gimbal: yaw={yaw_msg.data:.1f}, pitch={pitch_msg.data:.1f}'
            )

    def publish_zero(self):
        """发布零命令（停止）"""
        twist = Twist()
        self.cmd_vel_pub.publish(twist)

        yaw_msg = Float64()
        yaw_msg.data = 0.0
        self.gimbal_yaw_pub.publish(yaw_msg)

        pitch_msg = Float64()
        pitch_msg.data = 0.0
        self.gimbal_pitch_pub.publish(pitch_msg)


def main():
    rclpy.init()
    node = RoboMasterBridge()

    def signal_handler(sig, frame):
        node.get_logger().info('收到终止信号，正在关闭...')
        node.publish_zero()  # 发送停止命令
        node.destroy_node()
        rclpy.shutdown()
        sys.exit(0)

    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)

    try:
        rclpy.spin(node)
    except Exception as e:
        node.get_logger().error(f'运行时错误: {e}')
    finally:
        node.publish_zero()
        node.destroy_node()
        rclpy.shutdown()


if __name__ == '__main__':
    main()
