# Phase Acceptance

## Phase 0

- 已读取 `AGENTS.md`
- 已读取 v5 提示词
- 已记录当前环境与目标环境差异
- 已补齐远程服务器与 GitHub 工作流文档
- 已明确记录当前目录不是 Git 仓库这一阻塞

## Phase 1

- 前端主界面已中文化
- 页面不再以手填 Stream URL 作为主流程
- 页面默认展示自动发现结果
- 后端已生成 `runtime/robot_discovery.json`
- 后端已提供自动发现与视频源接口
- 页面支持本地模拟视频链路
- 页面布局已改为视频主视图优先
- 后端已支持通过 `HOST` / `PORT` 环境变量绑定远程地址
- 已补充远程启动脚本

## 尚未通过的 Phase 1 项

- 未在 Ubuntu 20.04 + ROS2 Foxy 上完成真实扫描验证
- 未完成真实摄像头 Topic 自动发现
- 未完成真实 ROS2 视频源自动接入验证
- 未完成 GitHub 提交与 push，因为当前目录不是 Git 仓库
