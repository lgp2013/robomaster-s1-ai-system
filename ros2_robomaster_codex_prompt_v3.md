
---

## -1. 本次任务性质：全新开发，不复用旧代码

### -1.1 清洁重建要求

本次开发必须按“全新项目 / 清洁重建”处理。之前多轮修改过的代码不要继续沿用，不要继续在旧方案上修修补补。

强制要求：

```text
- 旧代码不作为新系统实现基础
- 旧代码不继续被导入、调用、继承、复制或局部拼接
- 旧代码只允许用于理解历史问题、硬件连接方式、ROS2 topic 命名、启动命令线索
- 如果仓库中已有旧实现，必须先隔离到 legacy/ 或 docs/history/，或者在文档中明确标记为 abandoned
- 不要直接删除旧代码，除非 AGENTS.md 或用户明确允许；默认采用隔离/废弃标记方式
- 新代码必须从清晰目录开始重新组织
- 新系统必须先实现 Phase 0/1/2，不允许直接恢复旧的自动跟随大闭环
```

推荐隔离方式：

```text
legacy/
  old_frontend/
  old_backend/
  old_ros_nodes/
  old_notes.md

docs/
  PROJECT_AUDIT.md
  DEVELOPMENT_PHASES.md
  OPEN_SOURCE_DEPS.md
  RUNBOOK.md
  TEST_PLAN.md
  TROUBLESHOOTING.md
```

如果项目不允许移动旧代码，则至少在 `docs/PROJECT_AUDIT.md` 中列出：

```text
- 哪些旧文件废弃不用
- 哪些旧文件只作为参考
- 哪些目录是新开发入口
- 新旧代码之间如何避免互相污染
```

### -1.2 旧代码允许参考的范围

旧代码只允许作为以下信息来源：

```text
- 机器人型号、连接方式、IP、端口、SDK 初始化方式
- ROS2 topic / service / action 名称线索
- 摄像头 topic 名称线索，例如 /camera/image_color
- 已知可访问的视频 URL 线索
- 历史故障和不可继续采用的错误架构
```

旧代码禁止作为以下内容来源：

```text
- 新前端页面结构
- 新后端接口结构
- 新视频主链路实现
- 新自动跟随控制逻辑
- 新 YOLO 推理闭环
- 新 WebSocket 消息协议
- 新 UI 视觉风格
```

### -1.3 开源代码使用规则：由 Codex 自行拉取最新版本

如果开发过程中需要参考或使用开源项目，不要依赖用户本地旧拷贝，不要复制历史目录中的旧版本。Codex 必须在开发环境中自行获取最新版本，并记录来源。

强制要求：

```text
- 需要用到开源项目时，由 Codex 自行 git clone 官方仓库最新版本
- 必须记录仓库 URL、分支、commit hash、许可证、用途、是否直接依赖
- 必须优先通过 apt/pip/npm/rosdep 等包管理器安装依赖
- 不要把 GPL/AGPL 代码直接复制进本项目，除非确认项目许可证兼容并在文档中说明
- 能借鉴思路就不要复制源码
- 如果只参考交互方式或架构思想，应在文档中写明“仅参考，不引入源码”
- 如果引入第三方代码，必须放到 third_party/ 或通过依赖管理，不要散落复制到业务目录
- 所有第三方依赖必须写入 docs/OPEN_SOURCE_DEPS.md
```

建议记录格式：

```markdown
# Open Source Dependencies

| 名称 | 仓库/包地址 | 获取方式 | 版本/commit | 许可证 | 用途 | 是否引入源码 | 备注 |
|---|---|---|---|---|---|---|---|
| ros2_web_teleop | 官方 GitHub URL | git clone | commit hash | license | 仅参考 Web 遥控交互 | 否 | 不复制源码 |
| yolo_ros | 官方 GitHub URL | git clone / ros package | commit hash | license | ROS2 识别节点 | 视实际情况 | 需确认 topic/message |
```

### -1.4 测试环境固定为 Ubuntu 20.04

本项目的测试环境以 **Ubuntu 20.04** 为准。Codex 必须优先适配该环境，不要默认使用 Ubuntu 22.04/24.04 的包、命令或 ROS2 版本假设。

环境约束：

```text
OS: Ubuntu 20.04
ROS2: 先检测本机已有 ROS2 版本，不要硬编码假设
Python: 以 Ubuntu 20.04 可用版本为准，优先使用 venv/requirements.txt 管理
Node.js: 如果前端需要较新 Node，必须明确安装方式和版本要求
GPU/CUDA: 不做强依赖；如果使用 YOLO GPU 推理，必须提供 CPU fallback 或明确说明
浏览器: Chrome/Edge 最新稳定版优先
```

Codex 在写安装脚本或部署文档时必须包含：

```text
- Ubuntu 20.04 基础依赖安装
- ROS2 环境检测命令
- Python 虚拟环境创建命令
- Node.js 安装或版本检测命令
- 前端构建命令
- 后端启动命令
- ROS2 节点启动命令
- 常见权限问题处理，例如摄像头、串口、网络端口
```

### -1.5 每次开发完成后的交付物要求

每完成一个阶段、一个模块或一次可运行修改，都必须同步更新部署和测试文档。不能只写代码不写验证方法。

每次开发完成必须输出：

```text
1. 本次修改范围
2. 修改了哪些文件
3. 新增了哪些命令
4. 如何部署
5. 如何启动
6. 如何测试
7. 正常情况下应该看到什么结果
8. 如果失败，优先检查哪些日志/端口/topic/进程
9. 当前未完成事项
10. 下一步建议
```

每个阶段必须在 `docs/RUNBOOK.md` 和 `docs/TEST_PLAN.md` 中补充对应章节，格式如下：

```markdown
## Phase X：阶段名称

### 部署要点
- ...

### 启动步骤
```bash
# 示例命令
```

### 测试步骤
1. ...
2. ...

### 正常预期结果
- 页面/终端/机器人应该出现的正常现象
- 正常日志关键字
- 正常 UI 状态

### 异常排查要点
- 如果无画面，检查 ...
- 如果无法控制，检查 ...
- 如果 ROS2 topic 不存在，检查 ...
```

