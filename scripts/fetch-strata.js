#!/usr/bin/env node
// Puts Strata's prebuilt grid relay (the 3D board's renderer) in public/strata/,
// from Strata's release STRATA_VERSION: downloads strata-<version>-wasm32-emscripten.tar.gz,
// checks it against the release's SHA256SUMS, and copies kit/grid-relay/dist/'s scripts
// and module. Run by `npm run build` and `npm start` (prebuild, prestart); does nothing
// when public/strata/ already holds that version. STRATA_WEB=<dir> copies from an unpacked
// download instead (for building offline).
'use strict';
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { execFileSync } = require('child_process');

const STRATA_VERSION = '0.9.1';
const ASSET = `strata-${STRATA_VERSION}-wasm32-emscripten.tar.gz`;
const BASE = `https://github.com/Preponderous-Software/strata/releases/download/v${STRATA_VERSION}`;
const FILES = ['grid-relay-scene.js', 'grid-relay-scene.wasm', 'grid-relay.js', 'strata-kit.js', 'strata-loader.js'];
const dest = path.join(__dirname, '..', 'public', 'strata');
const stamp = path.join(dest, 'VERSION');

async function download(url) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) {
    throw new Error(`${url}: HTTP ${res.status}`);
  }
  return Buffer.from(await res.arrayBuffer());
}

function copyFrom(dist) {
  fs.mkdirSync(dest, { recursive: true });
  for (const f of FILES) {
    fs.copyFileSync(path.join(dist, f), path.join(dest, f));
  }
  fs.copyFileSync(path.join(dist, '..', '..', '..', 'LICENSE'), path.join(dest, 'LICENSE'));
  fs.writeFileSync(stamp, STRATA_VERSION + '\n');
}

async function main() {
  if (fs.existsSync(stamp) && fs.readFileSync(stamp, 'utf8').trim() === STRATA_VERSION &&
      FILES.every((f) => fs.existsSync(path.join(dest, f)))) {
    return;
  }
  if (process.env.STRATA_WEB) {
    copyFrom(path.join(process.env.STRATA_WEB, 'kit', 'grid-relay', 'dist'));
    console.log(`Strata ${STRATA_VERSION}'s grid relay copied from ${process.env.STRATA_WEB} to public/strata/`);
    return;
  }
  const [archive, sums] = await Promise.all([download(`${BASE}/${ASSET}`), download(`${BASE}/SHA256SUMS`)]);
  const line = sums.toString('utf8').split('\n').find((l) => l.trim().endsWith(' ' + ASSET));
  const want = line && line.trim().split(/\s+/)[0];
  const got = crypto.createHash('sha256').update(archive).digest('hex');
  if (!want || want !== got) {
    throw new Error(`${ASSET} does not match the release's SHA256SUMS (${got} vs ${want || 'no entry'})`);
  }
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'strata-'));
  try {
    fs.writeFileSync(path.join(tmp, ASSET), archive);
    execFileSync('tar', ['-xzf', ASSET], { cwd: tmp });
    copyFrom(path.join(tmp, 'kit', 'grid-relay', 'dist'));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
  console.log(`Strata ${STRATA_VERSION}'s grid relay fetched to public/strata/ (sha256 ${got})`);
}

main().catch((e) => {
  console.error('fetch-strata: ' + e.message);
  process.exit(1);
});
