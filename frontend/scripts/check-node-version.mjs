#!/usr/bin/env node

const MIN_MAJOR = 22;
const MIN_MINOR = 13;
const MIN_PATCH = 0;

function parseVersion(version) {
  const parts = version.split('.').map((part) => Number(part));
  return {
    major: parts[0] ?? 0,
    minor: parts[1] ?? 0,
    patch: parts[2] ?? 0
  };
}

function isVersionAtLeast(current, minimum) {
  if (current.major !== minimum.major) return current.major > minimum.major;
  if (current.minor !== minimum.minor) return current.minor > minimum.minor;
  return current.patch >= minimum.patch;
}

const current = parseVersion(process.versions.node);
const minimum = { major: MIN_MAJOR, minor: MIN_MINOR, patch: MIN_PATCH };

if (!isVersionAtLeast(current, minimum)) {
  console.error('\nNode.js version is too old for this project.\n');
  console.error(`  Current:  v${process.versions.node}`);
  console.error(`  Required: v${MIN_MAJOR}.${MIN_MINOR}.${MIN_PATCH} or newer (pnpm 10.x requirement)\n`);
  console.error('Fix:\n');
  console.error('  nvm install 22');
  console.error('  nvm use 22');
  console.error('  node -v');
  console.error('  pnpm install\n');
  process.exit(1);
}
