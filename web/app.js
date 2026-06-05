const state = {
  config: null,
  discovery: null,
  activeProfile: 'clarity',
  activeSource: null,
  connectionState: 'idle',
  reconnectCount: 0,
  frameCount: 0,
  fps: 0,
  firstFrameLatencyMs: null,
  lastFrameAt: null,
  streamCodec: '-',
  streamResolution: '-',
  renderStartedAt: null,
  shouldReconnect: true,
  reconnectTimer: null,
  reconnectBackoffMs: 700,
  streamAbort: null,
  reader: null,
  frameTimes: [],
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DOUBLE_CRLF_BYTES = encoder.encode('\r\n\r\n');

const el = {
  rescanButton: document.getElementById('rescanButton'),
  mockButton: document.getElementById('mockButton'),
  fullscreenButton: document.getElementById('fullscreenButton'),
  qualityRow: document.getElementById('qualityRow'),
  sourceList: document.getElementById('sourceList'),
  videoSummary: document.getElementById('videoSummary'),
  sourceHint: document.getElementById('sourceHint'),
  emptyCopy: document.getElementById('emptyCopy'),
  videoCanvas: document.getElementById('videoCanvas'),
  videoFrame: document.getElementById('videoFrame'),
  emptyState: document.getElementById('emptyState'),
  connectionPill: document.getElementById('connectionPill'),
  rosValue: document.getElementById('rosValue'),
  stateValue: document.getElementById('stateValue'),
  fpsValue: document.getElementById('fpsValue'),
  latencyValue: document.getElementById('latencyValue'),
  ageValue: document.getElementById('ageValue'),
  reconnectsValue: document.getElementById('reconnectsValue'),
  resolutionValue: document.getElementById('resolutionValue'),
  codecValue: document.getElementById('codecValue'),
  modeValue: document.getElementById('modeValue'),
  environmentValue: document.getElementById('environmentValue'),
  issuesList: document.getElementById('issuesList'),
};

const ctx = el.videoCanvas.getContext('2d', { alpha: false });

function ensureCanvasSize(width = 1280, height = 720) {
  if (el.videoCanvas.width !== width || el.videoCanvas.height !== height) {
    el.videoCanvas.width = width;
    el.videoCanvas.height = height;
  }
}

function setConnectionState(nextState, text = nextState) {
  state.connectionState = nextState;
  el.stateValue.textContent = text;
  el.connectionPill.textContent = text;
  el.connectionPill.classList.remove('is-live', 'is-warn', 'is-error');

  if (nextState === '已连接') {
    el.connectionPill.classList.add('is-live');
  } else if (nextState.includes('连接中') || nextState.includes('重连') || nextState.includes('卡顿')) {
    el.connectionPill.classList.add('is-warn');
  } else if (nextState.includes('离线') || nextState.includes('失败') || nextState.includes('断开')) {
    el.connectionPill.classList.add('is-error');
  }
}

function updateStats() {
  el.fpsValue.textContent = state.fps.toFixed(1);
  el.latencyValue.textContent = state.firstFrameLatencyMs == null ? '-' : `${state.firstFrameLatencyMs.toFixed(0)} ms`;
  el.ageValue.textContent = state.lastFrameAt == null ? '-' : `${Math.max(0, performance.now() - state.lastFrameAt).toFixed(0)} ms`;
  el.reconnectsValue.textContent = String(state.reconnectCount);
  el.resolutionValue.textContent = state.streamResolution;
  el.codecValue.textContent = state.streamCodec;
  el.modeValue.textContent = state.activeSource?.label || '未选择';
  el.rosValue.textContent = state.discovery?.robot?.rosConnected ? '已连接' : '未连接';
  el.environmentValue.textContent = state.discovery?.environment?.os || '未检测';
}

function getSelectedProfile() {
  return state.config?.qualityProfiles.find((entry) => entry.id === state.activeProfile) || state.config?.qualityProfiles?.[0];
}

function getActiveStreamUrl() {
  if (!state.activeSource) {
    return '';
  }
  if (state.activeSource.type === 'mock-mjpeg') {
    return state.activeSource.url;
  }
  const profile = getSelectedProfile();
  const separator = state.activeSource.url.includes('?') ? '&' : '?';
  return `${state.activeSource.url}${profile?.querySuffix ? `${separator}${profile.querySuffix}` : ''}`;
}

function indexOfBytes(haystack, needle, fromIndex = 0) {
  outer: for (let i = fromIndex; i <= haystack.length - needle.length; i += 1) {
    for (let j = 0; j < needle.length; j += 1) {
      if (haystack[i + j] !== needle[j]) {
        continue outer;
      }
    }
    return i;
  }
  return -1;
}

function concatBytes(left, right) {
  if (!left || left.length === 0) {
    return right;
  }
  if (!right || right.length === 0) {
    return left;
  }
  const combined = new Uint8Array(left.length + right.length);
  combined.set(left, 0);
  combined.set(right, left.length);
  return combined;
}

function parseBoundary(contentType) {
  const match = /boundary="?([^";]+)"?/i.exec(contentType);
  return match ? match[1] : '';
}

