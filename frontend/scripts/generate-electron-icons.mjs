import { existsSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'electron', 'icons');
const sourceWebp = path.join(root, 'public', 'favicon', 'favicon-512.webp');
const outputPng = path.join(iconsDir, 'icon.png');

if (!existsSync(sourceWebp)) {
  console.warn('[icons] Source favicon not found:', sourceWebp);
  process.exit(0);
}

mkdirSync(iconsDir, { recursive: true });

if (existsSync(outputPng)) {
  console.log('[icons] icon.png already exists');
  process.exit(0);
}

if (process.platform === 'darwin') {
  execSync(`sips -s format png "${sourceWebp}" --out "${outputPng}"`, { stdio: 'inherit' });
  console.log('[icons] Generated', outputPng);
  process.exit(0);
}

console.warn('[icons] Run on macOS with sips, or commit electron/icons/icon.png manually.');
process.exit(0);
