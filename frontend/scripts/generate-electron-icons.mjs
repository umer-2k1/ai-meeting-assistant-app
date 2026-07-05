import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'electron', 'icons');
const sourceWebp = path.join(root, 'public', 'favicon', 'favicon-512.webp');
const outputPng = path.join(iconsDir, 'icon.png');
const iconset = path.join(iconsDir, 'icon.iconset');
const icnsOut = path.join(iconsDir, 'icon.icns');

if (!existsSync(sourceWebp)) {
  console.warn('[icons] Source favicon not found:', sourceWebp);
  process.exit(0);
}

mkdirSync(iconsDir, { recursive: true });

if (process.platform !== 'darwin') {
  console.warn('[icons] macOS (sips + iconutil) required to generate icons. Commit icon.icns/icon.png manually on other platforms.');
  process.exit(0);
}

// 1. Base 512px PNG from the brand favicon.
execSync(`sips -s format png "${sourceWebp}" --out "${outputPng}"`, { stdio: 'inherit' });

// 2. Rebuild the .iconset at every size macOS wants.
rmSync(iconset, { recursive: true, force: true });
mkdirSync(iconset, { recursive: true });
const specs = [
  [16, 'icon_16x16.png'],
  [32, 'icon_16x16@2x.png'],
  [32, 'icon_32x32.png'],
  [64, 'icon_32x32@2x.png'],
  [128, 'icon_128x128.png'],
  [256, 'icon_128x128@2x.png'],
  [256, 'icon_256x256.png'],
  [512, 'icon_256x256@2x.png'],
  [512, 'icon_512x512.png'],
  [1024, 'icon_512x512@2x.png'],
];
for (const [size, name] of specs) {
  execSync(`sips -z ${size} ${size} "${outputPng}" --out "${path.join(iconset, name)}"`, {
    stdio: 'ignore',
  });
}

// 3. Compile the .icns used by the macOS dock + app bundle.
execSync(`iconutil -c icns "${iconset}" -o "${icnsOut}"`, { stdio: 'inherit' });
console.log('[icons] Generated', icnsOut);
