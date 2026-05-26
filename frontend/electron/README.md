# Electron Desktop Runtime

This folder contains the desktop runtime foundation for Milestone 2.

## Files

- `main.cjs` - Electron main process, tray, shortcuts, IPC handlers (CommonJS; required because package `type` is `module`)
- `preload.cjs` - secure bridge exposed to the renderer (`window.desktop`)

## Renderer Integration

The React app reads desktop APIs from `window.desktop` and falls back to web simulation when unavailable.

IPC channels used:

- `desktop:app-info`
- `desktop:recording:start`
- `desktop:recording:pause-resume`
- `desktop:recording:stop`
- `desktop:recording:status`
- event streams:
  - `recording:state`
  - `recording:transcript`

## Development

Run renderer and desktop runtime in one command:

```bash
pnpm desktop:dev
```

Requires Node `>=22.13`. If your version is older, the command exits with setup instructions (`pnpm check:node`).

Or run separately in two terminals:

1. Renderer:
   ```bash
   pnpm dev
   ```
2. Electron:
   ```bash
   VITE_DEV_SERVER_URL=http://localhost:3000 pnpm desktop:start
   ```

## IPC Integration Test

```bash
pnpm test:desktop-ipc
```
