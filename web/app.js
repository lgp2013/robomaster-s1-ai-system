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
  control: {
    socket: null,
    socketState: '未连接',
    heartbeatTimer: null,
    commandAgeTimer: null,
    mode: 'chassis',
    emergencyStop: false,
    sequence: 0,
    snapshot: null,
    joysticks: {
      chassis: { pointerId: null, x: 0, y: 0 },
      gimbal: { pointerId: null, x: 0, y: 0 },
    },
  },
  perception: {
    snapshot: null,
    timer: null,
  },
};

const encoder = new TextEncoder();
const decoder = new TextDecoder();
const DOUBLE_CRLF_BYTES = encoder.encode('\r\n\r\n');

const el = {
  rescanButton: document.getElementById('rescanButton'),
  mockButton: document.getElementById('mockButton'),
  mediaButton: document.getElementById('mediaButton'),
  fullscreenButton: document.getElementById('fullscreenButton'),
  qualityRow: document.getElementById('qualityRow'),
  sourceList: document.getElementById('sourceList'),
  videoSummary: document.getElementById('videoSummary'),
  sourceHint: document.getElementById('sourceHint'),
  emptyCopy: document.getElementById('emptyCopy'),
  videoCanvas: document.getElementById('videoCanvas'),
  videoFrame: document.getElementById('videoFrame'),
  detectionLayer: document.getElementById('detectionLayer'),
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
  estopButton: document.getElementById('estopButton'),
  releaseEstopButton: document.getElementById('releaseEstopButton'),
  modeSwitcher: document.getElementById('modeSwitcher'),
  modeNotice: document.getElementById('modeNotice'),
  cmdVelSelect: document.getElementById('cmdVelSelect'),
  gimbalYawSelect: document.getElementById('gimbalYawSelect'),
  gimbalPitchSelect: document.getElementById('gimbalPitchSelect'),
  chassisPad: document.getElementById('chassisPad'),
  gimbalPad: document.getElementById('gimbalPad'),
  chassisKnob: document.getElementById('chassisKnob'),
  gimbalKnob: document.getElementById('gimbalKnob'),
  chassisReadout: document.getElementById('chassisReadout'),
  gimbalReadout: document.getElementById('gimbalReadout'),
  controlLinkValue: document.getElementById('controlLinkValue'),
  estopValue: document.getElementById('estopValue'),
  controlModeValue: document.getElementById('controlModeValue'),
  velocityValue: document.getElementById('velocityValue'),
  gimbalCommandValue: document.getElementById('gimbalCommandValue'),
  commandAgeValue: document.getElementById('commandAgeValue'),
  cmdVelTopicValue: document.getElementById('cmdVelTopicValue'),
  gimbalTopicValue: document.getElementById('gimbalTopicValue'),
  rosPublishValue: document.getElementById('rosPublishValue'),
  bridgeModeValue: document.getElementById('bridgeModeValue'),
  togglePerceptionButton: document.getElementById('togglePerceptionButton'),
  unlockTargetButton: document.getElementById('unlockTargetButton'),
  enableFollowButton: document.getElementById('enableFollowButton'),
  disableFollowButton: document.getElementById('disableFollowButton'),
  perceptionEnabledValue: document.getElementById('perceptionEnabledValue'),
  perceptionProviderValue: document.getElementById('perceptionProviderValue'),
  perceptionFpsValue: document.getElementById('perceptionFpsValue'),
  perceptionCountValue: document.getElementById('perceptionCountValue'),
  lockStatusValue: document.getElementById('lockStatusValue'),
  lockTargetValue: document.getElementById('lockTargetValue'),
  followStatusValue: document.getElementById('followStatusValue'),
  followWarningValue: document.getElementById('followWarningValue'),
  robotBatteryValue: document.getElementById('robotBatteryValue'),
  robotVelocityValue: document.getElementById('robotVelocityValue'),
  robotGimbalYawValue: document.getElementById('robotGimbalYawValue'),
  robotGimbalPitchValue: document.getElementById('robotGimbalPitchValue'),
  robotImuValue: document.getElementById('robotImuValue'),
  robotConnectionValue: document.getElementById('robotConnectionValue'),
  robotUptimeValue: document.getElementById('robotUptimeValue'),
  robotErrorValue: document.getElementById('robotErrorValue'),
  robotFirmwareValue: document.getElementById('robotFirmwareValue'),
  robotLastUpdateValue: document.getElementById('robotLastUpdateValue'),
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
  const controlIssues = state.control.snapshot?.issues || [];
  const perceptionIssues = state.perception.snapshot?.issues || [];
  const items = [
    ...(state.discovery?.robot?.issues || []),
    ...controlIssues,
    ...perceptionIssues,
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
    ? `当前来源：${source.label}。${source.type === 'mock-mjpeg' ? '这是本地模拟视频，用于 Phase 1 和 Phase 2 烟雾测试。' : '这是自动发现到的预览来源。'}`
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

function renderControlModes() {
  const modes = state.config?.controlModes || [];
  el.modeSwitcher.innerHTML = '';

  for (const mode of modes) {
    const button = document.createElement('button');
    button.className = 'mode-chip';
    button.dataset.mode = mode.id;
    button.textContent = mode.label;
    button.title = mode.description;
    button.addEventListener('click', () => {
      // 模式切换前先发送零速度，确保安全
      stopAllControls('模式切换，前端请求安全归零');
      sendControlMessage({
        type: 'set_mode',
        mode: mode.id,
      });
    });
    el.modeSwitcher.appendChild(button);
  }
}

function renderTopicSelectOptions(select, candidates, selectedValue, placeholder) {
  if (!select) {
    return;
  }
  const items = [{ value: '', label: placeholder }, ...candidates.map((topic) => ({ value: topic.name, label: topic.name }))];
  select.innerHTML = '';
  for (const item of items) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    option.selected = item.value === (selectedValue || '');
    select.appendChild(option);
  }
}

function renderTopicSelectors(snapshot) {
  const gimbalCandidates = snapshot?.candidateTopics?.gimbal || [];
  renderTopicSelectOptions(el.cmdVelSelect, snapshot?.candidateTopics?.cmdVel || [], snapshot?.selectedTopics?.cmdVel || '', '自动选择 / 不发布');
  renderTopicSelectOptions(el.gimbalYawSelect, gimbalCandidates, snapshot?.selectedTopics?.gimbalYaw || '', '自动选择 / 不单独发布');
  renderTopicSelectOptions(el.gimbalPitchSelect, gimbalCandidates, snapshot?.selectedTopics?.gimbalPitch || '', '自动选择 / 不单独发布');
}

function captureCurrentFrame() {
  try {
    return el.videoCanvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

async function postJson(url, payload = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.message || body.error || `请求失败：${response.status}`);
  }
  return body;
}

function renderDetectionLayer(snapshot) {
  el.detectionLayer.innerHTML = '';
  const detections = snapshot?.detections || [];
  for (const detection of detections) {
    const node = document.createElement('button');
    const isPerson = detection.className.toLowerCase() === 'person';
    const isLocked = snapshot?.lock?.targetId === detection.targetId;
    node.type = 'button';
    node.className = `detection-box${isPerson ? ' is-person' : ''}${isLocked ? ' is-locked' : ''}`;
    node.style.left = `${detection.bbox.x * 100}%`;
    node.style.top = `${detection.bbox.y * 100}%`;
    node.style.width = `${detection.bbox.width * 100}%`;
    node.style.height = `${detection.bbox.height * 100}%`;
    node.innerHTML = `<span>${detection.className} ${(detection.score * 100).toFixed(0)}%</span>`;
    node.title = isPerson ? '点击锁定人物目标' : 'Phase 4 只允许锁定人物目标';
    node.addEventListener('click', async () => {
      if (!isPerson) {
        el.followWarningValue.textContent = 'Phase 4 只允许锁定人物目标';
        return;
      }
      try {
        const result = await postJson('/api/target/lock', {
          targetId: detection.targetId,
          snapshotDataUrl: captureCurrentFrame(),
        });
        updatePerceptionSnapshot(result.perception);
      } catch (error) {
        el.followWarningValue.textContent = error instanceof Error ? error.message : String(error);
      }
    });
    el.detectionLayer.appendChild(node);
  }
}

function updatePerceptionSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }
  state.perception.snapshot = snapshot;
  el.perceptionEnabledValue.textContent = snapshot.enabled ? '已启用' : '未启用';
  el.perceptionProviderValue.textContent = snapshot.providerMode || snapshot.provider || 'mock';
  el.perceptionFpsValue.textContent = Number(snapshot.inferenceFps || 0).toFixed(1);
  el.perceptionCountValue.textContent = String(snapshot.detectionCount || 0);
  el.lockStatusValue.textContent = snapshot.lock?.message || '未锁定';
  el.lockTargetValue.textContent = snapshot.lock?.active ? `${snapshot.lock.className} / ${snapshot.lock.trackId || snapshot.lock.targetId}` : '-';
  el.followStatusValue.textContent = snapshot.follow?.enabled ? (snapshot.follow.status || 'tracking') : '未启用';
  el.followWarningValue.textContent = snapshot.follow?.warning || '-';
  el.togglePerceptionButton.textContent = snapshot.enabled ? '关闭感知' : '启用感知';
  el.unlockTargetButton.disabled = !snapshot.lock?.active;
  el.enableFollowButton.disabled = !snapshot.lock?.active || snapshot.follow?.enabled !== false;
  el.disableFollowButton.disabled = !snapshot.follow?.enabled;
  renderDetectionLayer(snapshot);
}

