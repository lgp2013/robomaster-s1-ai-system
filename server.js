const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { Readable } = require('node:stream');
const { createPerceptionRuntime } = require('./perception_runtime');

const ROOT = __dirname;
const WEB_ROOT = path.join(ROOT, 'web');
const RUNTIME_ROOT = path.join(ROOT, 'runtime');
const DISCOVERY_PATH = path.join(RUNTIME_ROOT, 'robot_discovery.json');
const APP_CONFIG_PATH = path.join(RUNTIME_ROOT, 'app_config.json');
const MEDIA_ROOT = path.join(RUNTIME_ROOT, 'media');
const LOCKED_TARGETS_ROOT = path.join(MEDIA_ROOT, 'locked_targets');
const MEDIA_INDEX_PATH = path.join(LOCKED_TARGETS_ROOT, 'index.json');
const HOST = process.env.HOST || '0.0.0.0';
const PORT = Number(process.env.PORT || 3000);
const MOCK_STREAM_URL = '/api/mock-stream';
const CONTROL_WS_PATH = '/ws/control';
const STATUS_WS_PATH = '/ws/status';
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
const statusClients = new Set();

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
  modeNotice: '底盘模式只允许底盘摇杆生效，切模式时会立即清零。',
};

const robotInfoState = {
  battery: null,
  velocity: null,
  gimbalYaw: null,
  gimbalPitch: null,
  imuStatus: null,
  connectionQuality: null,
  uptime: null,
  errorCode: null,
  firmwareVersion: null,
  lastUpdateAt: null,
};

const perceptionRuntime = createPerceptionRuntime({
  runtimeRoot: RUNTIME_ROOT,
  onControlUpdate(update) {
    controlState.velocityCommand = update.velocityCommand;
    controlState.gimbalCommand = update.gimbalCommand;
    controlState.lastCommandAt = Date.now();
    if (update.backendState) {
      controlState.backendState = update.backendState;
    }
    if (update.reason) {
      controlState.lastReason = update.reason;
    }
    writeControlCommands();
    broadcastControlState();
  },
  onSnapshotChange() {
    broadcastControlState();
  },
});