---

## 0. 任务总目标

你是一个专业的 Codex 开发智能体，需要在项目目录中重新规划并逐步实现一个面向 RoboMaster / ROS2 场景的机器人 Web 控制系统。

本次任务不是继续修补旧方案，也不是在旧代码上打补丁，而是进行**清洁重建 / 全新开发**：之前写过的业务代码、临时验证代码、混合式服务器后台推理闭环代码都不要继续复用。旧代码最多只能作为需求背景、硬件连接线索、Topic 名称线索和反面经验参考；新系统必须重新建立清晰目录、清晰链路和可验证阶段。

1. 第一优先级：保证 1080P 摄像头图像回传清晰、低延迟、稳定、可预览。
2. 第二优先级：实现真实可用的机器人手柄式遥控，分为底盘控制、云台控制、底盘跟随云台控制。
3. 第三优先级：实现人和物体识别，但识别链路不得阻塞视频预览和手动控制。
4. 第四优先级：实现人物锁定、锁定拍照保存、目标状态展示。
5. 第五优先级：实现自动跟随，作为高难度阶段，不允许在前面阶段不稳定时强行实现。
6. 第六优先级：保留“场景操作”页面，用于后续扩展，不在当前阶段做复杂功能。

核心原则：**先稳定基础链路，再叠加智能能力；先可观测、可测试、可回滚，再追求自动化效果。每完成一个阶段，都必须同步输出部署要点、测试步骤、正常预期结果、异常排查要点。**


### 0.1 本次技术路线重大调整

请特别注意：本项目过去失败的主要风险，不一定是单个代码 bug，而是把 **1080P 视频回传、Web 遥控、YOLO 服务器推理、目标锁定、自动跟随控制** 全部耦合在一条大闭环链路中，导致任何一个环节延迟都会拖垮整体体验。

本轮重构必须从架构上纠正这个问题：

```text
错误方向：
摄像头 -> ROS2 Image Topic -> rosbridge/WebSocket -> 前端 -> 服务器推理 -> 再显示/控制

正确方向：
摄像头 -> 独立视频链路 -> 前端实时预览
摄像头 -> 低频采样推理链路 -> yolo_ros/AI 节点 -> 识别结果 -> 前端 overlay
前端摇杆 -> 独立控制 WebSocket -> ROS2 控制桥接节点 -> 底盘/云台
锁定目标 -> follow_controller -> safety_arbiter -> 底盘/云台
```

**第一目标不是先实现 AI 跟随，而是先做到像 DJI App 一样流畅地看见和控制。**

开发优先级必须固定为：

```text
视频流畅度 > 手动遥控稳定性 > 目标识别 > 人物锁定 > 半自动辅助跟随 > 全自动跟随
```

### 0.2 强制技术栈与链路边界

Codex 必须遵守以下技术栈边界，不得自行回到旧的“大一统服务器后台推理闭环”方案。

#### 0.2.1 前端技术栈

如果项目已有前端工程，优先沿用现有工程；如果需要新建或重构，推荐：

```text
React + TypeScript + Vite
Canvas/SVG overlay
Pointer Events 虚拟摇杆
WebSocket 控制通道
独立视频播放器组件
```

前端只负责：

```text
- 展示视频
- 绘制 HUD / 检测框 / 锁定框
- 发送摇杆控制意图
- 展示机器人状态、识别状态、锁定状态、跟随状态
- 触发锁定、取消锁定、急停、模式切换等用户操作
```

前端禁止负责：

```text
- 直接实现机器人底层运动控制闭环
- 执行重量级 YOLO 推理
- 在浏览器中承担自动跟随主控制器
- 将大图像帧通过 JSON/WebSocket 反复中转
```

#### 0.2.2 视频链路

视频链路是第一优先级，必须独立于推理链路。

阶段策略：

```text
Phase 1 可用基线：web_video_server / MJPEG，优先保证页面能稳定看到 1080P 画面
Phase 1.5 优化方向：H.264 编码、码率/帧率/分辨率档位、延迟监测
后续生产方向：WebRTC / RTSP 转 WebRTC / GStreamer H.264 硬件编码
```

强制要求：

```text
- 不允许把 1080P 原始图像通过 rosbridge JSON WebSocket 推到前端
- 不允许让主视频预览依赖 YOLO 是否启动
- 不允许因为服务器推理卡顿导致视频画面卡顿
- 不允许为了 AI 推理默认降低主预览画质
- overlay 必须和视频画面分层，识别结果只传 bbox/class/confidence/track_id/timestamp 等轻量数据
```

#### 0.2.3 控制链路

控制链路必须独立于视频链路和 AI 推理链路。

推荐结构：

```text
Frontend Virtual Joystick
  -> WebSocket control channel
  -> robot_web_bridge / rclpy control bridge
  -> safety_arbiter_node
  -> /cmd_vel / gimbal command topic
```

控制链路必须具备：

```text
- 10Hz - 30Hz 控制频率
- 控制心跳
- 浏览器断连停止
- 500ms 超时急停或安全停止
- 摇杆松手归零
- 速度限制
- 加速度限制
- 急停最高优先级
- 手动接管优先于自动跟随
```

#### 0.2.4 ROS2 Web 通信边界

rosbridge / ros2-web-bridge 只适合轻量 ROS 消息桥接，不应用于承载 1080P 主视频流。

允许通过 WebSocket/rosbridge 传输：

```text
- 机器人连接状态
- ROS2 节点状态
- 控制模式
- 速度档位
- 识别结果 bbox
- 锁定目标状态
- 跟随状态
- 告警状态
- 轻量控制命令
```

禁止通过 rosbridge/JSON WebSocket 高频传输：

```text
- 1080P 原始图像帧
- base64 大图
- 每帧截图
- 推理后的视频流
```

#### 0.2.5 AI 识别链路

AI 识别必须异步、低频、可关闭，不得阻塞主链路。

推荐结构：

```text
camera image topic / sampled frame
  -> yolo_ros or detection_adapter_node
  -> detection result topic
  -> backend lightweight adapter
  -> frontend overlay
```

