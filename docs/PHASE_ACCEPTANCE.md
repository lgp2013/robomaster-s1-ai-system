# Phase Acceptance

## Phase 0

- 已读取 `AGENTS.md`
- 已读取 v5 提示词
- 已记录当前环境与目标环境差异
- 已补齐远程服务器与 GitHub 工作流文档

## Phase 1

- 前端主界面已中文化
- 页面不再以手填 Stream URL 作为主流程
- 页面默认展示自动发现结果
- 后端已生成 `runtime/robot_discovery.json`
- 后端已提供自动发现与视频源接口
- 页面支持本地模拟视频链路
- 页面布局已改为视频主视图优先
- 后端已支持通过 `HOST` / `PORT` 环境变量绑定远程地址

## Phase 2

- 后端已提供 `/ws/control`
- 后端已提供 `/api/control/state`
- 前端已提供底盘摇杆、云台摇杆、模式切换、急停、解除急停
- 松手、失焦、断连、心跳超时均会自动归零
- 本地烟雾测试已验证控制状态机可用

## 尚未通过的 Phase 2 项

- 未在 Ubuntu 20.04 + ROS2 Foxy 上完成真实 `cmd_vel` 发布验证
- 未在真机上完成云台控制 Topic 联调
- 未在真实 ROS2 环境中确认自动发现到的控制 Topic 是否足够覆盖底盘和云台