function updateControlModeButtons() {
  for (const button of document.querySelectorAll('.mode-chip')) {
    button.classList.toggle('is-active', button.dataset.mode === state.control.mode);
  }
}

function updateJoystickVisual(name, x, y) {
  const pad = name === 'chassis' ? el.chassisPad : el.gimbalPad;
  const knob = name === 'chassis' ? el.chassisKnob : el.gimbalKnob;
  const readout = name === 'chassis' ? el.chassisReadout : el.gimbalReadout;
  const radius = pad.clientWidth / 2;
  const maxOffset = radius - knob.clientWidth / 2 - 10;
  const offsetX = x * maxOffset;
  const offsetY = y * maxOffset;
  knob.style.transform = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px))`;
  readout.textContent = `X ${x.toFixed(2)} / Y ${y.toFixed(2)}`;
}

function updateControlSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }

  state.control.snapshot = snapshot;
  state.control.mode = snapshot.mode;
  state.control.emergencyStop = snapshot.emergencyStop;

  el.controlLinkValue.textContent = state.control.socketState;
  el.estopValue.textContent = snapshot.emergencyStop ? '已触发' : '未触发';
  el.controlModeValue.textContent = (state.config?.controlModes || []).find((mode) => mode.id === snapshot.mode)?.label || snapshot.mode;
  el.modeNotice.textContent = snapshot.modeNotice || '模式切换后会立即清零，避免残留速度继续输出。';
  el.velocityValue.textContent = `${snapshot.velocityCommand.linearX.toFixed(2)} / ${snapshot.velocityCommand.angularZ.toFixed(2)}`;
  el.gimbalCommandValue.textContent = `${snapshot.gimbalCommand.yawRate.toFixed(1)} / ${snapshot.gimbalCommand.pitchRate.toFixed(1)}`;
  el.cmdVelTopicValue.textContent = snapshot.selectedTopics.cmdVel || '未发现';
  el.gimbalTopicValue.textContent =
    snapshot.selectedTopics.gimbalCombined || snapshot.selectedTopics.gimbalYaw || snapshot.selectedTopics.gimbalPitch || '未发现';
  el.rosPublishValue.textContent = snapshot.rosPublishActive ? '已启用' : '未启用';
  el.rosPublishValue.style.color = snapshot.rosPublishActive ? 'var(--good)' : 'var(--muted)';
  el.bridgeModeValue.textContent = snapshot.bridgeMode || 'state-only';
  el.releaseEstopButton.disabled = !snapshot.emergencyStop;

  if (snapshot.commandAgeMs == null) {
    el.commandAgeValue.textContent = '-';
  } else {
    el.commandAgeValue.textContent = `${snapshot.commandAgeMs} ms`;
  }

  renderTopicSelectors(snapshot);
  updateControlModeButtons();
  renderIssues();
}

function scheduleCommandAgeTicker() {
  if (state.control.commandAgeTimer) {
    clearInterval(state.control.commandAgeTimer);
  }
  state.control.commandAgeTimer = setInterval(() => {
    const snapshot = state.control.snapshot;
    if (!snapshot?.lastCommandAt) {
      el.commandAgeValue.textContent = '-';
      return;
    }
    const ageMs = Date.now() - snapshot.lastCommandAt;
    el.commandAgeValue.textContent = `${ageMs} ms`;
  }, 200);
}

function getControlSocketUrl() {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${location.host}/ws/control`;
}