要求：

```text
- 初期推理频率建议 5-10 FPS，不追求每帧推理
- 初期推理分辨率建议 640P/720P，不要强行 1080P 全帧推理
- 检测结果与主视频用 timestamp 对齐
- YOLO 节点异常不能影响视频预览
- YOLO 节点异常不能影响手动遥控
```

#### 0.2.6 自动跟随链路

自动跟随必须作为最后阶段的独立控制器实现，不能写在前端、视频组件或 YOLO 节点中。

推荐结构：

```text
target_lock_node
  -> locked target state
  -> follow_controller_node
  -> safety_arbiter_node
  -> chassis / gimbal command
```

要求：

```text
- 未锁定 person 时不能进入自动跟随
- 自动跟随默认低速
- 用户手动操作立即接管或退出自动模式
- 目标丢失后先云台搜索，再告警
- 前方障碍物或距离过近必须停车或后退
- 所有自动控制输出必须限幅、平滑、可配置
```

---

## 1. 开发前强制要求

在写任何代码之前，必须完成以下动作：

### 1.1 读取项目规范

必须先读取项目根目录中的：

```text
AGENTS.md
```

并总结其中对以下内容的要求：

- 项目结构要求
- 编码规范
- 测试命令
- 构建命令
- 前端规范
- 后端规范
- ROS2 节点规范
- 禁止修改的文件或目录
- 提交/变更说明规范

如果 `AGENTS.md` 不存在，需要在任务记录中明确说明，并继续通过项目现有 README、package.json、pyproject.toml、setup.py、CMakeLists.txt、docker-compose、launch 文件等推断项目规范。

### 1.2 项目审计

在改代码前，先扫描项目目录，输出一份简短审计说明，至少包括：

```text
- 当前前端技术栈
- 当前后端技术栈
- 当前 ROS2 package 列表
- 当前视频链路实现方式
- 当前机器人控制链路实现方式
- 当前 yolo_ros / person_following_robot 集成方式
- 当前旧代码中仅可参考的硬件/topic/端口线索
- 当前应废弃或暂时隔离的代码
- 新开发入口目录规划
```

### 1.3 不允许一上来大改

禁止一次性重写整个项目。

必须按阶段开发，每个阶段完成后都要：

```text
- 能启动
- 能运行
- 能验证
- 有日志
- 有错误提示
- 有回退方式
```

---

## 2. 子智能体分工方式

请把本项目拆成多个“子智能体任务角色”。你可以由一个 Codex 实例按顺序执行，但必须按照下面的角色边界推进，不要混在一起实现。

### 2.1 Project Guardian Agent：项目守护智能体

职责：

- 读取 `AGENTS.md`
- 审计项目结构
- 识别历史代码中的硬件/topic/端口线索
- 标记旧方案中应隔离的部分
- 明确旧代码不进入新系统实现
- 制定阶段开发计划
- 保证每次修改范围清晰

输出物：

```text
docs/PROJECT_AUDIT.md
docs/DEVELOPMENT_PHASES.md
docs/OPEN_SOURCE_DEPS.md
```

### 2.2 Frontend Design Agent：前端设计智能体

职责：

- 负责 Web 控制台页面设计和交互实现
- 必须遵守 frontend-design 思路
- 不能做普通后台管理页面
- 不能做 generic AI 风格页面
- 不能使用常见紫色渐变白底模板
- 不能使用 Arial、Roboto、Inter 等默认字体作为主视觉字体
- 必须选择一个明确、强烈、统一的视觉方向
- 页面必须 production-grade、真实可用、有视觉记忆点

视觉方向建议：

```text
工业级机器人战术控制台 / Field Robotics Control Deck
```

设计关键词：

```text
matte graphite / carbon black / tactical amber / radar green / glassless HUD / physical controller panel / low-latency command surface
```

建议视觉特征：

- 深色工业控制台，不使用紫色渐变
- 视频画面作为中心视觉核心
- 操作区像游戏手柄和无人机遥控器，而不是后台表单
- 状态信息像 HUD，而不是普通卡片堆叠
- 告警色使用琥珀色/红色，正常状态使用雷达绿色
- 关键按钮要有真实设备感，例如急停、锁定、跟随、云台回中
- 字体建议使用 `Barlow Condensed`、`DIN Condensed`、`Saira Condensed`、`Source Han Sans SC`、`HarmonyOS Sans SC`、`Microsoft YaHei UI` 等组合，不要用 Arial、Roboto、Inter 作为主字体

页面结构建议：

```text
┌──────────────────────────────────────────────────────────────┐
│ 顶部：机器人连接状态 / ROS2 状态 / 视频延迟 / 控制模式 / 急停 │
├──────────────────────────────────────────────────────────────┤
│ 左侧大区域：1080P 视频预览 + HUD 叠加层 + 检测框 + 锁定框     │
│ 右侧窄区域：目标信息 / 识别列表 / 锁定照片 / 跟随状态         │
├──────────────────────────────────────────────────────────────┤
│ 底部：双虚拟摇杆 + 云台控制 + 模式切换 + 速度/灵敏度滑条     │
├──────────────────────────────────────────────────────────────┤
│ 页面标签：手动控制 / 识别调试 / 人物锁定 / 自动跟随 / 场景操作 │
└──────────────────────────────────────────────────────────────┘
```

### 2.3 Video Streaming Agent：视频链路智能体

职责：

- 优先保证视频清晰度和流畅度
- 摄像头是 1080P，页面必须支持 1080P 清晰预览
- 视频预览链路必须和 AI 推理链路解耦
- 不允许为了识别功能牺牲预览流畅度
- 不允许把 UI 主视频流强制经过服务器推理后再显示

已知基线：

```text
http://Ubuntu服务器IP:8080/stream?topic=/camera/image_color&type=mjpeg
```

该路径已经能看到画面，可以作为第一阶段视频基线。

实现要求：

