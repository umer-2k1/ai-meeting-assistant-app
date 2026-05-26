# Electron Desktop Runtime

This folder contains the desktop runtime foundation for Milestone 2.

## Files

- `main.cjs` - Electron main process, tray, shortcuts, IPC handlers, and the system-wide floating widget window (CommonJS; required because package `type` is `module`)
- `preload.cjs` - secure bridge exposed to the renderer (`window.desktop`)
- `icons/icon.png` - dock/taskbar/tray icon (generated from `public/favicon/favicon-512.webp` via `pnpm check:electron`)

## App icon

Icons are loaded from `electron/icons/` and applied to:

- Main window (`BrowserWindow` + macOS Dock via `app.dock.setIcon`)
- Menu bar tray

Run `node scripts/generate-electron-icons.mjs` (also runs in `pnpm check:electron`) if `icon.png` is missing.

## System Floating Widget

A separate always-on-top `BrowserWindow` loads `widget.html` and stays visible across the whole desktop (not only inside the main app window).

- **Visibility**: only shown while a recording session is active (hidden when recording stops)
- **Compact mode**: small dark glass pill (message icon, timer, mic, stop, settings) with a cyan pulse glow while live
- **Expanded mode**: larger AI chat panel (default 480×680) — toggle with message icon; drag corner/edges to resize within screen bounds
- **IPC**:
  - `desktop:widget:set-expanded`
  - `desktop:widget:open-main`

Widget source lives in `src/widget/` and is built as a second Vite entry (`widget.html`).

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
