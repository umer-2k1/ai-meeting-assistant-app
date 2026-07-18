#!/usr/bin/env node

/**
 * Guard: built HTML must reference assets RELATIVELY.
 *
 * Electron loads `dist/index.html` and `dist/widget.html` with `loadFile()` over
 * `file://`. With Vite's default `base: '/'`, `/assets/app.js` resolves against
 * the FILESYSTEM ROOT, so every script and stylesheet 404s. The main window then
 * renders blank and the transparent widget overlay — which depends on its CSS to
 * stay see-through — renders as an opaque black rectangle on the desktop.
 *
 * That failure only reproduces in `desktop:start` and packaged builds (the dev
 * server serves absolute paths fine), which is how it survived three rounds of
 * fixes aimed at the widget itself. This check makes the regression loud.
 *
 * Fix if this fails: `base: './'` in vite.config.ts.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '..', 'dist');

const ENTRIES = ['index.html', 'widget.html'];
const ABSOLUTE_REF = /(?:src|href)="\/(?!\/)/g;

const problems = [];

for (const entry of ENTRIES) {
  const file = path.join(distDir, entry);
  if (!fs.existsSync(file)) {
    problems.push(`${entry}: missing from dist/ — did the build run?`);
    continue;
  }

  const html = fs.readFileSync(file, 'utf8');
  const hits = html.match(ABSOLUTE_REF);
  if (hits) {
    problems.push(`${entry}: ${hits.length} absolute asset reference(s) — these 404 under file://`);
  }
}

if (problems.length > 0) {
  console.error('\n[check:asset-paths] Built HTML references assets absolutely.\n');
  for (const problem of problems) console.error(`  • ${problem}`);
  console.error('\nElectron loads these over file://, where "/assets/..." points at the');
  console.error('filesystem root. Set `base: "./"` in vite.config.ts.\n');
  process.exit(1);
}

console.log('[check:asset-paths] OK — built HTML uses relative asset paths.');