- Phase 1 优先复用现有可工作的 `web_video_server` / MJPEG 链路作为基线
- `web_video_server` / MJPEG 可以用于第一阶段调试和可用验证，但不要把它锁死为最终低延迟生产方案
- 后续必须预留 WebRTC / H.264 / RTSP to WebRTC / GStreamer 硬件编码的升级位置
- 如果项目已有 WebRTC、GStreamer、RTSP、rosbridge 或其他视频链路，需要先评估，不要盲目替换
- rosbridge 不能作为 1080P 主视频流承载通道
- 页面必须显示视频状态：分辨率、FPS、估算延迟、连接状态、丢帧/重连状态
- 视频组件必须具备重连能力
- 识别框叠加必须使用独立 canvas / overlay，不要破坏原始视频流
- 支持全屏预览
- 支持画质档位：1080P 高质量、720P 流畅、调试低码率
- 禁止默认把视频降到很低分辨率

验收标准：

```text
- 页面可以稳定显示 1080P 视频
- 视频预览不依赖 YOLO 推理是否启动
- 关闭识别功能后，视频仍可正常预览
- 视频卡顿时页面能显示状态，而不是静默失败
- 本阶段不要求自动跟随
```

### 2.4 Teleop Control Agent：机器人遥控智能体

职责：

- 实现机器人手动控制
- 操作方式必须像游戏手柄操作杆，不要使用十字键
- 操作要分为底盘、云台、底盘跟随云台三种模式
- 要有急停、心跳、限速、安全停止

参考方向：

- 可参考 `ros2_web_teleop` 的 Web 遥控思路
- 可参考 ROS2 joystick teleop 的 `Joy -> Twist` 思路
- 只能借鉴交互和架构思路，不要直接复制 GPL 项目代码

控制模式：

#### 模式 A：底盘移动

左摇杆控制底盘：

```text
上/下：linear.x 前进/后退
左/右：angular.z 左转/右转
```

#### 模式 B：云台转动

右摇杆控制云台：

```text
左右：yaw
上下：pitch
```

#### 模式 C：底盘跟随云台移动

云台朝向作为底盘移动参考：

```text
- 右摇杆控制云台方向
- 左摇杆控制前进/后退
- 底盘可按云台朝向进行辅助转向
- 必须提供开关，不能默认开启
```

安全要求：

```text
- 摇杆松开必须立即归零
- 浏览器断开或超过 500ms 没有控制心跳，机器人必须停止
- 页面必须有急停按钮
- 急停按钮必须高优先级
- 控制频率建议 10Hz - 30Hz
- 控制速度必须有限幅
- 首次启动默认低速模式
```

ROS2 Topic 建议由 Codex 根据项目实际确认，不要硬编码。如果没有现成话题，可先抽象：

```text
/cmd_vel
/gimbal/cmd
/control/mode
/control/emergency_stop
```

### 2.5 Perception Agent：识别智能体

职责：

- 实现人和物体识别
- 初期只做识别展示，不直接接管机器人控制
- 识别链路必须异步，不得阻塞视频预览和手动遥控

分类策略：

```text
可移动目标：person
不可移动/环境目标：wall、bed、cabinet、chair、table、door 等
```

注意：标准 COCO 模型未必能直接识别 wall、cabinet 等类别。请根据项目使用的模型能力做适配：

```text
- 如果模型支持这些类别，则直接展示
- 如果模型不支持，则先以配置文件方式保留类别映射
- 不要为了识别 wall 强行训练模型
- 初期可以把静态物体能力做成可扩展接口
```

实现要求：

- 使用 yolo_ros 或现有识别节点时，必须先确认其 ROS2 topic、消息类型、启动方式
- 检测结果通过 overlay 叠加在视频上
- UI 右侧显示识别列表：类别、置信度、位置、是否可锁定
- 只有 person 可以锁定
- 识别频率可以低于视频帧率，例如视频 25-30fps，识别 5-15fps
- 推理异常不能导致视频预览失败

验收标准：

```text
- 视频画面可以显示检测框
- 右侧可以看到识别结果列表
- person 与 object 有不同视觉样式
- 关闭识别功能后，视频和手动遥控仍正常
```

### 2.6 Target Lock Agent：人物锁定智能体

职责：

- 基于识别结果实现人物锁定
- 只能锁定 person
- 锁定时必须保存目标照片
- 页面必须展示锁定目标状态

交互要求：

```text
- 用户点击视频中的 person 检测框进行锁定
- 或在右侧识别列表点击“锁定”
- 锁定后保存当前帧截图
- 保存内容至少包括：完整画面截图、person 裁剪图、时间、检测框坐标、置信度
- 锁定目标在 UI 中高亮显示
- 支持取消锁定
```

建议数据结构：

```json
{
  "lock_id": "string",
  "class_name": "person",
  "created_at": "ISO8601",
  "snapshot_full_path": "string",
  "snapshot_crop_path": "string",
  "bbox": {"x": 0, "y": 0, "w": 0, "h": 0},
  "confidence": 0.0,
  "track_id": "optional",
  "status": "locked | lost | reacquired | cancelled"
}
```

实现要求：

- 初期优先使用检测框 + tracker id 做锁定
- 如果 tracker 不稳定，再扩展 ReID / 图像特征比对
- 不要第一阶段就引入复杂 ReID 模型
- 目标丢失时要进入 lost 状态，而不是立即解除锁定

验收标准：

```text
- 可以点击 person 完成锁定
- 锁定后能保存照片
- 页面能显示锁定照片和锁定状态
- 非 person 目标不能锁定
```

### 2.7 Auto Follow Agent：自动跟随智能体

职责：

- 在人物识别和锁定稳定后，实现自动跟随
- 自动跟随必须先低速、安全、可关闭
- 必须能控制底盘和云台协同动作
- 跟踪距离控制在 1 米左右
- 人物丢失后，云台需要搜索刚才的目标
- 10 秒无法找回时，通过提示音和灯光闪烁告警

重要说明：

本阶段是难点，不允许在视频、手动遥控、识别、锁定不稳定时强行实现。

控制逻辑建议：

```text
输入：锁定目标 bbox、目标中心点、bbox 高度/面积、可选深度距离、云台角度、底盘状态
输出：底盘 linear.x / angular.z，云台 yaw / pitch
```

