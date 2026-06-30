#!/usr/bin/env node

/**
 * Dev Electron.app may ship without NSAudioCaptureUsageDescription.
 * macOS 14.2+ / Electron 39+ use CoreAudio Tap for loopback audio by default.
 * This requires NSAudioCaptureUsageDescription and gives us "System Audio Recording Only" permission.
 * Patch plist during development.
 */

import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';

const require = createRequire(import.meta.url);

if (process.platform !== 'darwin') {
  process.exit(0);
}

const electronPath = require('electron');
const plistPath = path.join(path.dirname(electronPath), '..', 'Info.plist');

if (!fs.existsSync(plistPath)) {
  console.warn('[plist] Electron Info.plist not found:', plistPath);
  process.exit(0);
}

const key = 'NSAudioCaptureUsageDescription';
const value =
  'AI Meeting Copilot needs system audio access to transcribe meeting audio from other apps.';

let contents = fs.readFileSync(plistPath, 'utf8');

if (contents.includes(`<key>${key}</key>`)) {
  console.log('[plist] NSAudioCaptureUsageDescription already present');
  process.exit(0);
}

const insertion = `  <key>${key}</key>\n  <string>${value}</string>\n`;

if (contents.includes('</dict>')) {
  contents = contents.replace('</dict>', `${insertion}</dict>`);
  fs.writeFileSync(plistPath, contents, 'utf8');
  console.log('[plist] Added NSAudioCaptureUsageDescription to Electron.app');
} else {
  console.warn('[plist] Could not patch Info.plist — unexpected format');
}
