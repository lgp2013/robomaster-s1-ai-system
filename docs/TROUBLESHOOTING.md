# Troubleshooting

## 当前高频问题

### 1. 页面显示“未发现可用视频源”

排查：

- 点击“重新扫描机器人”
- 检查 `runtime/robot_discovery.json`
- 检查当前环境是否已安装 ROS2
- 检查 `runtime/app_config.json` 中的 `video.defaultStreamUrl`

### 2. 页面只能看到本地模拟视频

排查：

- 当前后端未检测到 ROS2
- `web_video_server` 地址不可达
- 目标环境未启动真实摄像头 Topic

### 3. 视频状态反复重连

排查：

- 上游 MJPEG 是否可访问
- 上游是否真的是 `multipart MJPEG`
- 网络代理或端口是否阻断

### 4. 页面文案不是中文

排查：

- 强制刷新浏览器缓存
- 确认已加载最新的 `web/index.html` 和 `web/app.js`

### 5. Ubuntu 20.04 上仍未发现 ROS2

排查命令：

```bash
source /opt/ros/foxy/setup.bash
printenv ROS_DISTRO
which ros2
ros2 node list
ros2 topic list -t
```

### 6. 控制状态一直显示“未连接”

排查：

- 检查浏览器是否拦截 WebSocket
- 检查 `/ws/control` 是否可访问
- 检查后端日志中是否有 upgrade 或 socket 错误

### 7. 摇杆拖动后没有命令变化

排查：

- 检查浏览器页面是否已建立控制链路
- 检查 `/api/control/state` 中的 `backendState`
- 检查是否处于急停锁定状态

### 8. 急停后无法恢复

排查：

- 点击“解除急停”
- 检查 `/api/control/state` 中的 `emergencyStop` 是否回到 `false`
- 若仍失败，刷新页面并重新建立控制连接

### 9. 真机没有移动

排查：

- 当前版本默认只验证控制状态机，不默认向 ROS2 真 Topic 发布
- 检查 `cmd_vel` 候选 Topic 是否被自动发现
- 在 Ubuntu 20.04 + ROS2 Foxy 环境确认后，再接真机控制桥