function parseHeaderBlock(bytes) {
  const text = decoder.decode(bytes);
  const headers = new Map();
  for (const line of text.split('\r\n')) {
    const splitIndex = line.indexOf(':');
    if (splitIndex > 0) {
      headers.set(line.slice(0, splitIndex).trim().toLowerCase(), line.slice(splitIndex + 1).trim());
    }
  }
  return headers;
}

function trimTrailingCrlf(bytes) {
  if (bytes.length >= 2 && bytes[bytes.length - 2] === 13 && bytes[bytes.length - 1] === 10) {
    return bytes.slice(0, bytes.length - 2);
  }
  return bytes;
}

async function renderFrameFromBlob(blob, meta = {}) {
  const objectUrl = URL.createObjectURL(blob);
  const image = new Image();
  return new Promise((resolve, reject) => {
    image.onload = () => {
      try {
        const width = image.naturalWidth || image.width;
        const height = image.naturalHeight || image.height;
        ensureCanvasSize(width, height);
        ctx.drawImage(image, 0, 0, el.videoCanvas.width, el.videoCanvas.height);
        state.streamResolution = `${width} x ${height}`;
        state.streamCodec = meta.codec || blob.type || 'image/jpeg';
        state.frameCount += 1;
        state.lastFrameAt = performance.now();
        state.frameTimes.push(state.lastFrameAt);
        state.frameTimes = state.frameTimes.filter((timestamp) => state.lastFrameAt - timestamp <= 1000);
        state.fps = state.frameTimes.length;
        if (state.firstFrameLatencyMs == null && state.renderStartedAt != null) {
          state.firstFrameLatencyMs = state.lastFrameAt - state.renderStartedAt;
        }
        el.emptyState.style.display = 'none';
        updateStats();
        resolve();
      } finally {
        URL.revokeObjectURL(objectUrl);
      }
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error(`无法解码视频帧：${blob.type || 'unknown'}`));
    };
    image.src = objectUrl;
  });
}

function clearReconnectTimer() {
  if (state.reconnectTimer) {
    clearTimeout(state.reconnectTimer);
    state.reconnectTimer = null;
  }
}

function scheduleReconnect(reason) {
  if (!state.shouldReconnect) {
    setConnectionState('已断开');
    return;
  }
  clearReconnectTimer();
  const backoff = state.reconnectBackoffMs;
  state.reconnectBackoffMs = Math.min(5000, Math.round(backoff * 1.6));
  setConnectionState(`重连中：${reason}`);
  state.reconnectTimer = setTimeout(() => {
    connectToCurrentSource();
  }, backoff);
}

function stopCurrentStream() {
  state.shouldReconnect = false;
  clearReconnectTimer();
  if (state.streamAbort) {
    state.streamAbort.abort();
    state.streamAbort = null;
  }
  state.reader = null;
  state.frameTimes = [];
  state.fps = 0;
  state.lastFrameAt = null;
  setConnectionState('已断开');
  updateStats();
}

function drawDisconnectedOverlay(title, message) {
  const { width, height } = el.videoCanvas;
  ctx.fillStyle = '#050607';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  ctx.fillRect(0, 0, width, height);
  ctx.fillStyle = '#ffc857';
  ctx.font = '700 34px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  ctx.fillText(title, 72, 96);
  ctx.fillStyle = '#dce3ee';
  ctx.font = '500 22px Bahnschrift, "Microsoft YaHei UI", sans-serif';
  ctx.fillText(message, 72, 136);
}

