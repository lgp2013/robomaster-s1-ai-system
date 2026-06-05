# 当前项目审计报告

> 审计日期：2026-06-05
> 审计依据：ros2_robomaster_codex_prompt_v9.md
> 审计目的：评估现有代码可复用性，制定最小改动计划

---

## 一、项目现状概览

当前项目已实现 **Phase 0 ~ Phase 5** 的核心功能，采用 `server.js + web/` 结构：

| 模块 | 状态 | 技术栈 |
|------|------|--------|
| 前端 | ✅ 可用 | 原生 HTML/CSS/JS |
| 后端 | ✅ 可用 | Node.js HTTP + WebSocket |
| ROS2 桥接 | ✅ 可用 | Python3 rclpy |
| 视频链路 | ✅ 可用 | MJPEG + Canvas |
| 控制链路 | ✅ 可用 | WebSocket → cmd_vel + 云台 Topic |
| AI 识别 | ✅ 可用 | YOLO 独立节点 + JSON 检测数据 |
| 人物锁定 | ✅ 可用 | 点击锁定 + 照片保存 |
| 辅助跟随 | ✅ 可用 | 云台优先 + 底盘低速跟随 |

---

## 二、可复用模块（保留）

### 2.1 前端模块

| 文件 | 功能 | 复用理由 |
|------|------|----------|
| `web/index.html` | 页面结构 | 中文界面已完成，只需修复布局 |
| `web/app.js` | 前端逻辑 | 视频、控制、感知、锁定、跟随逻辑完整 |
| `web/styles.css` | 样式 | 深色工业风格已建立，需优化响应式 |

### 2.2 后端模块

| 文件 | 功能 | 复用理由 |
|------|------|----------|
| `server.js` | HTTP + WebSocket 服务 | 自动发现、视频代理、控制链路、感知接口完整 |
| `ros2_bridge.py` | ROS2 控制桥接 | 发布 cmd_vel + 云台 Topic，已验证可用 |
| `yolo_bridge.py` | YOLO 检测桥接 | 订阅 DetectionArray，写入 detections.json |
| `perception_runtime.js` | 感知运行时 | 独立模块，不阻塞视频和控制 |

### 2.3 脚本模块

| 文件 | 功能 | 复用理由 |
|------|------|----------|
| `scripts/start_backend.sh` | pm2 启动后端 | 已适配远程服务器 |
| `scripts/stop_backend.sh` | 停止后端 | 可用 |
| `scripts/start_ros2_bridge.sh` | 启动 ROS2 桥接 | 可用 |
| `scripts/stop_ros2_bridge.sh` | 停止 ROS2 桥接 | 可用 |
| `scripts/start_yolo_bridge.sh` | 启动 YOLO 桥接 | 可用 |
| `scripts/stop_yolo_bridge.sh` | 停止 YOLO 桥接 | 可用 |

---

## 三、需修复模块

### 3.1 页面布局（高优先级）

**问题：** 页面需要浏览器缩放到 75% 才能看全，不符合 v9 要求。

**影响：** 用户体验差，不符合生产级遥控界面要求。

**修复方案：**
- 使用 `clamp()` 自适应字体
- 视频容器使用 `aspect-ratio: 16/9` 但限制最大高度
- 右侧状态栏在小屏下可折叠
- 标题压缩为顶部状态栏的一部分

### 3.2 媒体管理页面（高优先级）

**问题：** v9 要求新增 `/media` 页面，用于浏览人物锁定照片。

**影响：** 功能缺失，无法查看锁定历史。

**修复方案：**
- 新增 `web/media.html` 媒体管理页面
- 新增 `/api/media/photos` 等后端接口
- 在视频预览区域添加"媒体管理"按钮

### 3.3 机器人信息模块精度（中优先级）

**问题：** 已实现但需按 v9 精确字段格式返回。

**影响：** 字段格式可能不符合 v9 要求。

**修复方案：**
- 确保返回字段包含 `battery_level`、`chassis_speed`（含 source 字段）等
- 未读取到的字段显示"未上报"而非假数据

---

## 四、需新增模块

### 4.1 文档

| 文档 | 说明 |
|------|------|
| `docs/ROBOT_INFO.md` | 机器人信息字段来源、Topic 映射、缺失显示规则 |
| `docs/MEDIA_MANAGEMENT.md` | 媒体目录、命名规则、元数据字段、访问地址 |
| `docs/CURRENT_PROJECT_REVIEW.md` | 本文件 |

### 4.2 接口

| 接口 | 说明 |
|------|------|
| `GET /api/media/photos` | 返回照片列表和元数据 |
| `GET /api/media/photos/{photo_id}` | 返回或重定向到原图 |
| `POST /api/media/rescan` | 重新扫描媒体目录 |

---

## 五、废弃模块

当前未发现需要废弃的模块。所有已实现功能均可在现有基础上修复和增强。

---

## 六、最小改动计划

### 阶段 1：布局修复 + 媒体管理（当前阶段）

1. 修复 `web/styles.css` 解决 100% 缩放问题
2. 新增 `web/media.html` 媒体管理页面
3. 新增 `/api/media/photos` 等后端接口
4. 在视频预览区域添加"媒体管理"按钮
5. 更新 `docs/MEDIA_MANAGEMENT.md`

### 阶段 2：文档完善

1. 创建 `docs/ROBOT_INFO.md`
2. 更新 `docs/TEST_PLAN.md` 补充媒体管理和机器人信息测试
3. 更新 `docs/DEPLOYMENT.md` 补充媒体服务部署

---

## 七、风险评估

| 风险 | 等级 | 缓解措施 |
|------|------|----------|
| 布局修复可能影响现有样式 | 中 | 逐步修改，保留原有视觉风格 |
| 媒体管理页面需要文件系统权限 | 低 | 使用 runtime/ 目录，已有权限 |
| 新增接口可能影响现有性能 | 低 | 接口轻量，异步执行 |

---

## 八、结论

当前项目已具备 **Phase 0~5** 的完整功能基础，技术栈（Node.js + 原生前端）可满足 v9 要求。不需要大规模重构为 React + FastAPI。

**建议策略：** 在现有基础上小步修复布局、新增媒体管理页面、完善文档，优先实现效果而非技术栈替换。
