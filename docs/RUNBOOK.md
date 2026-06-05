# Runbook

This runbook covers the current Phase 1 implementation: a local Node HTTP server and a browser-based video preview page.

## Phase 0

### Purpose

- Confirm repository state
- Confirm documentation baseline
- Confirm the clean-rebuild constraint

### Checks

```bash
Get-ChildItem -Force
Get-Content -Raw AGENTS.md
Get-Content -Raw ros2_robomaster_codex_prompt_v3.md
```

### Expected Result

- The repository contains the phase documents and the initial application skeleton
- `server.js` and `web/` are present as the first runnable baseline

## Phase 1

### Purpose

- Start the video preview baseline

### Start

```bash
& 'C:\\Users\\LGP\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\node\\bin\\node.exe' server.js
```

### Open

- `http://127.0.0.1:3000`

### Smoke Test

1. Open the page.
2. Click `Use local mock stream`.
3. Verify the video frame renders.
4. Verify status fields show `connected`, FPS, latency, and resolution.
5. Disconnect and reconnect the stream.

### Real Stream Usage

- Paste a real MJPEG source URL into the input field.
- Use the `Connect` button to attach through the same-origin proxy.
- If the stream server understands common quality hints, choose one of the quality presets before connecting.

### Expected Result

- The preview remains independent from YOLO or follow logic
- The status panel updates while the stream is active
- The local mock stream is usable as a smoke test when no robot camera is available
