# 媒体管理

## 功能说明

媒体管理模块用于浏览和管理人物锁定后保存的照片。当用户在控制台中点击人物检测框进行锁定时，系统会自动保存当前视频帧的快照。

## 访问方式

### 控制台入口

在控制台页面顶部操作栏中，点击"媒体管理"按钮，将在新标签页打开媒体管理页面。

### 直接访问

```
http://<服务器IP>:3000/media
```

## API 接口

### 获取照片列表

```
GET /api/media/photos
```

**响应：**
```json
{
  "generatedAt": "2026-06-05T12:00:00.000Z",
  "count": 5,
  "photos": [
    {
      "id": "lock_20260605_120000_abc123",
      "filename": "lock_20260605_120000_abc123.png",
      "url": "/api/media/photos/lock_20260605_120000_abc123",
      "lockedAt": "2026-06-05T12:00:00.000Z",
      "targetLabel": "person",
      "confidence": null
    }
  ]
}
```

### 获取单张照片

```
GET /api/media/photos/{photo_id}
```

**响应：** PNG 图片数据

### 删除照片

```
DELETE /api/media/photos/{photo_id}
```

**响应：**
```json
{
  "ok": true,
  "message": "已删除"
}
```

## 存储位置

照片保存在服务器上的 `runtime/locks/` 目录中，文件名为 `lock_YYYYMMDD_HHMMSS_{hash}.png`。

## 命名规则

- 前缀：`lock_`
- 日期时间：`YYYYMMDD_HHMMSS`
- 随机哈希：`8位随机字符`
- 扩展名：`.png`

## 元数据字段

| 字段 | 说明 |
|------|------|
| `id` | 照片唯一标识 |
| `filename` | 文件名 |
| `url` | 访问地址 |
| `lockedAt` | 锁定时间 |
| `targetLabel` | 目标类型（当前固定为 person） |
| `confidence` | 置信度（当前版本未记录） |

## 注意事项

1. 照片存储在服务器本地，重启服务不会丢失
2. 删除操作不可恢复
3. 建议定期清理旧照片以释放磁盘空间
4. 当前版本仅支持查看和删除，不支持批量操作
