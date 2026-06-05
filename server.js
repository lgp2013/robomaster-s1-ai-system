const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');

const ROOT = __dirname;
const WEB_ROOT = path.join(ROOT, 'web');
const RUNTIME_ROOT = path.join(ROOT, 'runtime');
const DISCOVERY_PATH = path.join(RUNTIME_ROOT, 'robot_discovery.json');
const APP_CONFIG_PATH = path.join(RUNTIME_ROOT, 'app_config.json');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const MOCK_STREAM_URL = '/api/mock-stream';
const CONTROL_WS_PATH = '/ws/control';
const CONTROL_HEARTBEAT_TIMEOUT_MS = 1200;
const CONTROL_SAFETY_POLL_MS = 200;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
};

const controlClients = new Set();

const controlState = {
  wsConnected: false,
  mode: 'chassis',
  emergencyStop: false,
  backendState: '未连接',
  lastReason: '等待控制连接',
  lastInputAt: 0,
  lastCommandAt: 0,
  sequence: 0,
  chassisAxis: { x: 0, y: 0 },
  gimbalAxis: { x: 0, y: 0 },
  velocityCommand: { linearX: 0, angularZ: 0 },
  gimbalCommand: { yawRate: 0, pitchRate: 0 },
  selectedTopics: {
    cmdVel: '',
    gimbalYaw: '',
    gimbalPitch: '',
    gimbalCombined: '',
  },
  candidateTopics: {
    cmdVel: [],
    gimbal: [],
  },
  issues: [],
  rosPublishActive: false,
  bridgeMode: 'state-only',
};

function ensureRuntimeDir() {
  fs.mkdirSync(RUNTIME_ROOT, { recursive: true });
}

function loadAppConfig() {
  ensureRuntimeDir();
  const fallbackConfig = {
    video: {
      defaultStreamUrl: '',
    },
  };

  if (!fs.existsSync(APP_CONFIG_PATH)) {
    return fallbackConfig;
  }

  try {
    const parsed = JSON.parse(fs.readFileSync(APP_CONFIG_PATH, 'utf8'));
    return {
      ...fallbackConfig,
      ...parsed,
      video: {
        ...fallbackConfig.video,
        ...(parsed.video || {}),
      },
    };
  } catch {
    return fallbackConfig;
  }
}

function tryExec(command, args) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return '';
  }
}

function detectEnvironment() {
  const platform = os.platform();
  const envRosDistro = process.env.ROS_DISTRO || '';
  const ros2Path = tryExec(platform === 'win32' ? 'where.exe' : 'which', [platform === 'win32' ? 'ros2' : 'ros2']);
  const ros2Version = ros2Path ? tryExec('ros2', ['--version']) : '';
  const pythonVersion = tryExec(platform === 'win32' ? 'py' : 'python3', platform === 'win32' ? ['-3', '--version'] : ['--version']);

  return {
    os: platform === 'win32' ? `Windows ${os.release()}` : `${platform} ${os.release()}`,
    nodeVersion: process.version,
    pythonVersion: pythonVersion || 'unknown',
    rosDistro: envRosDistro || 'not-detected',
    ros2Available: Boolean(ros2Path),
    ros2Path: ros2Path || '',
    ros2Version: ros2Version || '',
    targetEnvironment: 'Ubuntu 20.04 + ROS2 Foxy',
    currentEnvironmentMatchesTarget: platform !== 'win32' && envRosDistro.toLowerCase() === 'foxy' && Boolean(ros2Path),
  };
}

function parseRosTopicList(raw) {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const match = line.match(/^(\S+)\s+\[(.+)\]$/);
      if (!match) {
        return null;
      }
      return {
        name: match[1],
        type: match[2],
      };
    })
    .filter(Boolean);
}

function pickPreferredTopic(candidates) {
  if (!candidates.length) {
    return '';
  }
  const exact = candidates.find((entry) => entry.name === '/cmd_vel' || entry.name === '/camera/image_color');
  return (exact || candidates[0]).name;
}