function clearControlHeartbeat() {
  if (state.control.heartbeatTimer) {
    clearInterval(state.control.heartbeatTimer);
    state.control.heartbeatTimer = null;
  }
}

function sendControlMessage(payload) {
  const socket = state.control.socket;
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return;
  }
  socket.send(JSON.stringify(payload));
}

function connectControlSocket() {
  if (state.control.socket && (state.control.socket.readyState === WebSocket.OPEN || state.control.socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const socket = new WebSocket(getControlSocketUrl());
  state.control.socket = socket;
  state.control.socketState = '连接中';
  el.controlLinkValue.textContent = state.control.socketState;

  socket.addEventListener('open', () => {
    state.control.socketState = '已连接';
    el.controlLinkValue.textContent = state.control.socketState;
    sendControlMessage({ type: 'hello' });
    clearControlHeartbeat();
    state.control.heartbeatTimer = setInterval(() => {
      sendControlMessage({ type: 'heartbeat' });
    }, 400);
  });

  socket.addEventListener('message', (event) => {
    try {
      const parsed = JSON.parse(event.data);
      if (parsed.type === 'control_state') {
        updateControlSnapshot(parsed.payload);
      }
    } catch {
      // Ignore invalid socket payloads from the backend.
    }
  });

  socket.addEventListener('close', () => {
    state.control.socketState = '已断开';
    el.controlLinkValue.textContent = state.control.socketState;
    clearControlHeartbeat();
    // WebSocket 断开时归零摇杆状态，确保安全
    stopAllControls('控制链路断开，前端请求安全归零');
    window.setTimeout(connectControlSocket, 800);
  });

  socket.addEventListener('error', () => {
    state.control.socketState = '连接异常';
    el.controlLinkValue.textContent = state.control.socketState;
  });
}

function stopAllControls(reason) {
  for (const name of ['chassis', 'gimbal']) {
    state.control.joysticks[name].x = 0;
    state.control.joysticks[name].y = 0;
    updateJoystickVisual(name, 0, 0);
    sendControlMessage({
      type: 'joystick',
      channel: name,
      x: 0,
      y: 0,
      sequence: ++state.control.sequence,
    });
  }
  sendControlMessage({
    type: 'stop',
    reason,
  });
}

function normalizePointer(pad, clientX, clientY) {
  const rect = pad.getBoundingClientRect();
  const radius = rect.width / 2;
  const localX = clientX - rect.left - radius;
  const localY = clientY - rect.top - radius;
  const normalizedX = localX / radius;
  const normalizedY = localY / radius;
  const distance = Math.hypot(normalizedX, normalizedY);

  if (distance > 1) {
    return {
      x: normalizedX / distance,
      y: normalizedY / distance,
    };
  }

  return {
    x: normalizedX,
    y: normalizedY,
  };
}

function bindJoystick(name, pad) {
  pad.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    pad.setPointerCapture(event.pointerId);
    state.control.joysticks[name].pointerId = event.pointerId;
    const position = normalizePointer(pad, event.clientX, event.clientY);
    state.control.joysticks[name].x = position.x;
    state.control.joysticks[name].y = position.y;
    updateJoystickVisual(name, position.x, position.y);
    sendControlMessage({
      type: 'joystick',
      channel: name,
      x: position.x,
      y: position.y,
      sequence: ++state.control.sequence,
    });
  });

  pad.addEventListener('pointermove', (event) => {
    if (state.control.joysticks[name].pointerId !== event.pointerId) {
      return;
    }
    const position = normalizePointer(pad, event.clientX, event.clientY);
    state.control.joysticks[name].x = position.x;
    state.control.joysticks[name].y = position.y;
    updateJoystickVisual(name, position.x, position.y);
    sendControlMessage({
      type: 'joystick',
      channel: name,
      x: position.x,
      y: position.y,
      sequence: ++state.control.sequence,
    });
  });

  function resetJoystick(pointerId) {
    if (state.control.joysticks[name].pointerId !== pointerId) {
      return;
    }
    state.control.joysticks[name].pointerId = null;
    state.control.joysticks[name].x = 0;
    state.control.joysticks[name].y = 0;
    updateJoystickVisual(name, 0, 0);
    sendControlMessage({
      type: 'joystick',
      channel: name,
      x: 0,
      y: 0,
      sequence: ++state.control.sequence,
    });
  }

  pad.addEventListener('pointerup', (event) => {
    resetJoystick(event.pointerId);
  });

  pad.addEventListener('pointercancel', (event) => {
    resetJoystick(event.pointerId);
  });
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

async function fetchControlState() {
  const response = await fetch('/api/control/state', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`控制状态加载失败：${response.status}`);
  }
  updateControlSnapshot(await response.json());
}

