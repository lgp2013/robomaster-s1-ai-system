# 媒体管理

## 页面入口

- 控制台顶部按钮：`媒体管理`
- 页面地址：`http://<服务器IP>:3000/media`

## 存储目录

- 锁定照片目录：`runtime/media/locked_targets/`
- 索引文件：`runtime/media/locked_targets/index.json`

## 文件命名

- 文件名格式：`lock_<ISO时间>.png`
- 当前版本只保存人物锁定快照

## 接口

### 获取照片列表

```http
GET /api/media/photos
```

### 刷新索引

```http
POST /api/media/rescan
```

### 查看或下载原图

```http
GET /api/media/photos/{photo_id}
```

### 删除照片

```http
DELETE /api/media/photos/{photo_id}
```

## 元数据字段

| 字段 | 说明 |
|---|---|
| `id` | 照片唯一标识 |
| `filename` | 文件名 |
| `url` | 原图访问地址 |
| `lockedAt` | 锁定时间 |
| `targetLabel` | 目标类别，当前应为 `person` |
| `confidence` | 置信度，当前版本可能为空 |

## 测试步骤

1. 打开控制台页面。
2. 点击 `媒体管理`，确认新 Tab 打开 `/media`。
3. 没有照片时，确认页面显示中文空状态。
4. 锁定人物后刷新页面，确认新照片出现。
5. 点击 `刷新媒体索引`，确认列表与磁盘内容同步。
6. 点击 `查看原图` 或 `下载`，确认可访问原图。

## 远程服务器排查

```bash
cd ~/robomaster-s1-ai-system
ls -lah runtime/media/locked_targets
cat runtime/media/locked_targets/index.json
```
