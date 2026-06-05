# GitHub 工作流

## 目标

本文件约束 RoboMaster S1 项目的 GitHub 交付方式，满足 v5 对“每阶段围绕 GitHub 交付”的要求。

## 当前工作区检查项

当前目录执行 Git 检查结果：

```text
fatal: not a git repository (or any of the parent directories): .git
```

这意味着当前目录不能直接执行：

- `git status`
- `git add`
- `git commit`
- `git push`

因此，本文件只定义标准流程，不伪造当前目录的分支、commit 或 push 成功结果。

## 目标仓库

```text
https://github.com/lgp2013/robomaster-s1-ai-system.git
```

## 标准仓库检查

进入正式仓库目录后先执行：

```bash
git remote -v
git branch --show-current
git status --short
```

## 首次接入仓库

```bash
cd ~
git clone https://github.com/lgp2013/robomaster-s1-ai-system.git
cd robomaster-s1-ai-system
```

如果仓库为私有仓库，先完成 GitHub 认证。

## 阶段提交流程

### 1. 检查变更

```bash
git status
```

### 2. 暂存当前阶段文件

```bash
git add <本阶段修改文件>
```

### 3. 提交

```bash
git commit -m "phase-N: <本阶段功能说明>"
```

示例：

```bash
git commit -m "phase-0: 补齐远程测试服务器与 GitHub 工作流文档"
```

### 4. 推送

```bash
git push origin <当前分支名>
```

### 5. 记录结果

```bash
git branch --show-current
git rev-parse --short HEAD
git status --short
```

## 远程服务器更新流程

GitHub 推送完成后，远程 Ubuntu 20.04 服务器执行：

```bash
cd ~/robomaster-s1-ai-system
git branch --show-current
git pull origin <当前分支名>
```

然后按 [REMOTE_TEST_SERVER.md](D:\codex\robomaster-s1-ai\docs\REMOTE_TEST_SERVER.md) 启动和验证。

## 提交前自检

1. 改动是否直接对应当前阶段目标。
2. 文档是否同步更新。
3. `.env`、密钥、Token、日志、缓存、模型权重是否被排除。
4. 部署、验证、回滚步骤是否可执行。

## 回滚

```bash
git log --oneline -n 10
git checkout <目标commit>
```

## 常见问题

### 1. 当前目录不是 Git 仓库

处理方式：

- 不伪造分支、commit、push 结果。
- 进入正式仓库目录，或重新 `git clone`。

### 2. `git push` 认证失败

处理方式：

- 检查 GitHub 凭据。
- 检查当前账号是否有目标仓库写权限。
- 若使用 SSH，执行 `ssh -T git@github.com` 验证。

### 3. 远程服务器 `git pull` 冲突

处理方式：

- 先执行 `git status`。
- 先处理服务器上的本地改动，再拉取远程代码。
