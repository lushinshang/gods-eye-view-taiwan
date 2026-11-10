#!/usr/bin/env node
/**
 * Fetch adsb.lol + adsb.fi's /v2/mil directly (not this project's own
 * /api/military proxy — a GitHub Actions runner cannot reach a user's local
 * dev server), merge by hex with the same mergeAircraftByHex() the live
 * /api/military route uses, and write an age-encrypted snapshot.
 *
 * Usage: node scripts/archive-military-snapshot.mjs <output-dir>
 * Requires the `age` CLI on PATH and the recipient public key committed at
 * scripts/fixtures/military-archive-pubkey.txt (decryption needs the
 * matching private key, which never leaves the archive owner's machine).
 */
import { spawn } from 'node:child_process';
import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mergeAircraftByHex } from '../server/providers/aircraft/militaryFeedMerge.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUBKEY_PATH = path.join(
  ROOT,
  'scripts/fixtures/military-archive-pubkey.txt',
);
const UPSTREAM_TIMEOUT_MS = 12000;

const SOURCES = [
  {
    label: 'adsb.lol',
    url: 'https://api.adsb.lol/v2/mil',
    userAgent: 'gods-eye-view-military-archive/1.0',
  },
  {
    label: 'adsb.fi',
    url: 'https://opendata.adsb.fi/api/v2/mil',
    userAgent: 'gods-eye-view-military-archive/1.0',
  },
];

/** Fetch one upstream's /v2/mil; returns {label, ac} with ac=[] on any failure. */
async function fetchSource({ label, url, userAgent }) {
  try {
    const signal = AbortSignal.timeout(UPSTREAM_TIMEOUT_MS);
    const res = await fetch(url, { headers: { 'User-Agent': userAgent }, signal });
    if (!res.ok) {
      console.warn(`[archive-military] ${label} returned HTTP ${res.status}`);
      return { label, ac: [] };
    }
    const parsed = await res.json();
    return { label, ac: Array.isArray(parsed?.ac) ? parsed.ac : [] };
  } catch (e) {
    console.warn(`[archive-military] ${label} fetch failed: ${e.message}`);
    return { label, ac: [] };
  }
}

/** Shell out to `age -r <recipient>` to encrypt JSON text, returns the ciphertext Buffer. */
function ageEncrypt(plaintext, recipient) {
  return new Promise((resolve, reject) => {
    const child = spawn('age', ['-r', recipient], {
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const chunks = [];
    const errChunks = [];
    child.stdout.on('data', (c) => chunks.push(c));
    child.stderr.on('data', (c) => errChunks.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(
          new Error(
            `age exited ${code}: ${Buffer.concat(errChunks).toString('utf8')}`,
          ),
        );
        return;
      }
      resolve(Buffer.concat(chunks));
    });
    child.stdin.write(plaintext);
    child.stdin.end();
  });
}

export async function buildSnapshot() {
  const [primary, secondary] = await Promise.all(SOURCES.map(fetchSource));
  const ac = mergeAircraftByHex(primary.ac, secondary.ac);
  return {
    archivedAt: new Date().toISOString(),
    sourceCounts: { [primary.label]: primary.ac.length, [secondary.label]: secondary.ac.length },
    mergedCount: ac.length,
    ac,
  };
}

async function main() {
  const [outputDir] = process.argv.slice(2);
  if (!outputDir) {
    console.error('Usage: node scripts/archive-military-snapshot.mjs <output-dir>');
    process.exit(1);
  }

  const recipient = (await readFile(PUBKEY_PATH, 'utf8')).trim();
  if (!recipient) throw new Error(`empty public key at ${PUBKEY_PATH}`);

  const snapshot = await buildSnapshot();
  const plaintext = JSON.stringify(snapshot);
  const ciphertext = await ageEncrypt(plaintext, recipient);

  await mkdir(outputDir, { recursive: true });
  const stamp = snapshot.archivedAt.replace(/[:.]/g, '-');
  const outPath = path.join(outputDir, `military-${stamp}.json.age`);
  await import('node:fs/promises').then(({ writeFile }) =>
    writeFile(outPath, ciphertext),
  );

  console.log(
    `[archive-military] wrote ${outPath} (${snapshot.mergedCount} aircraft, ${ciphertext.length} bytes encrypted)`,
  );
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('[archive-military] failed:', e.message);
    process.exit(1);
  });
}