function refreshControlTopicSelection(controlTopics) {
  const cmdVelCandidates = controlTopics.filter((topic) => topic.role === 'cmd_vel');
  const gimbalCandidates = controlTopics.filter((topic) => topic.role === 'gimbal');

  controlState.candidateTopics = {
    cmdVel: cmdVelCandidates,
    gimbal: gimbalCandidates,
  };

  controlState.selectedTopics = {
    cmdVel: pickPreferredTopic(cmdVelCandidates),
    gimbalYaw: gimbalCandidates.find((topic) => topic.name.includes('yaw'))?.name || '',
    gimbalPitch: gimbalCandidates.find((topic) => topic.name.includes('pitch'))?.name || '',
    gimbalCombined: gimbalCandidates.find((topic) => topic.name.includes('gimbal'))?.name || '',
  };

  // 自动启用 ROS 发布：当发现 cmd_vel 且环境匹配时
  const canPublish = Boolean(
    controlState.selectedTopics.cmdVel &&
    detectEnvironment().currentEnvironmentMatchesTarget
  );
  controlState.rosPublishActive = canPublish;
  controlState.bridgeMode = canPublish
    ? 'ros-publish-active'
    : controlState.selectedTopics.cmdVel
      ? 'topic-detected-awaiting-bridge'
      : 'state-only';

  const issues = [];
  if (!controlState.selectedTopics.cmdVel) {
    issues.push('未发现可直接使用的 cmd_vel Topic，当前仅验证控制链路与安全归零。');
  } else if (!canPublish) {
    issues.push('已发现 cmd_vel Topic，但当前环境不是 Ubuntu + ROS2 Foxy，ROS 发布已禁用。请在目标环境启动 ros2_bridge.py。');
  } else {
    issues.push('已发现 cmd_vel Topic 且环境匹配，ROS 发布已自动启用。请确保 ros2_bridge.py 正在运行。');
  }
  if (!gimbalCandidates.length) {
    issues.push('未发现云台控制 Topic，当前仅记录云台摇杆输入。');
  }
  controlState.issues = issues;
}

function discoverRobot() {
  const appConfig = loadAppConfig();
  const configuredStreamUrl = appConfig.video.defaultStreamUrl || process.env.ROBOMASTER_STREAM_URL || '';
  const environment = detectEnvironment();
  const issues = [];
  const cameraTopics = [];
  const controlTopics = [];
  const services = [];

  if (!environment.ros2Available) {
    issues.push('当前环境未检测到 ROS2 命令，无法执行真实机器人自动发现。');
  }

  if (environment.os.startsWith('Windows')) {
    issues.push('当前工作区运行在 Windows 上，目标联调环境应为 Ubuntu 20.04 + ROS2 Foxy。');
  }

  if (environment.ros2Available) {
    const topicListRaw = tryExec('ros2', ['topic', 'list', '-t']);
    const topics = parseRosTopicList(topicListRaw);

    for (const topic of topics) {
      const lowerName = topic.name.toLowerCase();
      const lowerType = topic.type.toLowerCase();

      if (
        lowerType.includes('sensor_msgs/msg/image') ||
        lowerType.includes('sensor_msgs/msg/compressedimage') ||
        lowerName.includes('camera') ||
        lowerName.includes('image')
      ) {
        cameraTopics.push({
          name: topic.name,
          type: topic.type,
          role: 'camera',
        });
      }

      if (lowerType.includes('geometry_msgs/msg/twist') || lowerName.includes('cmd_vel')) {
        controlTopics.push({
          name: topic.name,
          type: topic.type,
          role: 'cmd_vel',
        });
      } else if (lowerName.includes('gimbal') || lowerName.includes('yaw') || lowerName.includes('pitch')) {
        controlTopics.push({
          name: topic.name,
          type: topic.type,
          role: 'gimbal',
        });
      }
    }
  }

  refreshControlTopicSelection(controlTopics);

  const videoSources = [];
  if (configuredStreamUrl) {
    videoSources.push({
      id: 'configured-stream',
      label: 'web_video_server 默认视频源',
      type: 'remote-mjpeg',
      url: `/api/stream-proxy?url=${encodeURIComponent(configuredStreamUrl)}`,
      upstreamUrl: configuredStreamUrl,
      resolutionHint: '1920 x 1080',
      status: 'configured',
      isDefault: true,
    });
  }

  videoSources.push({
    id: 'mock-stream',
    label: '本地模拟视频',
    type: 'mock-mjpeg',
    url: MOCK_STREAM_URL,
    upstreamUrl: '',
    resolutionHint: '1280 x 720',
    status: 'ready',
    isDefault: !configuredStreamUrl,
  });

  const discovery = {
    generatedAt: new Date().toISOString(),
    environment,
    robot: {
      rosConnected: environment.ros2Available,
      discoveryMode: environment.ros2Available ? 'ros2-scan' : 'degraded-mock-only',
      cameraTopics,
      controlTopics,
      services,
      issues,
    },
    videoSources,
    troubleshooting: [
      '如需真实联调，请在 Ubuntu 20.04 + ROS2 Foxy 环境中启动后端。',
      '如需真实视频源，请先确认摄像头 Topic 已发布，再执行重新扫描。',
      '当前 Windows 工作区仅提供本地模拟视频和配置文件中的 MJPEG 视频源。',
    ],
  };

  ensureRuntimeDir();
  fs.writeFileSync(DISCOVERY_PATH, JSON.stringify(discovery, null, 2));
  broadcastControlState();
  return discovery;
}

