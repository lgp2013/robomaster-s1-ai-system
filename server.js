const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { Readable } = require('node:stream');
const os = require('node:os');
const { execFileSync } = require('node:child_process');

const ROOT = __dirname;
const WEB_ROOT = path.join(ROOT, 'web');
const RUNTIME_ROOT = path.join(ROOT, 'runtime');
const DISCOVERY_PATH = path.join(RUNTIME_ROOT, 'robot_discovery.json');
const APP_CONFIG_PATH = path.join(RUNTIME_ROOT, 'app_config.json');
const HOST = process.env.HOST || '127.0.0.1';
const PORT = Number(process.env.PORT || 3000);
const MOCK_STREAM_URL = '/api/mock-stream';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.ico': 'image/x-icon',
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
  } catch (error) {
    return '';
  }
}

function detectEnvironment() {
  const platform = os.platform();
  const envRosDistro = process.env.ROS_DISTRO || '';
  const ros2Path = tryExec(platform === 'win32' ? 'where.exe' : 'which', [platform === 'win32' ? 'ros2' : 'ros2']);
  const ros2Version = ros2Path ? tryExec('ros2', ['--version']) : '';
  const pythonVersion = tryExec(platform === 'win32' ? 'py' : 'python3', platform === 'win32' ? ['-3', '--version'] : ['--version']);
  const nodeVersion = process.version;

  return {
    os: platform === 'win32' ? `Windows ${os.release()}` : `${platform} ${os.release()}`,
    nodeVersion,
    pythonVersion: pythonVersion || 'unknown',
    rosDistro: envRosDistro || 'not-detected',
    ros2Available: Boolean(ros2Path),
    ros2Path: ros2Path || '',
    ros2Version: ros2Version || '',
    targetEnvironment: 'Ubuntu 20.04 + ROS2 Foxy',
    currentEnvironmentMatchesTarget: platform !== 'win32' && envRosDistro.toLowerCase() === 'foxy' && Boolean(ros2Path),
  };
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

  const discoveredSources = [];
  if (configuredStreamUrl) {
    discoveredSources.push({
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

  discoveredSources.push({
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
    videoSources: discoveredSources,
    troubleshooting: [
      '如需真实联调，请在 Ubuntu 20.04 + ROS2 Foxy 环境中启动后端。',
      '如需真实视频源，请先确认摄像头 Topic 已发布，再执行重新扫描。',
      '当前 Windows 工作区仅提供本地模拟视频和配置文件中的 MJPEG 视频源。'
    ],
  };

  ensureRuntimeDir();
  fs.writeFileSync(DISCOVERY_PATH, JSON.stringify(discovery, null, 2));
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

  let parsed;
  try {
    parsed = new URL(rawValue);
  } catch {
    return null;
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return null;
  }

  return parsed;
}

function buildConfigPayload() {
  const discovery = loadDiscovery();
  return {
    appTitle: 'RoboMaster S1 智能控制台',
    defaultSourceId: discovery.videoSources.find((item) => item.isDefault)?.id || '',
    discovery,
    qualityProfiles: [
      {
        id: 'clarity',
        label: '1080P',
        description: '高清预览。适合主视图观察。',
        querySuffix: 'quality=95&width=1920&height=1080',
      },
      {
        id: 'balanced',
        label: '720P',
        description: '平衡模式。适合普通网络环境。',
        querySuffix: 'quality=80&width=1280&height=720',
      },
      {
        id: 'debug',
        label: '调试低码率',
        description: '低码率调试模式。适合链路不稳定时排查。',
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
    <linearGradient id="scan" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="rgba(255,198,87,0.10)"/>
      <stop offset="50%" stop-color="rgba(255,198,87,0.55)"/>
      <stop offset="100%" stop-color="rgba(255,198,87,0.10)"/>
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

  <rect x="80" y="130" width="1120" height="2" fill="rgba(255,255,255,0.14)"/>
  <rect x="80" y="486" width="1120" height="2" fill="rgba(255,255,255,0.14)"/>
</svg>`;
}

function writeMultipartFrame(res, contentType, body) {
  res.write(`--frame\r\n`);
  res.write(`Content-Type: ${contentType}\r\n`);
  res.write(`Content-Length: ${body.length}\r\n`);
  res.write(`\r\n`);
  res.write(body);
  res.write(`\r\n`);
}

function handleMockStream(req, res) {
  const startedAtMs = Date.now();
  let frameIndex = 0;
  const intervalMs = 83;

  res.writeHead(200, {
    'Content-Type': 'multipart/x-mixed-replace; boundary=frame',
    'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
    'Pragma': 'no-cache',
    'Connection': 'keep-alive',
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
    headers['Pragma'] = 'no-cache';
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

function routeRequest(req, res) {
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
      phase: 'phase-1-video-preview',
      rosConnected: discovery.robot.rosConnected,
      environment: discovery.environment,
    });
    return;
  }

  if (requestUrl.pathname === '/api/healthz') {
    sendJson(res, 200, {
      ok: true,
      service: 'robomaster-s1-ai-ui',
      phase: 'phase-1-video-preview',
    });
    return;
  }

  if (requestUrl.pathname === '/api/ros/status') {
    const discovery = loadDiscovery();
    sendJson(res, 200, {
      rosConnected: discovery.robot.rosConnected,
      environment: discovery.environment,
      issues: discovery.robot.issues,
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
      canManualControl: false,
      canAutoDiscover: discovery.environment.ros2Available,
      canRunFollowMode: false,
    });
    return;
  }

  if (requestUrl.pathname === '/api/video/sources') {
    sendJson(res, 200, {
      generatedAt: loadDiscovery().generatedAt,
      sources: loadDiscovery().videoSources,
    });
    return;
  }

  if (requestUrl.pathname === '/api/video/status') {
    sendJson(res, 200, {
      sourceCount: loadDiscovery().videoSources.length,
      rosConnected: loadDiscovery().robot.rosConnected,
      mode: loadDiscovery().robot.discoveryMode,
    });
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
    serveStaticFile(res, path.join(WEB_ROOT, 'index.html')) || sendText(res, 404, 'Not found');
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

const server = http.createServer(routeRequest);

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
