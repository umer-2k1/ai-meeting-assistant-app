#!/usr/bin/env node

import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

try {
  const electronPath = require('electron');
  if (!electronPath || typeof electronPath !== 'string') {
    throw new Error('Electron path is empty');
  }

  if (process.platform === 'darwin') {
    const patchScript = path.join(__dirname, 'patch-electron-plist.mjs');
    spawnSync(process.execPath, [patchScript], { stdio: 'inherit' });
  }
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error('\nElectron is not installed correctly.\n');
  console.error(`  ${message}\n`);
  console.error('Fix (from frontend/):\n');
  console.error('  rm -rf node_modules/.pnpm/electron@* node_modules/electron');
  console.error('  pnpm add -D electron@42.2.0');
  console.error('  pnpm exec electron --version\n');
  process.exit(1);
}