async function updateControlTopics() {
  const response = await fetch('/api/control/topics', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cmdVel: el.cmdVelSelect.value,
      gimbalYaw: el.gimbalYawSelect.value,
      gimbalPitch: el.gimbalPitchSelect.value,
      gimbalCombined: state.control.snapshot?.selectedTopics?.gimbalCombined || '',
    }),
  });
  if (!response.ok) {
    throw new Error(`控制 Topic 更新失败：${response.status}`);
  }
  updateControlSnapshot(await response.json());
}

async function fetchPerceptionState() {
  const response = await fetch('/api/perception/state', { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`感知状态加载失败：${response.status}`);
  }
  updatePerceptionSnapshot(await response.json());
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
  await fetchControlState();
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

  el.mediaButton.addEventListener('click', () => {
    window.open('/media', '_blank');
  });

  el.fullscreenButton.addEventListener('click', async () => {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
      return;
    }
    await el.videoFrame.requestFullscreen();
  });

  el.estopButton.addEventListener('click', () => {
    sendControlMessage({
      type: 'estop',
      reason: '前端急停按钮触发',
    });
  });

  el.releaseEstopButton.addEventListener('click', () => {
    sendControlMessage({
      type: 'release_estop',
    });
  });

  el.togglePerceptionButton.addEventListener('click', async () => {
    try {
      const snapshot = state.perception.snapshot;
      const result = await postJson('/api/perception/toggle', {
        enabled: !snapshot?.enabled,
      });
      updatePerceptionSnapshot(result);
    } catch (error) {
      el.followWarningValue.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  el.unlockTargetButton.addEventListener('click', async () => {
    try {
      updatePerceptionSnapshot(await postJson('/api/target/unlock'));
    } catch (error) {
      el.followWarningValue.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  el.enableFollowButton.addEventListener('click', async () => {
    try {
      const result = await postJson('/api/follow/enable');
      updatePerceptionSnapshot(result.perception);
    } catch (error) {
      el.followWarningValue.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  el.disableFollowButton.addEventListener('click', async () => {
    try {
      updatePerceptionSnapshot(await postJson('/api/follow/disable'));
    } catch (error) {
      el.followWarningValue.textContent = error instanceof Error ? error.message : String(error);
    }
  });

  for (const select of [el.cmdVelSelect, el.gimbalYawSelect, el.gimbalPitchSelect]) {
    select.addEventListener('change', async () => {
      try {
        await updateControlTopics();
      } catch (error) {
        el.modeNotice.textContent = error instanceof Error ? error.message : String(error);
      }
    });
  }

  bindJoystick('chassis', el.chassisPad);
  bindJoystick('gimbal', el.gimbalPad);

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      stopAllControls('页面失焦，前端请求安全归零');
    } else if (state.connectionState.includes('卡顿')) {
      connectToCurrentSource();
    }
  });

  window.addEventListener('blur', () => {
    stopAllControls('窗口失焦，前端请求安全归零');
  });

  window.addEventListener('beforeunload', () => {
    stopAllControls('页面关闭，前端请求安全归零');
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

function startPerceptionPolling() {
  if (state.perception.timer) {
    clearInterval(state.perception.timer);
  }
  state.perception.timer = setInterval(() => {
    fetchPerceptionState().catch(() => {
      // Keep preview and teleop usable during perception polling failure.
    });
  }, 350);
}

async function fetchRobotInfo() {
  try {
    const response = await fetch('/api/robot/info', { cache: 'no-store' });
    if (!response.ok) return;
    const info = await response.json();
    el.robotBatteryValue.textContent = info.battery ?? '-';
    el.robotVelocityValue.textContent = info.velocity ?? '-';
    el.robotGimbalYawValue.textContent = info.gimbalYaw ?? '-';
    el.robotGimbalPitchValue.textContent = info.gimbalPitch ?? '-';
    el.robotImuValue.textContent = info.imuStatus ?? '-';
    el.robotConnectionValue.textContent = info.connectionQuality ?? '-';
    el.robotUptimeValue.textContent = info.uptime ?? '-';
    el.robotErrorValue.textContent = info.errorCode ?? '-';
    el.robotFirmwareValue.textContent = info.firmwareVersion ?? '-';
    el.robotLastUpdateValue.textContent = info.lastUpdateAt ? new Date(info.lastUpdateAt).toLocaleTimeString('zh-CN') : '-';
  } catch {
    // 静默失败，不影响其他功能
  }
}

function startRobotInfoPolling() {
  setInterval(() => {
    fetchRobotInfo().catch(() => {
      // 静默失败
    });
  }, 2000);
}

async function bootstrap() {
  bindEvents();
  drawDisconnectedOverlay('等待自动发现', '系统正在读取 ROS2、视频源和控制状态。');
  updateStats();
  updateJoystickVisual('chassis', 0, 0);
  updateJoystickVisual('gimbal', 0, 0);

  try {
    await loadConfig();
    await fetchControlState();
    await fetchPerceptionState();
  } catch (error) {
    drawDisconnectedOverlay('配置加载失败', error instanceof Error ? error.message : String(error));
    el.emptyCopy.textContent = '无法读取后端配置。';
    return;
  }

  renderQualityProfiles();
  renderSources();
  renderControlModes();
  renderIssues();
  updateStats();
  updateControlModeButtons();
  connectControlSocket();
  scheduleCommandAgeTicker();
  startWatchdog();
  startPerceptionPolling();
  startRobotInfoPolling();

  if (state.activeSource) {
    connectToCurrentSource();
  } else {
    el.emptyState.style.display = 'flex';
    el.emptyCopy.textContent = '当前没有自动发现到可连接的视频源。';
  }
}

bootstrap();