function ensureRuntimeDir() {
  fs.mkdirSync(RUNTIME_ROOT, { recursive: true });
  fs.mkdirSync(LOCKED_TARGETS_ROOT, { recursive: true });
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

function tryExec(command, args, options = {}) {
  try {
    return execFileSync(command, args, {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: options.timeout || 5000,
      ...options,
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

function pickPreferredNamedTopic(candidates, keywords) {
  if (!candidates.length) {
    return '';
  }
  const loweredKeywords = keywords.map((keyword) => keyword.toLowerCase());
  const exact = candidates.find((entry) => loweredKeywords.some((keyword) => entry.name.toLowerCase().includes(keyword)));
  return (exact || candidates[0]).name;
}

function shouldPublishToRos(selectedTopics, environment) {
  return Boolean(
    selectedTopics.cmdVel &&
    environment.ros2Available &&
    !environment.os.startsWith('Windows')
  );
}

function rebuildControlIssues(environment) {
  const issues = [];
  if (!controlState.selectedTopics.cmdVel) {
    issues.push('未发现可直接使用的 cmd_vel Topic，当前仅验证控制链路与安全归零。');
  } else if (!controlState.rosPublishActive) {
    issues.push('已发现 cmd_vel Topic，但当前环境未满足 ROS2 Foxy 发布条件，请在 Ubuntu 20.04 + ROS2 Foxy 中启动 ros2_bridge.py。');
  } else {
    issues.push('已发现控制 Topic，ROS2 发布已启用，请确认 ros2_bridge.py 正在运行。');
  }

  if (!controlState.selectedTopics.gimbalCombined && !controlState.selectedTopics.gimbalYaw && !controlState.selectedTopics.gimbalPitch) {
    issues.push('未发现云台控制 Topic，当前仅记录云台摇杆输入与状态。');
  }

  controlState.issues = issues;
}

function updateSelectedTopics(nextSelection) {
  const cmdVelCandidates = controlState.candidateTopics.cmdVel.map((topic) => topic.name);
  const gimbalCandidates = controlState.candidateTopics.gimbal.map((topic) => topic.name);

  controlState.selectedTopics = {
    cmdVel: cmdVelCandidates.includes(nextSelection.cmdVel) ? nextSelection.cmdVel : '',
    gimbalYaw: gimbalCandidates.includes(nextSelection.gimbalYaw) ? nextSelection.gimbalYaw : '',
    gimbalPitch: gimbalCandidates.includes(nextSelection.gimbalPitch) ? nextSelection.gimbalPitch : '',
    gimbalCombined: gimbalCandidates.includes(nextSelection.gimbalCombined) ? nextSelection.gimbalCombined : '',
  };

  const environment = detectEnvironment();
  controlState.rosPublishActive = shouldPublishToRos(controlState.selectedTopics, environment);
  controlState.bridgeMode = controlState.rosPublishActive
    ? 'ros-publish-active'
    : controlState.selectedTopics.cmdVel
      ? 'topic-detected-awaiting-bridge'
      : 'state-only';
  rebuildControlIssues(environment);
}

function getModeNotice(mode) {
  if (mode === 'gimbal') {
    return '云台模式只接受云台摇杆输入，底盘保持零速。';
  }
  if (mode === 'follow-gimbal') {
    return '联动模式由云台摇杆主控：右摇杆同时控制云台和底盘跟随，左摇杆输入被忽略。';
  }
  return '底盘模式只接受底盘摇杆输入，云台保持零速。';
}

function refreshControlTopicSelection(controlTopics) {
  const cmdVelCandidates = controlTopics.filter((topic) => topic.role === 'cmd_vel');
  const gimbalCandidates = controlTopics.filter((topic) => topic.role === 'gimbal');

  controlState.candidateTopics = {
    cmdVel: cmdVelCandidates,
    gimbal: gimbalCandidates,
  };

  updateSelectedTopics({
    cmdVel: cmdVelCandidates.some((topic) => topic.name === controlState.selectedTopics.cmdVel)
      ? controlState.selectedTopics.cmdVel
      : pickPreferredTopic(cmdVelCandidates),
    gimbalYaw: gimbalCandidates.some((topic) => topic.name === controlState.selectedTopics.gimbalYaw)
      ? controlState.selectedTopics.gimbalYaw
      : pickPreferredNamedTopic(gimbalCandidates, ['gimbal_yaw', '/yaw', 'yaw']),
    gimbalPitch: gimbalCandidates.some((topic) => topic.name === controlState.selectedTopics.gimbalPitch)
      ? controlState.selectedTopics.gimbalPitch
      : pickPreferredNamedTopic(gimbalCandidates, ['gimbal_pitch', '/pitch', 'pitch']),
    gimbalCombined: gimbalCandidates.some((topic) => topic.name === controlState.selectedTopics.gimbalCombined)
      ? controlState.selectedTopics.gimbalCombined
      : pickPreferredNamedTopic(gimbalCandidates, ['gimbal_cmd', 'gimbal', 'head']),
  });
}

function discoverRobot() {
  const appConfig = loadAppConfig();
  const configuredStreamUrl = appConfig.video.defaultStreamUrl || process.env.ROBOMASTER_STREAM_URL || '';
  const environment = detectEnvironment();
  const issues = [];
  const cameraTopics = [];
  const controlTopics = [];
  const detectionTopics = [];
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
      } else if (lowerType.includes('yolo_msgs/msg/detectionarray') || lowerName.includes('/yolo/')) {
        detectionTopics.push({
          name: topic.name,
          type: topic.type,
          role: 'detection',
        });
      }
    }

    const serviceListRaw = tryExec('ros2', ['service', 'list', '-t']);
    for (const line of serviceListRaw.split(/\r?\n/).map((item) => item.trim()).filter(Boolean)) {
      if (line.toLowerCase().includes('/yolo')) {
        services.push({ name: line, role: 'yolo-service' });
      }
    }
  }

  refreshControlTopicSelection(controlTopics);
  perceptionRuntime.setDiscovery(detectionTopics, services, environment);

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
      detectionTopics,
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

function getLockedTargetPhotoPath(photoId) {
  return path.join(LOCKED_TARGETS_ROOT, `${photoId}.png`);
}

function buildMediaIndex() {
  ensureRuntimeDir();
  const photos = [];

  if (fs.existsSync(LOCKED_TARGETS_ROOT)) {
    const files = fs.readdirSync(LOCKED_TARGETS_ROOT);
    files
      .filter((filename) => filename.endsWith('.png'))
      .sort((a, b) => {
        const statA = fs.statSync(path.join(LOCKED_TARGETS_ROOT, a));
        const statB = fs.statSync(path.join(LOCKED_TARGETS_ROOT, b));
        return statB.mtime.getTime() - statA.mtime.getTime();
      })
      .forEach((filename) => {
        const filePath = path.join(LOCKED_TARGETS_ROOT, filename);
        const stat = fs.statSync(filePath);
        const id = path.basename(filename, '.png');
        photos.push({
          id,
          filename,
          url: `/api/media/photos/${id}`,
          lockedAt: stat.mtime.toISOString(),
          targetLabel: 'person',
          confidence: null,
        });
      });
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    count: photos.length,
    photos,
  };

  fs.writeFileSync(MEDIA_INDEX_PATH, JSON.stringify(payload, null, 2));
  return payload;
}

function loadMediaIndex() {
  ensureRuntimeDir();
  if (!fs.existsSync(MEDIA_INDEX_PATH)) {
    return buildMediaIndex();
  }

  try {
    return JSON.parse(fs.readFileSync(MEDIA_INDEX_PATH, 'utf8'));
  } catch {
    return buildMediaIndex();
  }
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
      description: '左摇杆控制底盘移动，云台不动作。',
    },
    {
      id: 'gimbal',
      label: '云台模式',
      description: '右摇杆控制云台转动，底盘保持静止。',
    },
    {
      id: 'follow-gimbal',
      label: '联动模式',
      description: '右摇杆控制云台方向，底盘自动跟随云台指向移动。',
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

  if (mode === 'chassis') {
    // 底盘模式：只响应底盘摇杆，控制车辆移动
    linearX = round(-chassis.y * 0.8);
    angularZ = round(chassis.x * 1.4);
  } else if (mode === 'gimbal') {
    // 云台模式：只响应云台摇杆，控制云台转动，车辆不移动
    yawRate = round(gimbal.x * 90, 1);
    pitchRate = round(-gimbal.y * 60, 1);
  } else if (mode === 'follow-gimbal') {
    // 联动模式：右摇杆主控，底盘仅跟随云台摇杆方向
    yawRate = round(gimbal.x * 90, 1);
    pitchRate = round(-gimbal.y * 60, 1);
    linearX = round(-gimbal.y * 0.24);
    angularZ = round(gimbal.x * 0.8);
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
      selectedTopics: controlState.selectedTopics,
    };
    fs.writeFileSync(COMMAND_PATH, JSON.stringify(payload, null, 2));
  } catch {
    // Keep control path non-blocking when runtime write fails.
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

function switchControlMode(nextMode) {
  controlState.mode = nextMode;
  controlState.modeNotice = getModeNotice(nextMode);
  controlState.chassisAxis = { x: 0, y: 0 };
  controlState.gimbalAxis = { x: 0, y: 0 };
  computeCommands();
  controlState.lastCommandAt = Date.now();
  setBackendState('模式切换', `${getModeNotice(nextMode)} 已执行清零保护。`);
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
    modeNotice: controlState.modeNotice,
    issues: [
      ...controlState.issues,
      ...(discovery.robot.rosConnected ? [] : ['当前环境未连接 ROS2，控制指令仅在后端状态机中验证。']),
    ],
  };
}

function getRobotInfoSnapshot() {
  return {
    generatedAt: new Date().toISOString(),
    battery: robotInfoState.battery,
    velocity: robotInfoState.velocity,
    gimbalYaw: robotInfoState.gimbalYaw,
    gimbalPitch: robotInfoState.gimbalPitch,
    imuStatus: robotInfoState.imuStatus,
    connectionQuality: robotInfoState.connectionQuality,
    uptime: robotInfoState.uptime,
    errorCode: robotInfoState.errorCode,
    firmwareVersion: robotInfoState.firmwareVersion,
    lastUpdateAt: robotInfoState.lastUpdateAt,
  };
}

function parseJsonObject(text) {
  if (!text) {
    return null;
  }

  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
    return null;
  }

  try {
    return JSON.parse(text.slice(firstBrace, lastBrace + 1));
  } catch {
    return null;
  }
}

function readRosTopicOnce(candidates, timeout = 3000) {
  for (const topic of candidates) {
    const raw = tryExec('ros2', ['topic', 'echo', topic, '--once'], { timeout });
    if (raw) {
      return { topic, raw };
    }
  }
  return { topic: '', raw: '' };
}

function formatPercent(rawValue) {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  const normalized = numeric <= 1 ? numeric * 100 : numeric;
  return `${normalized.toFixed(1)}%`;
}

function formatSeconds(rawValue) {
  const numeric = Number(rawValue);
  if (!Number.isFinite(numeric)) {
    return '';
  }
  return `${numeric.toFixed(0)}s`;
}

function updateRobotInfoFromRos() {
  const env = detectEnvironment();
  const unavailable = '未发现';

  robotInfoState.battery = unavailable;
  robotInfoState.velocity = unavailable;
  robotInfoState.gimbalYaw = unavailable;
  robotInfoState.gimbalPitch = unavailable;
  robotInfoState.imuStatus = unavailable;
  robotInfoState.connectionQuality = unavailable;
  robotInfoState.uptime = unavailable;
  robotInfoState.errorCode = unavailable;
  robotInfoState.firmwareVersion = unavailable;
  robotInfoState.lastUpdateAt = new Date().toISOString();

  if (!env.ros2Available) {
    robotInfoState.imuStatus = '未连接 ROS2';
    return;
  }

  const batteryResult = readRosTopicOnce(['/battery', '/battery_state']);
  if (batteryResult.raw) {
    const percentageMatch = batteryResult.raw.match(/percentage:\s*([\d.]+)/);
    const voltageMatch = batteryResult.raw.match(/voltage:\s*([\d.]+)/);
    if (percentageMatch) {
      robotInfoState.battery = formatPercent(percentageMatch[1]) || unavailable;
    } else if (voltageMatch) {
      robotInfoState.battery = `${parseFloat(voltageMatch[1]).toFixed(2)} V`;
    }
  }

  const odomResult = readRosTopicOnce(['/odom']);
  if (odomResult.raw) {
    const linearMatch = odomResult.raw.match(/linear:\s*\n\s*x:\s*([\d.eE+-]+)/);
    const angularMatch = odomResult.raw.match(/angular:\s*\n\s*z:\s*([\d.eE+-]+)/);
    if (linearMatch && angularMatch) {
      robotInfoState.velocity = `${parseFloat(linearMatch[1]).toFixed(2)} / ${parseFloat(angularMatch[1]).toFixed(2)}`;
    }
  }

  const gimbalResult = readRosTopicOnce(['/gimbal/angle', '/state', '/joint_states']);
  if (gimbalResult.raw) {
    const yawMatch = gimbalResult.raw.match(/(?:yaw|x):\s*([\d.eE+-]+)/);
    const pitchMatch = gimbalResult.raw.match(/(?:pitch|y):\s*([\d.eE+-]+)/);
    if (yawMatch) {
      robotInfoState.gimbalYaw = `${parseFloat(yawMatch[1]).toFixed(1)}°`;
    }
    if (pitchMatch) {
      robotInfoState.gimbalPitch = `${parseFloat(pitchMatch[1]).toFixed(1)}°`;
    }
  }

  const imuResult = readRosTopicOnce(['/imu', '/imu/data']);
  if (imuResult.raw) {
    robotInfoState.imuStatus = '正常';
  }

  const statusResult = readRosTopicOnce(['/robot_status', '/status']);
  if (statusResult.raw) {
    const statusJson = parseJsonObject(statusResult.raw);
    if (statusJson) {
      if (statusJson.connection_quality != null) {
        robotInfoState.connectionQuality = formatPercent(statusJson.connection_quality) || String(statusJson.connection_quality);
      }
      if (statusJson.uptime != null) {
        robotInfoState.uptime = formatSeconds(statusJson.uptime) || String(statusJson.uptime);
      }
      if (statusJson.error_code != null) {
        robotInfoState.errorCode = String(statusJson.error_code);
      }
      if (statusJson.firmware_version != null) {
        robotInfoState.firmwareVersion = String(statusJson.firmware_version);
      }
    } else {
      const connectionMatch = statusResult.raw.match(/connection_quality:\s*([\d.]+)/);
      const uptimeMatch = statusResult.raw.match(/uptime:\s*([\d.]+)/);
      const errorMatch = statusResult.raw.match(/error_code:\s*([^\n]+)/);
      const firmwareMatch = statusResult.raw.match(/firmware_version:\s*([^\n]+)/);
      if (connectionMatch) {
        robotInfoState.connectionQuality = formatPercent(connectionMatch[1]) || unavailable;
      }
      if (uptimeMatch) {
        robotInfoState.uptime = formatSeconds(uptimeMatch[1]) || unavailable;
      }
      if (errorMatch) {
        robotInfoState.errorCode = errorMatch[1].trim();
      }
      if (firmwareMatch) {
        robotInfoState.firmwareVersion = firmwareMatch[1].trim();
      }
    }
  }
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
    setBackendState('急停锁定', '急停未解除，忽略摇杆输入。');
    return;
  }

  if (channel === 'chassis') {
    if (controlState.mode !== 'chassis') {
      controlState.chassisAxis = { x: 0, y: 0 };
      computeCommands();
      if (controlState.mode === 'follow-gimbal') {
        setBackendState('联动模式', '联动模式只接受云台摇杆，已忽略底盘摇杆输入。');
      } else {
        setBackendState('云台模式', '云台模式下底盘摇杆被忽略。');
      }
      return;
    }
    controlState.chassisAxis = { x, y };
  } else {
    if (controlState.mode === 'chassis') {
      controlState.gimbalAxis = { x: 0, y: 0 };
      computeCommands();
      setBackendState('底盘模式', '底盘模式下云台摇杆被忽略。');
      return;
    }
    controlState.gimbalAxis = { x, y };
  }

  computeCommands();
  if (channel === 'chassis') {
    setBackendState('控制中', '底盘摇杆输入已更新。');
  } else if (controlState.mode === 'follow-gimbal') {
    setBackendState('联动模式', '云台摇杆已驱动云台与底盘联动跟随。');
  } else {
    setBackendState('控制中', '云台摇杆输入已更新。');
  }
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
    controlState.lastInputAt = Date.now();
    switchControlMode(parsed.mode);
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

function handleWebSocketUpgrade(req, socket, isStatus = false) {
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

  if (isStatus) {
    registerStatusClient(socket);
  } else {
    registerControlClient(socket);
  }
}

function registerStatusClient(socket) {
  const client = { socket, id: Math.random().toString(36).slice(2) };
  statusClients.add(client);

  socket.on('close', () => {
    statusClients.delete(client);
  });

  socket.on('error', () => {
    statusClients.delete(client);
  });

  // 立即发送当前状态
  sendStatusMessage(socket);
}

function sendStatusMessage(socket) {
  try {
    const message = JSON.stringify({
      type: 'robot_status',
      payload: {
        ...getRobotInfoSnapshot(),
        ...getControlSnapshot(),
      },
    });
    const frame = Buffer.from(message);
    const length = frame.length;
    let header;
    if (length < 126) {
      header = Buffer.from([0x81, length]);
    } else if (length < 65536) {
      header = Buffer.from([0x81, 126, (length >> 8) & 0xff, length & 0xff]);
    } else {
      header = Buffer.from([
        0x81, 127, 0, 0, 0, 0, (length >> 24) & 0xff, (length >> 16) & 0xff, (length >> 8) & 0xff, length & 0xff,
      ]);
    }
    socket.write(Buffer.concat([header, frame]));
  } catch {
    // 静默失败
  }
}

function broadcastStatus() {
  for (const client of statusClients) {
    sendStatusMessage(client.socket);
  }
}

function handleControlUpgrade(req, socket) {
  handleWebSocketUpgrade(req, socket, false);
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

function handleMediaPhotos(req, res) {
  try {
    sendJson(res, 200, loadMediaIndex());
  } catch (error) {
    sendJson(res, 500, {
      error: '读取媒体文件失败',
      message: error instanceof Error ? error.message : String(error),
    });
  }
}

function handleDeletePhoto(req, res, photoId) {
  const filePath = getLockedTargetPhotoPath(photoId);
  
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      buildMediaIndex();
      sendJson(res, 200, { ok: true, message: '已删除' });
    } else {
      sendJson(res, 404, { error: '照片不存在' });
    }
  } catch (error) {
    sendJson(res, 500, { error: '删除失败', message: error instanceof Error ? error.message : String(error) });
  }
}

function handleMediaRescan(req, res) {
  try {
    sendJson(res, 200, buildMediaIndex());
  } catch (error) {
    sendJson(res, 500, {
      error: '刷新媒体索引失败',
      message: error instanceof Error ? error.message : String(error),
    });
  }
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
      phase: 'phase-5-assisted-follow',
      rosConnected: discovery.robot.rosConnected,
      environment: discovery.environment,
      control: getControlSnapshot(),
      perception: perceptionRuntime.getSnapshot(),
    });
    return;
  }

  if (requestUrl.pathname === '/api/healthz') {
    sendJson(res, 200, {
      ok: true,
      service: 'robomaster-s1-ai-ui',
      phase: 'phase-5-assisted-follow',
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
      canPerceive: true,
      canLockPerson: true,
      canRunFollowMode: true,
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

  if (requestUrl.pathname === '/api/perception/state') {
    sendJson(res, 200, perceptionRuntime.getSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/perception/toggle' && req.method === 'POST') {
    let parsedBody = {};
    try {
      const rawBody = await readRequestBody(req);
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsedBody = {};
    }
    const discovery = loadDiscovery();
    perceptionRuntime.setEnabled(Boolean(parsedBody.enabled), discovery.environment);
    sendJson(res, 200, perceptionRuntime.getSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/target/lock' && req.method === 'POST') {
    let parsedBody = {};
    try {
      const rawBody = await readRequestBody(req);
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsedBody = {};
    }
    const result = perceptionRuntime.lockTarget(parsedBody.targetId || '', parsedBody.snapshotDataUrl || '');
    sendJson(res, result.ok ? 200 : 400, {
      ...result,
      perception: perceptionRuntime.getSnapshot(),
    });
    return;
  }

  if (requestUrl.pathname === '/api/target/unlock' && req.method === 'POST') {
    perceptionRuntime.unlockTarget();
    sendJson(res, 200, perceptionRuntime.getSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/follow/enable' && req.method === 'POST') {
    const result = perceptionRuntime.setFollowEnabled(true);
    sendJson(res, result.ok ? 200 : 400, {
      ...result,
      perception: perceptionRuntime.getSnapshot(),
    });
    return;
  }

  if (requestUrl.pathname === '/api/follow/disable' && req.method === 'POST') {
    perceptionRuntime.setFollowEnabled(false);
    sendJson(res, 200, perceptionRuntime.getSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/control/state') {
    sendJson(res, 200, getControlSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/robot/info') {
    updateRobotInfoFromRos();
    sendJson(res, 200, getRobotInfoSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/control/topics' && req.method === 'POST') {
    let parsedBody = {};
    try {
      const rawBody = await readRequestBody(req);
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsedBody = {};
    }

    updateSelectedTopics({
      cmdVel: typeof parsedBody.cmdVel === 'string' ? parsedBody.cmdVel : controlState.selectedTopics.cmdVel,
      gimbalYaw: typeof parsedBody.gimbalYaw === 'string' ? parsedBody.gimbalYaw : controlState.selectedTopics.gimbalYaw,
      gimbalPitch: typeof parsedBody.gimbalPitch === 'string' ? parsedBody.gimbalPitch : controlState.selectedTopics.gimbalPitch,
      gimbalCombined: typeof parsedBody.gimbalCombined === 'string' ? parsedBody.gimbalCombined : controlState.selectedTopics.gimbalCombined,
    });
    controlState.lastCommandAt = Date.now();
    setBackendState('Topic 绑定已更新', '后端已应用新的控制 Topic 选择。');
    writeControlCommands();
    broadcastControlState();
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

  if (requestUrl.pathname === '/api/control/mode' && req.method === 'POST') {
    let parsedBody = {};
    try {
      const rawBody = await readRequestBody(req);
      parsedBody = rawBody ? JSON.parse(rawBody) : {};
    } catch {
      parsedBody = {};
    }
    const mode = parsedBody.mode;
    const validModes = ['chassis', 'gimbal', 'follow-gimbal'];
    if (!validModes.includes(mode)) {
      sendJson(res, 400, { error: '无效的控制模式', validModes });
      return;
    }
    // 模式切换前归零，确保安全
    zeroControl('模式切换，后端请求安全归零');
    controlState.mode = mode;
    const modeNotices = {
      chassis: '底盘模式：只移动车辆，云台不动。',
      gimbal: '云台模式：只调整云台，车辆不移动。',
      'follow-gimbal': '联动模式：车辆将跟随云台方向。',
    };
    controlState.modeNotice = modeNotices[mode] || '';
    setBackendState('模式已切换', `已切换到${mode === 'chassis' ? '底盘' : mode === 'gimbal' ? '云台' : '联动'}模式`);
    broadcastControlState();
    sendJson(res, 200, getControlSnapshot());
    return;
  }

  if (requestUrl.pathname === '/api/control/mode') {
    sendJson(res, 200, {
      mode: controlState.mode,
      modes: getControlModeDefinition(),
      modeNotice: controlState.modeNotice,
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

  if (requestUrl.pathname === '/api/media/photos') {
    handleMediaPhotos(req, res);
    return;
  }

  if (requestUrl.pathname === '/api/media/rescan' && req.method === 'POST') {
    handleMediaRescan(req, res);
    return;
  }

  if (requestUrl.pathname.startsWith('/api/media/photos/') && req.method === 'DELETE') {
    const photoId = requestUrl.pathname.replace('/api/media/photos/', '');
    handleDeletePhoto(req, res, photoId);
    return;
  }

  if (requestUrl.pathname.startsWith('/api/media/photos/') && req.method === 'GET') {
    const photoId = requestUrl.pathname.replace('/api/media/photos/', '');
    const filePath = getLockedTargetPhotoPath(photoId);
    
    if (fs.existsSync(filePath)) {
      const data = fs.readFileSync(filePath);
      res.writeHead(200, {
        'Content-Type': 'image/png',
        'Cache-Control': 'no-store',
      });
      res.end(data);
    } else {
      sendJson(res, 404, { error: '照片不存在' });
    }
    return;
  }

  if (requestUrl.pathname === '/media' || requestUrl.pathname === '/media.html') {
    if (!serveStaticFile(res, path.join(WEB_ROOT, 'media.html'))) {
      sendText(res, 404, 'Not found');
    }
    return;
  }

  if (requestUrl.pathname === '/scene' || requestUrl.pathname === '/scene.html') {
    if (!serveStaticFile(res, path.join(WEB_ROOT, 'scene.html'))) {
      sendText(res, 404, 'Not found');
    }
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
  if (requestUrl.pathname === CONTROL_WS_PATH) {
    handleControlUpgrade(req, socket);
  } else if (requestUrl.pathname === STATUS_WS_PATH) {
    handleWebSocketUpgrade(req, socket, true);
  } else {
    socket.destroy();
  }
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

// 状态广播定时器：每 2 秒广播一次机器人状态
setInterval(() => {
  broadcastStatus();
}, 2000);

server.listen(PORT, HOST, () => {
  ensureRuntimeDir();
  buildMediaIndex();
  discoverRobot();
  console.log(`Robomaster UI listening on http://${HOST}:${PORT}`);
  const appConfig = loadAppConfig();
  if (appConfig.video.defaultStreamUrl) {
    console.log(`Default stream URL from config: ${appConfig.video.defaultStreamUrl}`);
  } else if (process.env.ROBOMASTER_STREAM_URL) {
    console.log(`Default stream URL from env fallback: ${process.env.ROBOMASTER_STREAM_URL}`);
  }
});
