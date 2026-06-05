const fs = require('node:fs');
const path = require('node:path');

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function createPerceptionRuntime(options) {
  const {
    runtimeRoot,
    onControlUpdate,
    onSnapshotChange,
  } = options;

  const lockRoot = path.join(runtimeRoot, 'locks');
  const detectionPath = path.join(runtimeRoot, 'detections.json');

  fs.mkdirSync(lockRoot, { recursive: true });

  const state = {
    enabled: false,
    provider: 'mock',
    providerMode: 'mock-fallback',
    lastUpdatedAt: 0,
    inferenceFps: 0,
    detectionTopics: [],
    services: [],
    issues: [],
    frame: { width: 1280, height: 720 },
    detections: [],
    sequence: 0,
    sourceCompatibility: {
      dependency: 'yolo_ros',
      ref: '61c9cf363403d1eaa360c8f12f6bcfe7ca993c7f',
      branch: 'main',
      latestSupportsFoxy: false,
      note: 'latest main branch targets Humble/Iron/Jazzy and is not declared compatible with ROS2 Foxy',
    },
    lock: {
      active: false,
      targetId: '',
      className: '',
      trackId: '',
      snapshotPath: '',
      snapshotSavedAt: '',
      status: 'idle',
      lastSeenAt: 0,
      message: '未锁定目标',
    },
    follow: {
      enabled: false,
      status: 'idle',
      warning: '',
      lostSince: 0,
      searchDirection: 1,
      desiredArea: 0.12,
      minArea: 0.05,
      maxArea: 0.22,
      maxLinearX: 0.18,
      maxAngularZ: 0.45,
      maxYawRate: 28,
      maxPitchRate: 18,
    },
  };

  function setIssues(environment) {
    const issues = [];
    if (!state.enabled) {
      issues.push('感知链路未启用，当前不会输出检测框。');
    }
    if (state.providerMode === 'mock-fallback') {
      issues.push('当前使用本地模拟检测结果，仅用于 Phase 3-5 烟雾验证。');
    }
    if (!state.sourceCompatibility.latestSupportsFoxy) {
      issues.push('最新 yolo_ros 主分支未声明支持 ROS2 Foxy，远程 Ubuntu 20.04 需要额外兼容适配或替代检测节点。');
    }
    if (environment && environment.os && environment.os.startsWith('Windows')) {
      issues.push('当前环境为 Windows，本地仅验证 UI、状态机和叠框逻辑。');
    }
    state.issues = issues;
  }

  function currentDetection() {
    if (!state.lock.active) {
      return null;
    }
    return state.detections.find((item) => item.targetId === state.lock.targetId) || null;
  }

  function zeroAutonomy(reason) {
    onControlUpdate({
      velocityCommand: { linearX: 0, angularZ: 0 },
      gimbalCommand: { yawRate: 0, pitchRate: 0 },
      backendState: state.follow.enabled ? '辅助跟随待命' : '感知待命',
      reason,
    });
  }

  function writeSnapshotFile(snapshotDataUrl) {
    if (!snapshotDataUrl || !snapshotDataUrl.startsWith('data:image/png;base64,')) {
      return '';
    }
    const encoded = snapshotDataUrl.slice('data:image/png;base64,'.length);
    const buffer = Buffer.from(encoded, 'base64');
    const filename = `lock_${new Date().toISOString().replace(/[:.]/g, '-')}.png`;
    const filePath = path.join(lockRoot, filename);
    fs.writeFileSync(filePath, buffer);
    return filePath;
  }

  function normalizeRuntimeDetections(parsed) {
    const frame = parsed.frame || {};
    state.frame = {
      width: Number(frame.width) || 1280,
      height: Number(frame.height) || 720,
    };

    return (parsed.detections || []).map((item, index) => ({
      targetId: String(item.targetId || item.id || item.trackId || `det-${index}`),
      classId: Number(item.classId || 0),
      className: String(item.className || item.label || 'unknown'),
      score: Number(item.score || 0),
      trackId: String(item.trackId || item.id || ''),
      bbox: {
        x: clamp(Number(item.bbox?.x || 0), 0, 1),
        y: clamp(Number(item.bbox?.y || 0), 0, 1),
        width: clamp(Number(item.bbox?.width || 0), 0, 1),
        height: clamp(Number(item.bbox?.height || 0), 0, 1),
      },
    }));
  }

  function generateMockDetections() {
    state.sequence += 1;
    const t = state.sequence / 16;
    const personX = 0.42 + Math.sin(t) * 0.18;
    const personY = 0.28 + Math.cos(t * 0.5) * 0.04;
    const personHeight = 0.34 + Math.sin(t * 0.4) * 0.03;
    const personWidth = 0.14;
    const chairX = 0.72 + Math.cos(t * 0.8) * 0.06;

    state.detections = [
      {
        targetId: 'person-001',
        classId: 0,
        className: 'person',
        score: 0.96,
        trackId: 'person-001',
        bbox: {
          x: clamp(personX, 0.05, 0.8),
          y: clamp(personY, 0.08, 0.6),
          width: personWidth,
          height: personHeight,
        },
      },
      {
        targetId: 'chair-001',
        classId: 56,
        className: 'chair',
        score: 0.82,
        trackId: 'chair-001',
        bbox: {
          x: clamp(chairX, 0.55, 0.85),
          y: 0.52,
          width: 0.16,
          height: 0.22,
        },
      },
    ];
    state.frame = { width: 1280, height: 720 };
    state.lastUpdatedAt = Date.now();
    state.inferenceFps = 8;
  }

  function loadRuntimeDetections() {
    if (!fs.existsSync(detectionPath)) {
      return false;
    }
    try {
      const parsed = JSON.parse(fs.readFileSync(detectionPath, 'utf8'));
      state.detections = normalizeRuntimeDetections(parsed);
      state.lastUpdatedAt = Date.now();
      state.inferenceFps = Number(parsed.inferenceFps || 5);
      return true;
    } catch {
      return false;
    }
  }

  function updateFollow() {
    if (!state.follow.enabled) {
      return;
    }

    const detection = currentDetection();
    if (!state.lock.active) {
      state.follow.status = 'idle';
      state.follow.warning = '未锁定人物，无法进入辅助跟随。';
      zeroAutonomy('未锁定人物，辅助跟随未启用。');
      return;
    }

    if (!detection) {
      if (!state.follow.lostSince) {
        state.follow.lostSince = Date.now();
      }
      const lostMs = Date.now() - state.follow.lostSince;
      if (lostMs < 10_000) {
        state.follow.status = 'searching';
        state.lock.status = 'lost';
        state.lock.message = '目标暂时丢失，云台正在搜索。';
        onControlUpdate({
          velocityCommand: { linearX: 0, angularZ: 0 },
          gimbalCommand: { yawRate: state.follow.searchDirection * state.follow.maxYawRate, pitchRate: 0 },
          backendState: '目标搜索',
          reason: '锁定目标暂时丢失，云台执行低速搜索。',
        });
        state.follow.searchDirection *= -1;
      } else {
        state.follow.status = 'warning';
        state.follow.warning = '目标丢失超过 10 秒，请人工接管。';
        zeroAutonomy('目标丢失超过 10 秒，辅助跟随已停止。');
      }
      return;
    }

    state.follow.lostSince = 0;
    state.follow.warning = '';
    state.follow.status = 'tracking';
    state.lock.status = 'locked';
    state.lock.lastSeenAt = Date.now();
    state.lock.message = '已锁定人物，辅助跟随运行中。';

    const centerX = detection.bbox.x + detection.bbox.width / 2;
    const centerY = detection.bbox.y + detection.bbox.height / 2;
    const area = detection.bbox.width * detection.bbox.height;
    const xError = centerX - 0.5;
    const yError = 0.5 - centerY;
    const distanceError = state.follow.desiredArea - area;

    let linearX = clamp(distanceError * 1.2, -state.follow.maxLinearX, state.follow.maxLinearX);
    let angularZ = clamp(xError * 1.1, -state.follow.maxAngularZ, state.follow.maxAngularZ);
    let yawRate = clamp(xError * 80, -state.follow.maxYawRate, state.follow.maxYawRate);
    const pitchRate = clamp(yError * 45, -state.follow.maxPitchRate, state.follow.maxPitchRate);

    if (area > state.follow.maxArea) {
      linearX = -0.08;
    }
    if (area < state.follow.minArea) {
      linearX = clamp(Math.max(linearX, 0.1), 0, state.follow.maxLinearX);
    }
    if (Math.abs(xError) > 0.38) {
      linearX *= 0.4;
      angularZ = clamp(angularZ * 1.2, -state.follow.maxAngularZ, state.follow.maxAngularZ);
    }

    onControlUpdate({
      velocityCommand: {
        linearX: round(linearX),
        angularZ: round(angularZ),
      },
      gimbalCommand: {
        yawRate: round(yawRate, 1),
        pitchRate: round(pitchRate, 1),
      },
      backendState: '辅助跟随',
      reason: '云台优先跟踪目标，底盘以低速辅助跟随。',
    });
  }

  const timer = setInterval(() => {
    if (state.enabled) {
      const hasRuntimeData = loadRuntimeDetections();
      if (!hasRuntimeData) {
        generateMockDetections();
      } else {
        state.provider = 'runtime-json';
        state.providerMode = 'runtime-json';
      }
    } else {
      state.detections = [];
      state.inferenceFps = 0;
    }

    updateFollow();
    onSnapshotChange();
  }, 180);

  timer.unref?.();

  return {
    setDiscovery(topics, services, environment) {
      state.detectionTopics = topics;
      state.services = services;
      state.providerMode = topics.length ? 'ros-topic-available' : 'mock-fallback';
      state.provider = topics.length ? 'ros-topic-or-runtime' : 'mock';
      setIssues(environment);
    },
    setEnabled(enabled, environment) {
      state.enabled = Boolean(enabled);
      if (!state.enabled) {
        state.follow.enabled = false;
        state.follow.status = 'idle';
        state.lock.status = state.lock.active ? 'locked' : 'idle';
        zeroAutonomy('感知链路已关闭。');
      }
      setIssues(environment);
    },
    lockTarget(targetId, snapshotDataUrl) {
      const detection = state.detections.find((item) => item.targetId === targetId);
      if (!detection) {
        return { ok: false, message: '未找到要锁定的目标。' };
      }
      if (detection.className.toLowerCase() !== 'person') {
        return { ok: false, message: 'Phase 4 只允许锁定人物目标。' };
      }
      const snapshotPath = writeSnapshotFile(snapshotDataUrl);
      state.lock = {
        active: true,
        targetId: detection.targetId,
        className: detection.className,
        trackId: detection.trackId,
        snapshotPath,
        snapshotSavedAt: new Date().toISOString(),
        status: 'locked',
        lastSeenAt: Date.now(),
        message: '已锁定人物目标。',
      };
      state.follow.warning = '';
      return { ok: true, message: '已锁定人物目标。' };
    },
    unlockTarget() {
      state.lock = {
        active: false,
        targetId: '',
        className: '',
        trackId: '',
        snapshotPath: '',
        snapshotSavedAt: '',
        status: 'idle',
        lastSeenAt: 0,
        message: '未锁定目标',
      };
      state.follow.enabled = false;
      state.follow.status = 'idle';
      state.follow.warning = '';
      zeroAutonomy('目标锁定已取消。');
    },
    setFollowEnabled(enabled) {
      if (enabled && !state.lock.active) {
        return { ok: false, message: '请先锁定人物目标，再启用辅助跟随。' };
      }
      state.follow.enabled = Boolean(enabled);
      state.follow.status = enabled ? 'tracking' : 'idle';
      state.follow.warning = '';
      state.follow.lostSince = 0;
      if (!enabled) {
        zeroAutonomy('辅助跟随已关闭。');
      }
      return { ok: true, message: enabled ? '辅助跟随已启用。' : '辅助跟随已关闭。' };
    },
    getSnapshot() {
      return {
        enabled: state.enabled,
        provider: state.provider,
        providerMode: state.providerMode,
        inferenceFps: state.inferenceFps,
        lastUpdatedAt: state.lastUpdatedAt,
        frame: state.frame,
        detectionCount: state.detections.length,
        detections: state.detections,
        detectionTopics: state.detectionTopics,
        services: state.services,
        issues: state.issues,
        compatibility: state.sourceCompatibility,
        lock: state.lock,
        follow: state.follow,
      };
    },
    close() {
      clearInterval(timer);
    },
  };
}

module.exports = {
  createPerceptionRuntime,
};