function loadDiscovery() {
  ensureRuntimeDir();
  if (fs.existsSync(DISCOVERY_PATH)) {
    try {
      return JSON.parse(fs.readFileSync(DISCOVERY_PATH, 'utf8'));
    } catch {
      return discoverRobot();
    }
  }
  return discoverRobot();
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(payload, null, 2));
}

function sendText(res, statusCode, text, contentType = 'text/plain; charset=utf-8') {
  res.writeHead(statusCode, {
    'Content-Type': contentType,
    'Cache-Control': 'no-store',
  });
  res.end(text);
}

function getMimeType(filePath) {
  return MIME_TYPES[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function serveStaticFile(res, filePath) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    return false;
  }

  res.writeHead(200, {
    'Content-Type': getMimeType(filePath),
    'Cache-Control': 'no-store',
  });
  fs.createReadStream(filePath).pipe(res);
  return true;
}

function sanitizeTargetUrl(rawValue) {
  if (!rawValue) {
    return null;
  }

  try {
    const parsed = new URL(rawValue);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function round(value, digits = 3) {
  return Number(value.toFixed(digits));
}

function clampAxis(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Math.max(-1, Math.min(1, value));
}

function getControlModeDefinition() {
  return [
    {
      id: 'chassis',
      label: '底盘模式',
      description: '左摇杆控制底盘，右摇杆仅做观察输入。',
    },
    {
      id: 'gimbal',
      label: '云台模式',
      description: '右摇杆控制云台，底盘保持静止。',
    },
    {
      id: 'follow-gimbal',
      label: '联动模式',
      description: '云台偏转时带动底盘低速联动，便于对准目标。',
    },
  ];
}

function computeCommands() {
  const mode = controlState.mode;
  const chassis = controlState.chassisAxis;
  const gimbal = controlState.gimbalAxis;

  let linearX = 0;
  let angularZ = 0;
  let yawRate = 0;
  let pitchRate = 0;

  if (mode === 'chassis' || mode === 'follow-gimbal') {
    linearX = round(-chassis.y * 0.8);
    angularZ = round(chassis.x * 1.4);
  }

  if (mode === 'gimbal' || mode === 'follow-gimbal') {
    yawRate = round(gimbal.x * 90, 1);
    pitchRate = round(-gimbal.y * 60, 1);
  }

  if (mode === 'follow-gimbal') {
    angularZ = round(angularZ + gimbal.x * 0.6);
  }

  controlState.velocityCommand = { linearX, angularZ };
  controlState.gimbalCommand = { yawRate, pitchRate };

  // 写入命令文件供 ROS2 桥接节点读取
  writeControlCommands();
}

const COMMAND_PATH = path.join(RUNTIME_ROOT, 'control_commands.json');

function writeControlCommands() {
  try {
    const payload = {
      generatedAt: new Date().toISOString(),
      linearX: controlState.velocityCommand.linearX,
      angularZ: controlState.velocityCommand.angularZ,
      yawRate: controlState.gimbalCommand.yawRate,
      pitchRate: controlState.gimbalCommand.pitchRate,
      emergencyStop: controlState.emergencyStop,
      rosPublishActive: controlState.rosPublishActive,
      commandAgeMs: controlState.lastCommandAt ? Date.now() - controlState.lastCommandAt : null,
      mode: controlState.mode,
      backendState: controlState.backendState,
    };
    fs.writeFileSync(COMMAND_PATH, JSON.stringify(payload, null, 2));
  } catch (err) {
    // 静默失败，不影响主链路
  }
}

function setBackendState(stateLabel, reason) {
  controlState.backendState = stateLabel;
  controlState.lastReason = reason;
}

function zeroControl(reason) {
  controlState.chassisAxis = { x: 0, y: 0 };
  controlState.gimbalAxis = { x: 0, y: 0 };
  computeCommands();
  controlState.lastCommandAt = Date.now();
  setBackendState(controlState.emergencyStop ? '急停锁定' : '安全归零', reason);
}

function getControlSnapshot() {
  const discovery = loadDiscovery();
  return {
    generatedAt: new Date().toISOString(),
    wsConnected: controlState.wsConnected,
    mode: controlState.mode,
    modes: getControlModeDefinition(),
    emergencyStop: controlState.emergencyStop,
    backendState: controlState.backendState,
    lastReason: controlState.lastReason,
    lastInputAt: controlState.lastInputAt,
    lastCommandAt: controlState.lastCommandAt,
    commandAgeMs: controlState.lastCommandAt ? Date.now() - controlState.lastCommandAt : null,
    velocityCommand: controlState.velocityCommand,
    gimbalCommand: controlState.gimbalCommand,
    chassisAxis: controlState.chassisAxis,
    gimbalAxis: controlState.gimbalAxis,
    selectedTopics: controlState.selectedTopics,
    candidateTopics: controlState.candidateTopics,
    rosConnected: discovery.robot.rosConnected,
    rosPublishActive: controlState.rosPublishActive,
    bridgeMode: controlState.bridgeMode,
    issues: [
      ...controlState.issues,
      ...(discovery.robot.rosConnected ? [] : ['当前环境未连接 ROS2，控制指令仅在后端状态机中验证。']),
    ],
  };
}

function websocketFrame(text) {
  const payload = Buffer.from(text);
  const length = payload.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

function sendControlMessage(socket, payload) {
  if (socket.destroyed || !socket.writable) {
    return;
  }
  socket.write(websocketFrame(JSON.stringify(payload)));
}

function broadcastControlState() {
  const snapshot = {
    type: 'control_state',
    payload: getControlSnapshot(),
  };

  for (const client of controlClients) {
    sendControlMessage(client.socket, snapshot);
  }
}

function acknowledge(socket, action, ok = true, message = '') {
  sendControlMessage(socket, {
    type: 'control_ack',
    payload: {
      ok,
      action,
      message,
      at: new Date().toISOString(),
    },
  });
}

function applyJoystickMessage(payload) {
  const channel = payload.channel === 'gimbal' ? 'gimbal' : 'chassis';
  const x = clampAxis(Number(payload.x));
  const y = clampAxis(Number(payload.y));

  controlState.lastInputAt = Date.now();
  controlState.lastCommandAt = controlState.lastInputAt;
  controlState.sequence = Number(payload.sequence) || controlState.sequence + 1;

  if (controlState.emergencyStop) {
    setBackendState('急停锁定', '急停未解除，忽略摇杆输入');
    return;
  }

  if (channel === 'chassis') {
    controlState.chassisAxis = { x, y };
  } else {
    controlState.gimbalAxis = { x, y };
  }

  computeCommands();
  setBackendState('控制中', channel === 'chassis' ? '底盘摇杆输入已更新' : '云台摇杆输入已更新');
}

function handleControlMessage(client, message) {
  const { socket } = client;
  let parsed;

  try {
    parsed = JSON.parse(message);
  } catch {
    acknowledge(socket, 'parse', false, '控制消息不是合法 JSON');
    return;
  }

  const type = parsed.type || '';

  if (type === 'hello') {
    controlState.wsConnected = true;
    setBackendState('已连接', '控制链路已建立');
    acknowledge(socket, 'hello', true, '控制链路已建立');
    broadcastControlState();
    return;
  }

  if (type === 'heartbeat') {
    controlState.lastInputAt = Date.now();
    if (!controlState.emergencyStop && controlState.backendState === '未连接') {
      setBackendState('待命', '已收到前端心跳');
    }
    acknowledge(socket, 'heartbeat', true, '心跳已更新');
    broadcastControlState();
    return;
  }

  if (type === 'set_mode') {
    const allowed = new Set(getControlModeDefinition().map((entry) => entry.id));
    if (!allowed.has(parsed.mode)) {
      acknowledge(socket, 'set_mode', false, '未知控制模式');
      return;
    }
    controlState.mode = parsed.mode;
    controlState.lastInputAt = Date.now();
    computeCommands();
    controlState.lastCommandAt = Date.now();
    setBackendState('模式切换', `当前模式：${parsed.mode}`);
    acknowledge(socket, 'set_mode', true, '控制模式已切换');
    broadcastControlState();
    return;
  }

  if (type === 'joystick') {
    applyJoystickMessage(parsed);
    acknowledge(socket, 'joystick', true, '摇杆输入已接收');
    broadcastControlState();
    return;
  }

  if (type === 'stop') {
    controlState.lastInputAt = Date.now();
    zeroControl(parsed.reason || '前端请求安全归零');
    acknowledge(socket, 'stop', true, '已执行安全归零');
    broadcastControlState();
    return;
  }

  if (type === 'estop') {
    controlState.lastInputAt = Date.now();
    controlState.emergencyStop = true;
    zeroControl(parsed.reason || '前端触发急停');
    setBackendState('急停锁定', parsed.reason || '前端触发急停');
    acknowledge(socket, 'estop', true, '急停已锁定');
    broadcastControlState();
    return;
  }

  if (type === 'release_estop') {
    controlState.lastInputAt = Date.now();
    controlState.emergencyStop = false;
    zeroControl('已解除急停，等待新的控制输入');
    setBackendState('待命', '已解除急停');
    acknowledge(socket, 'release_estop', true, '急停已解除');
    broadcastControlState();
    return;
  }

  acknowledge(socket, type || 'unknown', false, '未支持的控制消息类型');
}

function decodeFrames(client) {
  const frames = [];
  let offset = 0;

  while (offset + 2 <= client.buffer.length) {
    const firstByte = client.buffer[offset];
    const secondByte = client.buffer[offset + 1];
    const opcode = firstByte & 0x0f;
    const masked = (secondByte & 0x80) !== 0;

    let payloadLength = secondByte & 0x7f;
    let headerLength = 2;

    if (payloadLength === 126) {
      if (offset + 4 > client.buffer.length) {
        break;
      }
      payloadLength = client.buffer.readUInt16BE(offset + 2);
      headerLength = 4;
    } else if (payloadLength === 127) {
      if (offset + 10 > client.buffer.length) {
        break;
      }
      payloadLength = Number(client.buffer.readBigUInt64BE(offset + 2));
      headerLength = 10;
    }

    const maskLength = masked ? 4 : 0;
    const frameLength = headerLength + maskLength + payloadLength;
    if (offset + frameLength > client.buffer.length) {
      break;
    }

    let payload = client.buffer.slice(offset + headerLength + maskLength, offset + frameLength);

    if (masked) {
      const mask = client.buffer.slice(offset + headerLength, offset + headerLength + 4);
      const unmasked = Buffer.alloc(payload.length);
      for (let index = 0; index < payload.length; index += 1) {
        unmasked[index] = payload[index] ^ mask[index % 4];
      }
      payload = unmasked;
    }

    frames.push({ opcode, payload });
    offset += frameLength;
  }

  client.buffer = client.buffer.slice(offset);
  return frames;
}

function registerControlClient(socket) {
  const client = { socket, buffer: Buffer.alloc(0) };
  controlClients.add(client);
  controlState.wsConnected = true;
  setBackendState('已连接', '控制 WebSocket 已连接');
  broadcastControlState();

  socket.on('data', (chunk) => {
    client.buffer = Buffer.concat([client.buffer, chunk]);
    const frames = decodeFrames(client);

    for (const frame of frames) {
      if (frame.opcode === 0x8) {
        socket.end(Buffer.from([0x88, 0x00]));
        return;
      }

      if (frame.opcode === 0x9) {
        socket.write(Buffer.concat([Buffer.from([0x8a, frame.payload.length]), frame.payload]));
        continue;
      }

      if (frame.opcode === 0x1) {
        handleControlMessage(client, frame.payload.toString('utf8'));
      }
    }
  });

  socket.on('close', () => {
    controlClients.delete(client);
    if (controlClients.size === 0) {
      controlState.wsConnected = false;
      zeroControl('控制连接断开，后端已自动归零');
      setBackendState('未连接', '控制连接断开');
      broadcastControlState();
    }
  });

  socket.on('error', () => {
    controlClients.delete(client);
  });

  sendControlMessage(socket, {
    type: 'control_state',
    payload: getControlSnapshot(),
  });
}

function handleControlUpgrade(req, socket) {
  const upgradeHeader = req.headers.upgrade || '';
  const websocketKey = req.headers['sec-websocket-key'];

  if (upgradeHeader.toLowerCase() !== 'websocket' || !websocketKey) {
    socket.destroy();
    return;
  }

  const acceptKey = crypto
    .createHash('sha1')
    .update(`${websocketKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
    .digest('base64');

  socket.write(
    [
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '',
      '',
    ].join('\r\n'),
  );

  registerControlClient(socket);
}

function buildConfigPayload() {
  const discovery = loadDiscovery();
  return {
    appTitle: 'RoboMaster S1 智能控制台',
    defaultSourceId: discovery.videoSources.find((item) => item.isDefault)?.id || '',
    discovery,
    controlModes: getControlModeDefinition(),
    qualityProfiles: [
      {
        id: 'clarity',
        label: '1080P',
        description: '高清预览，适合主画面观察。',
        querySuffix: 'quality=95&width=1920&height=1080',
      },
      {
        id: 'balanced',
        label: '720P',
        description: '平衡模式，适合普通网络环境。',
        querySuffix: 'quality=80&width=1280&height=720',
      },
      {
        id: 'debug',
        label: '调试低码率',
        description: '低码率调试模式，适合链路不稳定时排查。',
        querySuffix: 'quality=60&width=960&height=540',
      },
    ],
  };
}

function createSvgFrame(frameIndex, startedAtMs) {
  const now = Date.now();
  const elapsed = ((now - startedAtMs) / 1000).toFixed(1);
  const phase = frameIndex % 120;
  const x = 120 + (phase / 119) * 920;
  const hue = Math.round((frameIndex * 3) % 360);
  const barWidth = 120 + Math.round(phase * 4);
  const fpsHint = 12;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#050608"/>
      <stop offset="55%" stop-color="#10131a"/>
      <stop offset="100%" stop-color="#1d232d"/>
    </linearGradient>
    <filter id="blurGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" />
    </filter>
  </defs>

  <rect width="1280" height="720" fill="url(#bg)"/>
  <g opacity="0.18" stroke="#6d7686" stroke-width="1">
    ${Array.from({ length: 15 }, (_, i) => `<line x1="${i * 90}" y1="0" x2="${i * 90}" y2="720"/>`).join('')}
    ${Array.from({ length: 9 }, (_, i) => `<line x1="0" y1="${i * 80}" x2="1280" y2="${i * 80}"/>`).join('')}
  </g>

  <rect x="80" y="82" width="${barWidth}" height="24" rx="12" fill="hsl(${hue} 70% 55%)" opacity="0.85"/>
  <rect x="80" y="82" width="1120" height="24" rx="12" fill="none" stroke="rgba(255,255,255,0.08)"/>

  <circle cx="${x}" cy="360" r="70" fill="hsl(${hue} 80% 60%)" opacity="0.28" filter="url(#blurGlow)"/>
  <circle cx="${x}" cy="360" r="42" fill="none" stroke="hsl(${hue} 90% 66%)" stroke-width="4"/>
  <line x1="${x - 110}" y1="360" x2="${x + 110}" y2="360" stroke="rgba(255,255,255,0.24)" stroke-width="2"/>
  <line x1="${x}" y1="250" x2="${x}" y2="470" stroke="rgba(255,255,255,0.24)" stroke-width="2"/>

  <rect x="92" y="560" width="1096" height="100" rx="18" fill="rgba(0,0,0,0.38)" stroke="rgba(255,255,255,0.12)"/>
  <text x="120" y="602" fill="#f4f7fb" font-family="Bahnschrift, Segoe UI, sans-serif" font-size="30" font-weight="700" letter-spacing="1.6">ROBOTMASTER S1 本地模拟预览</text>
  <text x="120" y="638" fill="#9fb0c5" font-family="Bahnschrift, Segoe UI, sans-serif" font-size="22">帧 ${frameIndex.toString().padStart(4, '0')}  |  运行 ${elapsed}s  |  目标 ${fpsHint} FPS</text>
  <text x="120" y="666" fill="#7cd38c" font-family="Bahnschrift, Segoe UI, sans-serif" font-size="18">仅用于本地烟雾测试。联调时请替换为真实 MJPEG 视频源。</text>
  <text x="1080" y="102" fill="#ffcc66" text-anchor="end" font-family="Bahnschrift, Segoe UI, sans-serif" font-size="34" font-weight="700">${new Date(now).toLocaleTimeString('en-US', { hour12: false })}</text>

  <g opacity="0.85">
    <rect x="1016" y="154" width="168" height="190" rx="14" fill="rgba(10,12,16,0.60)" stroke="rgba(255,255,255,0.12)"/>
    <text x="1038" y="192" fill="#9fb0c5" font-family="Bahnschrift, Segoe UI, sans-serif" font-size="18">视频流</text>
    <text x="1038" y="226" fill="#7cd38c" font-family="Bahnschrift, Segoe UI, sans-serif" font-size="32" font-weight="700">在线</text>
    <text x="1038" y="266" fill="#dce3ee" font-family="Bahnschrift, Segoe UI, sans-serif" font-size="18">编码: SVG</text>
    <text x="1038" y="296" fill="#dce3ee" font-family="Bahnschrift, Segoe UI, sans-serif" font-size="18">来源: 模拟</text>
  </g>
</svg>`;
}

function writeMultipartFrame(res, contentType, body) {
  res.write('--frame\r\n');
  res.write(`Content-Type: ${contentType}\r\n`);
  res.write(`Content-Length: ${body.length}\r\n`);
  res.write('\r\n');
  res.write(body);
  res.write('\r\n');
}

function handleMockStream(req, res) {
  const startedAtMs = Date.now();
  let frameIndex = 0;
  const intervalMs = 83;

  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    Pragma: 'no-cache',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });

  const timer = setInterval(() => {
    const svg = createSvgFrame(frameIndex, startedAtMs);
    writeMultipartFrame(res, 'image/svg+xml', Buffer.from(svg, 'utf8'));
    frameIndex += 1;
  }, intervalMs);

  req.on('close', () => {
    clearInterval(timer);
  });
}

async function handleStreamProxy(req, res, targetUrl) {
  const parsed = sanitizeTargetUrl(targetUrl);
  if (!parsed) {
    sendJson(res, 400, { error: 'Invalid stream URL. Use an http or https URL.' });
    return;
  }

  const controller = new AbortController();
  req.on('close', () => controller.abort());

  try {
    const upstream = await fetch(parsed, { signal: controller.signal, redirect: 'follow' });
    if (!upstream.ok) {
      sendJson(res, 502, {
        error: 'Upstream stream request failed.',
        status: upstream.status,
        statusText: upstream.statusText,
      });
      return;
    }

    const headers = {};
    for (const [key, value] of upstream.headers.entries()) {
      if (!['connection', 'keep-alive', 'transfer-encoding', 'content-length'].includes(key.toLowerCase())) {
        headers[key] = value;
      }
    }

    headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0';
    headers.Pragma = 'no-cache';
    headers['X-Accel-Buffering'] = 'no';

    res.writeHead(upstream.status, headers);
    if (!upstream.body) {
      res.end();
      return;
    }

    Readable.fromWeb(upstream.body).pipe(res);
  } catch (error) {
    if (controller.signal.aborted) {
      return;
    }
    sendJson(res, 502, {
      error: 'Unable to proxy stream.',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk) => {
      body += chunk.toString('utf8');
      if (body.length > 1024 * 1024) {
        reject(new Error('请求体过大'));
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function routeRequest(req, res) {
  const requestUrl = new URL(req.url || '/', 'http://localhost');

  if (requestUrl.pathname === '/api/config') {
    sendJson(res, 200, buildConfigPayload());
    return;
  }

  if (requestUrl.pathname === '/api/health') {
    const discovery = loadDiscovery();
    sendJson(res, 200, {
      ok: true,
      service: 'robomaster-s1-ai-ui',
      phase: 'phase-2-manual-teleop',
      rosConnected: discovery.robot.rosConnected,
      environment: discovery.environment,
      control: getControlSnapshot(),
    });
    return;
  }

  if (requestUrl.pathname === '/api/healthz') {
    sendJson(res, 200, {
      ok: true,
      service: 'robomaster-s1-ai-ui',
      phase: 'phase-2-manual-teleop',
    });
    return;
  }

  if (requestUrl.pathname === '/api/ros/status') {
    const discovery = loadDiscovery();
    sendJson(res, 200, {
      rosConnected: discovery.robot.rosConnected,
      environment: discovery.environment,
      issues: discovery.robot.issues,
      cameraTopics: discovery.robot.cameraTopics,
      controlTopics: discovery.robot.controlTopics,
    });
    return;
  }

  if (requestUrl.pathname === '/api/ros/rescan' && req.method === 'POST') {
    sendJson(res, 200, discoverRobot());
    return;
  }

  if (requestUrl.pathname === '/api/robot/discovery') {
    sendJson(res, 200, loadDiscovery());
    return;
  }

  if (requestUrl.pathname === '/api/robot/capabilities') {
    const discovery = loadDiscovery();
    sendJson(res, 200, {
      rosConnected: discovery.robot.rosConnected,
      canPreviewVideo: discovery.videoSources.length > 0,
      canManualControl: true,
      canAutoDiscover: discovery.environment.ros2Available,
      canRunFollowMode: false,
    });
    return;
  }

  if (requestUrl.pathname === '/api/video/sources') {
    const discovery = loadDiscovery();
    sendJson(res, 200, {
      generatedAt: discovery.generatedAt,
      sources: discovery.videoSources,
    });
    return;
  }

  if (requestUrl.pathname === '/api/video/status') {
    const discovery = loadDiscovery();
    sendJson(res, 200, {
      sourceCount: discovery.videoSources.length,
      rosConnected: discovery.robot.rosConnected,
      mode: discovery.robot.discoveryMode,
    });
    return;
  }

  if (requestUrl.pathname === '/api/control/state') {
    sendJson(res, 200, getControlSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/control/topics') {
    sendJson(res, 200, {
      selectedTopics: controlState.selectedTopics,
      candidateTopics: controlState.candidateTopics,
    });
    return;
  }

  if (requestUrl.pathname === '/api/control/stop' && req.method === 'POST') {
    zeroControl('通过 HTTP 接口触发安全归零');
    broadcastControlState();
    sendJson(res, 200, getControlSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/control/estop' && req.method === 'POST') {
    let parsedBody = {};
    try {
      const rawBody = await readRequestBody(req);
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsedBody = {};
    }
    controlState.emergencyStop = true;
    zeroControl(parsedBody.reason || '通过 HTTP 接口触发急停');
    setBackendState('急停锁定', parsedBody.reason || '通过 HTTP 接口触发急停');
    broadcastControlState();
    sendJson(res, 200, getControlSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/control/release-estop' && req.method === 'POST') {
    controlState.emergencyStop = false;
    zeroControl('通过 HTTP 接口解除急停');
    setBackendState('待命', '通过 HTTP 接口解除急停');
    broadcastControlState();
    sendJson(res, 200, getControlSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/mock-stream') {
    handleMockStream(req, res);
    return;
  }

  if (requestUrl.pathname === '/api/stream-proxy') {
    handleStreamProxy(req, res, requestUrl.searchParams.get('url') || '');
    return;
  }

  if (requestUrl.pathname === '/' || requestUrl.pathname === '/index.html') {
    if (!serveStaticFile(res, path.join(WEB_ROOT, 'index.html'))) {
      sendText(res, 404, 'Not found');
    }
    return;
  }

  const staticPath = path.normalize(path.join(WEB_ROOT, requestUrl.pathname));
  if (!staticPath.startsWith(WEB_ROOT)) {
    sendText(res, 403, 'Forbidden');
    return;
  }

  if (serveStaticFile(res, staticPath)) {
    return;
  }

  sendText(res, 404, 'Not found');
}

const server = http.createServer((req, res) => {
  routeRequest(req, res).catch((error) => {
    sendJson(res, 500, {
      error: 'Internal server error',
      message: error instanceof Error ? error.message : String(error),
    });
  });
});

server.on('upgrade', (req, socket) => {
  const requestUrl = new URL(req.url || '/', 'http://localhost');
  if (requestUrl.pathname !== CONTROL_WS_PATH) {
    socket.destroy();
    return;
  }
  handleControlUpgrade(req, socket);
});

setInterval(() => {
  if (!controlState.wsConnected || controlState.emergencyStop || !controlState.lastInputAt) {
    return;
  }
  const idleMs = Date.now() - controlState.lastInputAt;
  if (idleMs > CONTROL_HEARTBEAT_TIMEOUT_MS) {
    zeroControl('前端心跳超时，后端已自动归零');
    setBackendState('安全归零', '前端心跳超时');
    broadcastControlState();
  }
}, CONTROL_SAFETY_POLL_MS);

server.listen(PORT, HOST, () => {
  discoverRobot();
  console.log(`Robomaster UI listening on http://${HOST}:${PORT}`);
  const appConfig = loadAppConfig();
  if (appConfig.video.defaultStreamUrl) {
    console.log(`Default stream URL from config: ${appConfig.video.defaultStreamUrl}`);
  } else if (process.env.ROBOMASTER_STREAM_URL) {
    console.log(`Default stream URL from env fallback: ${process.env.ROBOMASTER_STREAM_URL}`);
  }
});