基本策略：

```text
- 目标在画面左侧：云台向左修正，必要时底盘左转
- 目标在画面右侧：云台向右修正，必要时底盘右转
- 目标偏上/偏下：云台 pitch 修正
- 目标距离过远：底盘前进
- 目标距离过近：底盘后退
- 目标距离合适：底盘停止或低速保持
```

距离控制：

```text
优先级 1：如果有深度数据，使用深度距离
优先级 2：如果无深度数据，使用 bbox 高度/面积估算距离
目标距离：约 1 米
允许误差：0.8m - 1.2m
```

目标丢失处理：

```text
0-2 秒：保持低速或停止，尝试基于上一位置微调云台
2-10 秒：执行云台搜索策略，上下左右扫描
10 秒后：停止底盘，触发提示音和灯光闪烁，UI 显示 lost timeout
```

安全要求：

```text
- 自动跟随必须有明显开关
- 进入自动跟随前必须已有 locked person
- 自动跟随中用户手动操作应立即接管或退出自动模式
- 前方疑似障碍物时必须停止或降低速度
- 控制输出必须限幅和平滑
- 必须提供 PID 参数或控制参数配置
```

验收标准：

```text
- 锁定人物后可以进入自动跟随
- 人前进，机器人低速前进
- 人后退，机器人低速后退
- 人左右移动，云台优先跟随，必要时底盘转向
- 短暂丢失后能尝试搜索
- 超过 10 秒丢失能停止并告警
```

### 2.8 QA & Observability Agent：测试与可观测智能体

职责：

- 为每个阶段提供测试方法
- 增加日志和状态面板
- 记录视频 FPS、控制延迟、识别耗时、跟随状态
- 保证失败可定位

必须提供：

```text
- 前端启动命令
- 后端启动命令
- ROS2 launch 命令
- 视频测试方法
- 手动控制测试方法
- 识别测试方法
- 锁定测试方法
- 自动跟随低速测试方法
```

建议新增文档：

```text
docs/TEST_PLAN.md
docs/RUNBOOK.md
docs/TROUBLESHOOTING.md
```

---

## 3. 分阶段开发路线

### Phase 0：清洁重建准备、项目审计与隔离旧方案

目标：确认本次是全新开发，不继续修旧代码；先搞清楚项目现状，隔离历史实现，建立新系统目录和文档基线。

任务：

```text
1. 读取 AGENTS.md
2. 扫描项目结构
3. 找出现有视频、控制、识别、跟随相关旧代码
4. 标记旧代码为 abandoned / legacy，不作为新系统实现基础
5. 仅提取硬件连接、topic、端口、启动命令等线索
6. 建立新开发目录和阶段边界
7. 输出 docs/PROJECT_AUDIT.md
8. 输出 docs/DEVELOPMENT_PHASES.md
9. 输出 docs/OPEN_SOURCE_DEPS.md 初版
10. 输出 docs/RUNBOOK.md 初版
11. 输出 docs/TEST_PLAN.md 初版
```

不要做：

```text
- 不要实现自动跟随
- 不要重构所有代码
- 不要复用旧业务代码
- 不要删除旧代码，除非确认无用、AGENTS.md 允许，并说明原因；默认隔离到 legacy 或文档标记废弃
```

验收：

```text
- 文档清楚说明当前项目结构
- 文档清楚标记哪些旧代码不再使用
- 新系统入口清楚
- Ubuntu 20.04 部署前置条件清楚
- 后续阶段的入口清楚
```

---

### Phase 1：视频回传与预览

目标：先把摄像头画面做到清晰、稳定、流畅。

任务：

```text
1. 找到当前摄像头 topic
2. 复用或修复 web_video_server / MJPEG 预览链路作为 Phase 1 基线
3. 前端实现 1080P 视频预览组件
4. 增加连接状态、FPS、延迟、重连提示
5. 增加全屏预览
6. 增加视频质量档位
7. 保证 YOLO 不启动时视频也能看
8. 明确后续 WebRTC / H.264 低延迟升级方案，不要求本阶段一次完成
9. 明确 rosbridge 不承载 1080P 主视频帧
```

关键要求：

```text
- 主视频流不得依赖推理服务
- 不要为了识别降低视频分辨率
- overlay 要和 video/image 分层实现
```

验收：

```text
- 浏览器能打开页面看到 1080P 视频
- 关闭识别功能不影响视频
- 视频断开后页面显示断开并自动重连
```

---

### Phase 2：手柄式手动遥控

目标：实现稳定、安全、可用的手动遥控。

任务：

```text
1. 实现左摇杆：底盘 linear.x / angular.z
2. 实现右摇杆：云台 yaw / pitch
3. 实现模式切换：底盘、云台、底盘跟随云台
4. 实现急停
5. 实现心跳和断连停止
6. 实现速度档位和灵敏度调节
7. 页面显示当前控制输出
```

交互要求：

```text
- 不使用十字键
- 使用虚拟摇杆
- 摇杆应支持鼠标、触摸屏、平板浏览器
- 松手自动归零
```

验收：

```text
- 能安全控制底盘移动
- 能安全控制云台移动
- 急停有效
- 浏览器断开或停止发送心跳后机器人停止
```

---

### Phase 3：人和物体识别展示

目标：先做识别展示，不接管控制。

任务：

```text
1. 启动或接入 yolo_ros
2. 获取检测结果 topic
3. 将检测结果传给前端
4. 在视频 overlay 上绘制检测框
5. 右侧显示识别列表
6. person 和 object 使用不同视觉样式
7. 识别异常时不影响视频和遥控
```

验收：

```text
- 人可以被识别并显示 person
- 物体可以按当前模型能力显示
- 检测框和视频基本对齐
- 关闭识别后视频和遥控正常
```

---

### Phase 4：人物锁定与拍照保存

目标：实现只锁定 person 的交互闭环。

任务：

```text
1. 点击 person 检测框进行锁定
2. 非 person 不允许锁定
3. 锁定时保存完整截图和人物裁剪图
4. UI 显示锁定照片和状态
5. 支持取消锁定
6. 支持目标短暂丢失状态
```