async function connectToCurrentSource() {
  clearReconnectTimer();
  const sourceUrl = getActiveStreamUrl();

  if (!sourceUrl) {
    state.shouldReconnect = false;
    drawDisconnectedOverlay('未发现可用视频源', '请先执行重新扫描，或切换到本地模拟视频。');
    setConnectionState('空闲');
    updateStats();
    el.emptyState.style.display = 'flex';
    el.emptyCopy.textContent = '当前没有可连接的视频源。';
    return;
  }

  state.shouldReconnect = true;
  state.renderStartedAt = performance.now();
  state.firstFrameLatencyMs = null;
  state.frameCount = 0;
  state.frameTimes = [];
  state.fps = 0;
  state.streamResolution = '-';
  state.streamCodec = '-';
  state.lastFrameAt = null;
  state.reconnectBackoffMs = 700;
  setConnectionState('连接中');
  updateStats();

  if (state.streamAbort) {
    state.streamAbort.abort();
  }

  const controller = new AbortController();
  state.streamAbort = controller;

  try {
    const response = await fetch(sourceUrl, {
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status} ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type') || '';
    const boundary = parseBoundary(contentType);
    if (!boundary) {
      throw new Error(`未找到 MJPEG 边界：${contentType || '(empty)'}`);
    }

    const boundaryBytes = encoder.encode(`--${boundary}`);
    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('响应体不可读。');
    }

    state.reader = reader;
    setConnectionState('已连接');
    updateStats();

    let buffer = new Uint8Array(0);
    let pendingHeaders = null;
    let seenFirstBoundary = false;

    for (;;) {
      const { value, done } = await reader.read();
      if (done) {
        throw new Error('视频流已结束。');
      }

      buffer = concatBytes(buffer, value);

      while (true) {
        if (!seenFirstBoundary) {
          const firstBoundaryIndex = indexOfBytes(buffer, boundaryBytes);
          if (firstBoundaryIndex < 0) {
            if (buffer.length > boundaryBytes.length * 2) {
              buffer = buffer.slice(-boundaryBytes.length);
            }
            break;
          }
          buffer = buffer.slice(firstBoundaryIndex + boundaryBytes.length);
          if (buffer.length >= 2 && buffer[0] === 13 && buffer[1] === 10) {
            buffer = buffer.slice(2);
          }
          seenFirstBoundary = true;
        }

        if (!pendingHeaders) {
          const headerEndIndex = indexOfBytes(buffer, DOUBLE_CRLF_BYTES);
          if (headerEndIndex < 0) {
            break;
          }
          pendingHeaders = parseHeaderBlock(buffer.slice(0, headerEndIndex));
          buffer = buffer.slice(headerEndIndex + DOUBLE_CRLF_BYTES.length);
        }

        const nextBoundaryIndex = indexOfBytes(buffer, boundaryBytes);
        if (nextBoundaryIndex < 0) {
          break;
        }

        let payload = buffer.slice(0, nextBoundaryIndex);
        payload = trimTrailingCrlf(payload);
        buffer = buffer.slice(nextBoundaryIndex);
        const frameType = pendingHeaders.get('content-type') || 'image/jpeg';
        if (payload.length > 0) {
          await renderFrameFromBlob(new Blob([payload], { type: frameType }), { codec: frameType });
        }
        pendingHeaders = null;
      }
    }
  } catch (error) {
    if (controller.signal.aborted) {
      setConnectionState('已断开');
      updateStats();
      return;
    }
    state.reconnectCount += 1;
    updateStats();
    drawDisconnectedOverlay('视频离线', error instanceof Error ? error.message : String(error));
    scheduleReconnect(error instanceof Error ? error.message : String(error));
  } finally {
    state.reader = null;
  }
}

function activateQuality(profileId) {
  state.activeProfile = profileId;
  localStorage.setItem('robomaster_quality_profile', profileId);
  for (const button of document.querySelectorAll('.quality-chip')) {
    button.classList.toggle('is-active', button.dataset.profile === profileId);
  }
}

function renderQualityProfiles() {
  const profiles = state.config?.qualityProfiles || [];
  el.qualityRow.innerHTML = '';

  for (const profile of profiles) {
    const button = document.createElement('button');
    button.className = 'quality-chip';
    button.dataset.profile = profile.id;
    button.title = profile.description;
    button.textContent = profile.label;
    button.addEventListener('click', () => {
      activateQuality(profile.id);
      if (state.connectionState === '已连接' || state.connectionState.includes('重连')) {
        connectToCurrentSource();
      }
    });
    el.qualityRow.appendChild(button);
  }

  activateQuality(state.activeProfile);
}

function renderIssues() {
  const items = [
    ...(state.discovery?.robot?.issues || []),
    ...(state.discovery?.troubleshooting || []),
  ];
  el.issuesList.innerHTML = '';
  for (const item of items) {
    const li = document.createElement('li');
    li.textContent = item;
    el.issuesList.appendChild(li);
  }
}

