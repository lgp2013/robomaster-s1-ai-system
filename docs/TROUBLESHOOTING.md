# Troubleshooting

## 当前高频问题

### 1. 当前目录无法执行 git 提交

排查：

- 执行 `git rev-parse --is-inside-work-tree`
- 如果返回 `fatal: not a git repository`，说明当前目录没有 `.git`
- 进入正式仓库目录后再执行 `git status`
- 若目标仓库尚未克隆，在远程 Ubuntu 服务器执行 `git clone https://github.com/lgp2013/robomaster-s1-ai-system.git`

### 2. 远程服务器无法 `git pull`

排查：

- 检查 GitHub 凭据是否可用
- 检查仓库 URL 是否可达
- 执行 `git remote -v`
- 执行 `git branch --show-current`
- 若使用 HTTPS，确认 PAT 或凭据助手可用

### 3. 页面显示“未发现可用视频源”

排查：

- 先点击“重新扫描机器人”
- 检查 `runtime/robot_discovery.json`
- 检查当前环境是否已安装 ROS2
- 若当前是 Windows 开发环境，这是预期降级表现

### 4. 页面只能看到本地模拟视频

排查：

- 当前后端未检测到 ROS2
- 未配置 [app_config.json](D:\codex\robomaster-s1-ai\runtime\app_config.json) 中的 `video.defaultStreamUrl`
- 目标环境未启动真实摄像头 Topic

### 5. 视频状态反复重连

排查：

- 上游 MJPEG 是否可访问
- 上游是否真的是 `multipart MJPEG`
- 网络代理或端口是否阻断

### 6. 页面文案不是中文

排查：

- 强制刷新浏览器缓存
- 确认已加载最新的 `web/index.html` 和 `web/app.js`

### 7. Ubuntu 20.04 上仍未发现 ROS2

排查命令：

```bash
source /opt/ros/foxy/setup.bash
printenv ROS_DISTRO
which ros2
ros2 node list
ros2 topic list -t
```