验收：

```text
- 点击人物可以锁定
- 锁定照片保存成功
- 页面显示锁定信息
- 非人物不能锁定
```

---

### Phase 5：自动跟随 MVP

目标：在低速、安全条件下实现基础跟随。

任务：

```text
1. 自动跟随必须依赖 locked person
2. 云台优先保持目标居中
3. 底盘根据目标距离前进/后退
4. 底盘根据目标水平偏差低速转向
5. 实现目标丢失搜索
6. 实现 10 秒丢失告警
7. 实现手动接管
```

验收：

```text
- 人前进，机器人前进
- 人后退，机器人后退
- 人左右偏移，云台跟随
- 丢失后搜索
- 10 秒找不到后停止并告警
```

---

### Phase 6：场景操作页面保留

目标：只保留页面和扩展入口，不做复杂功能。

任务：

```text
1. 新增“场景操作”页面或标签
2. 页面显示 Coming Soon / Reserved for scene actions
3. 预留后续接口位置
```

验收：

```text
- 页面存在
- 不影响其他功能
```

---

## 3.7 每个阶段完成后的部署与测试文档模板

Codex 每完成一个 Phase，都必须更新 `docs/RUNBOOK.md` 和 `docs/TEST_PLAN.md`，并在最终回复中给出对应摘要。

### 3.7.1 Phase 0 正常结果

```text
部署要点：无需部署业务服务，完成目录审计和旧代码隔离。
测试步骤：检查 docs/PROJECT_AUDIT.md、docs/DEVELOPMENT_PHASES.md、docs/OPEN_SOURCE_DEPS.md 是否生成。
正常结果：能够明确看到新系统开发入口、旧代码废弃说明、Ubuntu 20.04 环境要求、Phase 1 视频链路计划。
异常排查：如果无法判断项目结构，检查 AGENTS.md、README、package.json、setup.py、CMakeLists.txt、launch 文件是否存在。
```

### 3.7.2 Phase 1 正常结果

```text
部署要点：安装/启动视频相关依赖，确认摄像头 topic 和视频服务端口。
测试步骤：启动 ROS2 摄像头节点和视频服务，打开 Web 页面，切换 1080P/720P 档位。
正常结果：页面能稳定看到视频；视频状态显示 connected、分辨率、FPS、重连状态；关闭 YOLO 不影响视频。
异常排查：无画面时检查 camera topic、web_video_server 端口、防火墙、浏览器 URL、ROS_DOMAIN_ID。
```

### 3.7.3 Phase 2 正常结果

```text
部署要点：启动 robot_web_bridge / control bridge / safety_arbiter。
测试步骤：打开页面，连接机器人，分别测试左摇杆、右摇杆、急停、断连停止。
正常结果：摇杆松手归零；控制输出 10-30Hz；急停后机器人停止；浏览器断连或 500ms 无心跳后停止。
异常排查：无法控制时检查 WebSocket、/cmd_vel、云台 topic、权限、RoboMaster SDK 连接状态。
```

### 3.7.4 Phase 3 正常结果

```text
部署要点：安装/启动 yolo_ros 或 detection_adapter_node，确认模型和 detection topic。
测试步骤：打开识别开关，让人物进入画面，观察 overlay 和右侧识别列表。
正常结果：person 有检测框；物体按模型能力展示；关闭识别后视频和遥控仍正常。
异常排查：无检测结果时检查模型路径、topic 名称、GPU/CPU 推理日志、消息类型适配。
```

### 3.7.5 Phase 4 正常结果

```text
部署要点：确认截图保存目录权限，启动 target_lock_node 或后端锁定接口。
测试步骤：点击 person 检测框或识别列表中的锁定按钮。
正常结果：只允许锁定 person；保存完整截图和人物裁剪图；右侧显示锁定照片、时间、bbox、状态。
异常排查：无法保存图片时检查目录权限、截图接口、bbox 坐标映射、视频尺寸与 overlay 尺寸是否一致。
```

### 3.7.6 Phase 5 正常结果

```text
部署要点：启动 follow_controller_node 和 safety_arbiter_node，使用低速参数。
测试步骤：先锁定 person，再手动开启自动跟随，在安全空旷环境低速测试。
正常结果：人物前进机器人低速前进；人物后退机器人低速后退；人物左右移动优先云台跟踪；丢失后搜索；10 秒未找回停止并告警。
异常排查：跟随抖动时检查 PID/限幅/平滑参数；误跟随时检查 lock_id、track_id、ReID/重识别策略；危险移动时立即急停并检查 safety_arbiter。
```

### 3.7.7 Phase 6 正常结果

```text
部署要点：前端页面路由/标签加入场景操作入口。
测试步骤：点击“场景操作”页面或标签。
正常结果：页面显示预留状态，不影响视频、遥控、识别、锁定、跟随功能。
异常排查：页面异常时检查前端路由、组件导入和状态共享。
```

---

## 4. 前端页面详细要求

### 4.1 页面不是后台管理系统

禁止出现以下风格：

```text
- 普通后台管理 dashboard
- 白底卡片 + 紫色渐变
- 大量无意义 AI 风格发光球
- generic SaaS 模板
- 表格堆叠式页面
```

### 4.2 页面必须像机器人控制台

必须体现：

```text
- 视频画面是第一主角
- 摇杆控制是第二主角
- 状态信息围绕操作流展示
- 所有按钮都要服务真实机器人操作
- 不做装饰性假数据
```

### 4.3 必须具备的 UI 模块

```text
- 机器人连接状态
- ROS2 bridge 状态
- 摄像头状态
- 视频 FPS / 分辨率 / 延迟
- 当前控制模式
- 急停按钮
- 左摇杆：底盘
- 右摇杆：云台
- 速度档位
- 灵敏度
- 视频预览
- 检测框 overlay
- 识别结果列表
- 锁定人物卡片
- 锁定照片预览
- 自动跟随状态
- 告警提示
- 场景操作预留页面
```

### 4.4 交互细节

