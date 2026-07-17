#!/usr/bin/env node

/**
 * Launches the Vite dev server and Electron together.
 *
 * The old shell one-liner waited on `nc -z localhost 3000` — that only proves
 * *something* holds the port, not that it's our server. Vite (before strictPort)
 * would quietly slide to 3001 when 3000 was taken, while Electron stayed pinned
 * to VITE_DEV_SERVER_URL=:3000 — so it loaded the widget from whatever stale
 * process was squatting there. That's a silent failure that looks like a
 * random, unfixable widget bug.
 *
 * So: refuse to start if the port is busy, and wait for *our* server to actually
 * serve widget.html before launching Electron.
 */

import { spawn } from 'node:child_process';
import net from 'node:net';

const PORT = Number(process.env.VITE_DEV_PORT ?? 3000);
const HOST = 'localhost';
const ORIGIN = `http://${HOST}:${PORT}`;
const READY_TIMEOUT_MS = 60_000;
const POLL_MS = 400;

function fail(message) {
  console.error(`\n[desktop:dev] ${message}\n`);
  process.exit(1);
}

function isPortBusy(port) {
  return new Promise((resolve) => {
    const server = net
      .createServer()
      .once('error', (error) => resolve(error.code === 'EADDRINUSE'))
      .once('listening', () => server.close(() => resolve(false)))
      .listen(port, HOST);
  });
}

/** Our server is "ready" only when it actually serves the widget entry. */
async function widgetIsServed() {
  try {
    const response = await fetch(`${ORIGIN}/widget.html`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

if (await isPortBusy(PORT)) {
  fail(
    `Port ${PORT} is already in use, so Electron would load the widget from that ` +
      `process instead of the dev server this script starts.\n\n` +
      `Find and stop it:\n\n` +
      `  lsof -nP -iTCP:${PORT} -sTCP:LISTEN\n` +
      `  kill <PID>\n`
  );
}

const vite = spawn('pnpm', ['dev'], { stdio: 'inherit', shell: false });

let viteExited = false;
vite.on('exit', (code) => {
  viteExited = true;
  if (!electron) {
    fail(
      `The dev server exited (code ${code}) before it was ready.\n` +
        `If that was a Node version error, run \`nvm use\` (see .nvmrc) and retry.`
    );
  }
});

let electron = null;

const deadline = Date.now() + READY_TIMEOUT_MS;
while (Date.now() < deadline) {
  if (viteExited) break;
  if (await widgetIsServed()) break;
  await new Promise((r) => setTimeout(r, POLL_MS));
}

if (viteExited) process.exit(1);

if (!(await widgetIsServed())) {
  vite.kill();
  fail(`Dev server never served ${ORIGIN}/widget.html within ${READY_TIMEOUT_MS / 1000}s.`);
}

console.log(`\n[desktop:dev] Dev server healthy at ${ORIGIN} — starting Electron.\n`);

electron = spawn('pnpm', ['desktop:start'], {
  stdio: 'inherit',
  shell: false,
  env: { ...process.env, VITE_DEV_SERVER_URL: ORIGIN },
});

const shutdown = () => {
  if (!vite.killed) vite.kill();
  if (electron && !electron.killed) electron.kill();
};

electron.on('exit', (code) => {
  shutdown();
  process.exit(code ?? 0);
});

process.on('SIGINT', () => {
  shutdown();
  process.exit(0);
});
process.on('SIGTERM', shutdown);