function activateSource(sourceId, autoConnect = true) {
  const source = state.discovery?.videoSources?.find((entry) => entry.id === sourceId) || null;
  state.activeSource = source;
  for (const node of document.querySelectorAll('.source-card')) {
    node.classList.toggle('is-active', node.dataset.sourceId === sourceId);
  }
  el.videoSummary.textContent = source
    ? `当前来源：${source.label}。${source.type === 'mock-mjpeg' ? '这是本地模拟视频，用于 Phase 1 烟雾测试。' : '这是自动发现到的预览来源。'}`
    : '系统将优先使用自动发现到的视频源。';
  updateStats();
  if (autoConnect && source) {
    connectToCurrentSource();
  }
}

function renderSources() {
  el.sourceList.innerHTML = '';
  const sources = state.discovery?.videoSources || [];
  if (sources.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'source-empty';
    empty.textContent = '未发现可用视频源。请检查 ROS2 环境、摄像头 Topic，或使用本地模拟视频。';
    el.sourceList.appendChild(empty);
    return;
  }

  for (const source of sources) {
    const card = document.createElement('button');
    card.className = 'source-card';
    card.dataset.sourceId = source.id;
    card.innerHTML = `
      <span class="source-card-title">${source.label}</span>
      <span class="source-card-meta">${source.type === 'mock-mjpeg' ? '本地模拟' : '自动发现'} / ${source.resolutionHint || '未知分辨率'}</span>
    `;
    card.addEventListener('click', () => activateSource(source.id, true));
    el.sourceList.appendChild(card);
  }

  const defaultSourceId = state.config?.defaultSourceId || sources[0]?.id;
  if (!state.activeSource || !sources.some((entry) => entry.id === state.activeSource.id)) {
    activateSource(defaultSourceId, false);
  } else {
    activateSource(state.activeSource.id, false);
  }
}

async function loadConfig() {
  const response = await fetch('/api/config', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`配置加载失败：${response.status}`);
  }
  state.config = await response.json();
  state.discovery = state.config.discovery;

  const storedProfile = localStorage.getItem('robomaster_quality_profile');
  if (storedProfile && state.config.qualityProfiles.some((profile) => profile.id === storedProfile)) {
    state.activeProfile = storedProfile;
  } else {
    state.activeProfile = state.config.qualityProfiles[0]?.id || 'clarity';
  }
}

async function rescanRobot() {
  setConnectionState('扫描中');
  const response = await fetch('/api/ros/rescan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  });
  if (!response.ok) {
    throw new Error(`重新扫描失败：${response.status}`);
  }
  state.discovery = await response.json();
  renderSources();
  renderIssues();
  updateStats();
  el.emptyCopy.textContent = state.discovery.videoSources.length
    ? '已更新自动发现结果。请选择或等待自动连接。'
    : '重新扫描完成，但仍未发现真实视频源。';
}

function bindEvents() {
  el.rescanButton.addEventListener('click', async () => {
    try {
      await rescanRobot();
      if (state.activeSource) {
        connectToCurrentSource();
      }
    } catch (error) {
      drawDisconnectedOverlay('重新扫描失败', error instanceof Error ? error.message : String(error));
    }
  });

  el.mockButton.addEventListener('click', () => {
    activateSource('mock-stream', true);
  });

  el.fullscreenButton.addEventListener('click', async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await el.videoFrame.requestFullscreen();
  });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && state.connectionState.includes('卡顿')) {
      connectToCurrentSource();
    }
  });
}

function startWatchdog() {
  window.setInterval(() => {
    if (state.connectionState !== '已连接' || state.lastFrameAt == null) {
      return;
    }
    const gapMs = performance.now() - state.lastFrameAt;
    if (gapMs > 4000) {
      setConnectionState('卡顿重连中');
      drawDisconnectedOverlay('视频卡顿', '已超过 4 秒未收到新帧，正在尝试重连。');
      state.reconnectCount += 1;
      updateStats();
      if (state.streamAbort) {
        state.streamAbort.abort();
      }
      scheduleReconnect('帧间隔过大');
    } else {
      updateStats();
    }
  }, 500);
}

async function bootstrap() {
  bindEvents();
  drawDisconnectedOverlay('等待自动发现', '系统正在读取 ROS2 和视频源状态。');
  updateStats();

  try {
    await loadConfig();
  } catch (error) {
    drawDisconnectedOverlay('配置加载失败', error instanceof Error ? error.message : String(error));
    el.emptyCopy.textContent = '无法读取后端配置。';
    return;
  }

  renderQualityProfiles();
  renderSources();
  renderIssues();
  updateStats();
  startWatchdog();

  if (state.activeSource) {
    connectToCurrentSource();
  } else {
    el.emptyState.style.display = 'flex';
    el.emptyCopy.textContent = '当前没有自动发现到可连接的视频源。';
  }
}

bootstrap();