```text
- 摇杆要有 dead zone
- 摇杆输出要实时显示数值
- 急停按钮要一直可见
- 自动跟随开启前要检查是否有锁定人物
- 锁定目标丢失时要明显提示
- 视频断开要提示并自动重连
- ROS2 连接断开要禁用控制按钮
- 移动端/平板触摸要可操作
```

---

## 5. 架构原则

### 5.1 视频和推理解耦

错误方式：

```text
camera -> YOLO/server inference -> frontend video
```

正确方式：

```text
camera -> video stream -> frontend preview
camera -> inference sampling -> yolo_ros -> detection result -> frontend overlay
```

### 5.2 手动控制和自动跟随解耦

```text
manual teleop 直接控制 cmd_vel / gimbal
follow controller 只在自动模式下输出 cmd_vel / gimbal
安全控制器负责仲裁急停、断连、限速
```

建议抽象：

```text
Control Arbiter:
- emergency_stop 最高优先级
- manual_override 次高优先级
- auto_follow 最低优先级
```

### 5.3 识别和锁定解耦

```text
detection: 负责发现目标
tracking: 负责短时间关联目标
lock: 负责用户选择和状态保持
reacquire: 负责丢失后重新找回
follow: 只跟随 lock/reacquire 提供的目标状态
```

---


## 5.4 Ubuntu 20.04 测试环境要求

本项目测试环境固定为 Ubuntu 20.04。Codex 在写代码、脚本和文档时必须以该环境为准。

### 5.4.1 环境检测优先

开发前先执行并记录：

```bash
lsb_release -a
python3 --version
node --version || true
npm --version || true
printenv | grep ROS || true
ls /opt/ros || true
ros2 --version || true
```

要求：

```text
- 不要默认假设 ROS2 版本
- 不要默认假设 Node.js 已安装
- 不要默认假设 GPU/CUDA 可用
- 所有安装命令必须适配 Ubuntu 20.04
- 如果某依赖不支持 Ubuntu 20.04，必须在文档中说明替代方案
```

### 5.4.2 部署脚本要求

如果新增部署脚本，建议放在：

```text
scripts/
  setup_ubuntu20.sh
  start_frontend.sh
  start_backend.sh
  start_ros_nodes.sh
  check_env.sh
```

脚本要求：

```text
- 不要静默失败
- 每一步输出清晰日志
- 不要强制覆盖用户环境
- 安装前先检测
- 失败时提示下一步人工检查命令
```

---

## 5.5 推荐最终技术栈选择

本项目可以分阶段采用以下技术栈组合。Codex 必须先检查现有项目，不要无脑新建；如果现有技术栈已经能满足要求，应优先复用和渐进重构。

### 5.5.1 前端推荐

```text
React + TypeScript + Vite
Canvas/SVG HUD overlay
Pointer Events 自研虚拟摇杆或轻量 joystick 组件
WebSocket 控制/状态通道
独立 VideoViewport 视频组件
```

前端架构建议：

```text
src/
  app/
  components/
    RobotControlDeck/
    VideoViewport/
    HudOverlay/
    VirtualJoystick/
    ControlModeSwitch/
    EmergencyStopButton/
    DetectionPanel/
    TargetLockPanel/
    FollowStatusPanel/
    SceneOpsPanel/
  hooks/
    useVideoStatus.ts
    useRobotControl.ts
    useDetections.ts
    useTargetLock.ts
    useFollowStatus.ts
  services/
    controlSocket.ts
    detectionSocket.ts
    apiClient.ts
  styles/
```

### 5.5.2 视频推荐

第一阶段不要追求完美低延迟架构，先把可用画面稳定下来：

```text
Phase 1：web_video_server / MJPEG 作为可用基线
Phase 1.5：增加码率、帧率、分辨率、重连、延迟监测
Phase 2+：评估 WebRTC / RTSP to WebRTC / GStreamer H.264 硬件编码
```

视频链路必须独立运行：

```text
主预览：camera -> video stream -> browser
识别：camera -> sampled frame -> yolo_ros -> detection result -> overlay
```

### 5.5.3 后端/ROS2 桥接推荐

优先选择 Python ROS2 生态，便于直接接入 rclpy：

```text
FastAPI + WebSocket + rclpy
```

推荐节点/服务边界：

```text
robot_web_bridge：前端 WebSocket 与 ROS2 topic/service 的桥接
video_status_node：视频状态采集与上报
detection_adapter_node：检测结果适配与轻量化输出
target_lock_node：人物锁定、截图、状态保持
follow_controller_node：自动跟随控制逻辑
safety_arbiter_node：急停、手动接管、限速、断连保护
```

如果现有项目已经使用 Node.js / Flask / rosbridge，可以保留，但必须满足：

```text
- 不承载 1080P 主视频帧
- 控制命令有频率限制和超时停止
- 状态通道和控制通道可观测
- 异常日志清晰
```

### 5.5.4 AI 推荐

```text
yolo_ros 作为 ROS2 识别节点
初期只做 person + object 展示
检测结果只传轻量 JSON
推理频率低于视频帧率
不要一开始引入复杂 ReID
```

### 5.5.5 跟随控制推荐

```text
MVP：bbox 中心偏差 + bbox 面积/高度估算距离 + 云台优先跟踪 + 底盘低速跟随
增强：深度距离 / ReID / 更稳定 tracker / 避障融合
```

跟随控制必须通过 safety_arbiter 仲裁，禁止直接绕过安全层控制底盘。

---

## 6. 技术实现建议

请根据项目实际技术栈选择，不要强行替换。

### 6.1 前端建议

如果项目已有 React/Vite：优先继续使用。

建议组件：

```text
RobotControlDeck
VideoViewport
HudOverlay
VirtualJoystick
ControlModeSwitch
EmergencyStopButton
DetectionPanel
TargetLockPanel
FollowStatusPanel
SceneOpsPanel
ConnectionStatusBar
```

### 6.2 后端/桥接建议

优先推荐：

```text
FastAPI + WebSocket + rclpy bridge
```

如果项目已有 rosbridge、Flask、Node.js websocket bridge，可以保留，但必须遵守边界：

