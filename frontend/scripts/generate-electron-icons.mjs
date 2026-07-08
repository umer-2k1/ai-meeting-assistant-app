import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const iconsDir = path.join(root, 'electron', 'icons');
const sourceWebp = path.join(root, 'public', 'favicon', 'favicon-512.webp');
const outputPng = path.join(iconsDir, 'icon.png'); // Linux + nativeImage fallback
const icnsOut = path.join(iconsDir, 'icon.icns'); // macOS app bundle
const icoOut = path.join(iconsDir, 'icon.ico'); // Windows app + taskbar

if (!existsSync(sourceWebp)) {
  console.warn('[icons] Source favicon not found:', sourceWebp);
  process.exit(0);
}

// Both are cross-platform (sharp ships prebuilt binaries for win/mac/linux;
// png2icons is pure JS), so icons build identically on every OS — no sips/iconutil.
let sharp;
let png2icons;
try {
  sharp = require('sharp');
  png2icons = require('png2icons');
} catch {
  console.warn(
    '[icons] Missing deps. Install them (from frontend/): pnpm add -D sharp png2icons'
  );
  process.exit(0);
}

mkdirSync(iconsDir, { recursive: true });

const transparent = { r: 0, g: 0, b: 0, alpha: 0 };

// 1. Decode the brand webp into a 1024px PNG master — the size .icns @2x needs.
const master = await sharp(sourceWebp)
  .resize(1024, 1024, { fit: 'contain', background: transparent })
  .png()
  .toBuffer();

// 2. Linux / fallback raster at 512.
await sharp(master).resize(512, 512, { fit: 'contain', background: transparent }).png().toFile(outputPng);

// 3. macOS .icns and Windows .ico, packed from the master in pure JS.
const icns = png2icons.createICNS(master, png2icons.BICUBIC, 0);
if (icns) writeFileSync(icnsOut, icns);

// usePNG=true → 256px entries are PNG-compressed, the format modern Windows requires.
const ico = png2icons.createICO(master, png2icons.BICUBIC, 0, /* usePNG */ true);
if (ico) writeFileSync(icoOut, ico);

console.log('[icons] Generated', [outputPng, icnsOut, icoOut].map((p) => path.basename(p)).join(', '));