```text
- rosbridge / JSON WebSocket 只传轻量控制、状态、识别结果
- 不通过 rosbridge 传输 1080P 原始图像帧或 base64 大图
- 不让视频链路依赖 AI 推理服务
- 不让 AI 推理链路阻塞手动控制链路
```

后端要求：

```text
- 控制命令必须有频率限制
- 控制命令必须有安全停止
- 浏览器断连必须触发停止
- 视频代理不得额外转码，除非确有必要
- 后端必须输出清晰日志
- 所有 WebSocket 消息要有 type、timestamp、trace_id 或 request_id
```

### 6.3 ROS2 节点建议

建议按职责拆分：

```text
robot_web_bridge
video_status_node
detection_adapter_node
target_lock_node
follow_controller_node
safety_arbiter_node
```

如果当前项目较小，可以先不拆太细，但代码结构必须预留边界。

---

## 7. 关键验收指标

每个指标需要在文档或 UI 中显示实际测试结果。

```text
视频：1080P 可预览，目标 25-30fps，本地网络低延迟
控制：摇杆命令 10-30Hz，松手归零，断连 500ms 内停止
识别：识别链路异常不影响视频和手动遥控
锁定：person 可锁定，非 person 不可锁定，锁定保存截图
跟随：目标距离约 1m，丢失 10 秒后停止并告警
安全：急停始终可用，自动跟随可手动接管
```

如果硬件、网络或模型能力导致无法达标，必须明确说明瓶颈，不要伪造结果。

---

## 8. Codex 执行顺序

请严格按下面顺序执行：

```text
Step 1：读取 AGENTS.md
Step 2：确认 Ubuntu 20.04 测试环境和本机 ROS2/Node/Python 版本
Step 3：审计项目结构
Step 4：明确旧代码隔离策略，不复用旧业务代码
Step 5：输出 docs/PROJECT_AUDIT.md
Step 6：输出 docs/DEVELOPMENT_PHASES.md
Step 7：输出 docs/OPEN_SOURCE_DEPS.md 初版
Step 8：输出 docs/RUNBOOK.md 和 docs/TEST_PLAN.md 初版
Step 9：只实现 Phase 1 视频预览
Step 10：验证 Phase 1，并更新部署/测试/正常结果文档
Step 11：再实现 Phase 2 手动遥控
Step 12：验证 Phase 2，并更新部署/测试/正常结果文档
Step 13：再实现 Phase 3 识别展示
Step 14：验证 Phase 3，并更新部署/测试/正常结果文档
Step 15：再实现 Phase 4 人物锁定
Step 16：验证 Phase 4，并更新部署/测试/正常结果文档
Step 17：最后再实现 Phase 5 自动跟随 MVP
Step 18：验证 Phase 5，并更新部署/测试/正常结果文档
Step 19：保留 Phase 6 场景操作页面
Step 20：输出最终运行文档、测试文档和已知问题
```

如果一次 Codex 会话无法完成全部阶段，请优先完成：

```text
Phase 0 + Phase 1 + Phase 2
```

不要为了追求完成全部功能而牺牲视频和遥控稳定性。

---

## 9. 禁止事项

```text
- 禁止继续在旧的大而全方案上盲目修补
- 禁止复用之前写过的业务代码作为新系统实现基础
- 禁止从旧目录复制粘贴旧前端、旧后端、旧跟随控制代码
- 禁止继续采用“服务器后台推理闭环”作为主架构
- 禁止一开始就做自动跟随
- 禁止让视频预览依赖服务器推理
- 禁止通过 rosbridge / JSON WebSocket 传输 1080P 主视频帧
- 禁止把 base64 大图作为高频视频流推给前端
- 禁止让 AI 推理阻塞视频预览或手动控制
- 禁止为了 YOLO 降低主视频清晰度
- 禁止用十字键代替摇杆
- 禁止做普通后台管理页面
- 禁止使用 generic AI 风格 UI
- 禁止使用紫色渐变白底模板
- 禁止使用 Arial、Roboto、Inter 作为主视觉字体
- 禁止没有急停和断连停止就控制机器人
- 禁止复制 GPL 项目代码到本项目，除非项目许可证兼容且明确声明
- 禁止使用用户本地旧版开源项目拷贝；如需开源项目，必须由 Codex 自行下载最新版本并记录 commit
- 禁止伪造测试结果
- 禁止阶段开发完成后不写部署步骤、测试步骤和正常预期结果
```

---

## 10. 本轮最终输出要求

完成修改后，请输出：

```text
1. 修改了哪些文件
2. 每个阶段完成情况
3. 如何启动前端
4. 如何启动后端/ROS2 节点
5. 如何打开视频页面
6. 如何测试摇杆控制
7. 如何测试识别
8. 如何测试锁定
9. 自动跟随是否实现；如果未实现，说明卡在哪个前置阶段
10. 当前已知问题和下一步建议
11. 当前采用的视频链路、控制链路、AI 链路和后续 WebRTC/H.264 升级建议
12. Ubuntu 20.04 部署要点
13. 每个阶段的测试步骤和正常预期结果
14. 使用到的开源项目 URL、版本、commit、许可证
```

最终请确保项目中至少新增或更新以下文档：

```text
docs/PROJECT_AUDIT.md
docs/DEVELOPMENT_PHASES.md
docs/RUNBOOK.md
docs/TEST_PLAN.md
docs/OPEN_SOURCE_DEPS.md
docs/TROUBLESHOOTING.md
```

---

## 11. 先执行的第一条 Codex 指令

现在请从以下动作开始，不要跳过：

```text
1. 读取项目根目录 AGENTS.md
2. 扫描项目结构
3. 不写业务代码，先输出 docs/PROJECT_AUDIT.md 和 docs/DEVELOPMENT_PHASES.md
4. 明确旧代码如何隔离，确认不复用旧业务实现
5. 明确 Phase 1 视频链路如何实现
6. 明确 Ubuntu 20.04 上的部署和测试前置条件
7. 等 Phase 0 文档完成后，再开始写 Phase 1 代码
```

请开始执行。
