#!/usr/bin/env node
/**
 * Decrypt military-archive snapshots produced by
 * scripts/archive-military-snapshot.mjs — either a Release's asset(s)
 * (downloaded via `gh release download`, so this must run inside a clone
 * with `gh` authenticated) or a local .age file directly.
 *
 * The private key never lives in this repo; pass its path explicitly.
 *
 * Usage:
 *   node scripts/decrypt-military-archive.mjs --key <private-key-path> --out <dir> --tag <release-tag> [--asset <name>]
 *   node scripts/decrypt-military-archive.mjs --key <private-key-path> --out <dir> --file <local .age path>
 */
import { spawn } from 'node:child_process';
import { access, mkdir, mkdtemp, readdir, rm } from 'node:fs/promises';
import { constants as fsConstants } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith('--')) continue;
    out[arg.slice(2)] = argv[i + 1];
    i += 1;
  }
  return out;
}

function run(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: ['ignore', 'pipe', 'pipe'], ...options });
    const out = [];
    const err = [];
    child.stdout.on('data', (c) => out.push(c));
    child.stderr.on('data', (c) => err.push(c));
    child.on('error', reject);
    child.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`${cmd} exited ${code}: ${Buffer.concat(err).toString('utf8')}`));
        return;
      }
      resolve({ stdout: Buffer.concat(out), stderr: Buffer.concat(err) });
    });
  });
}

async function decryptOne(ageFilePath, keyPath, outDir) {
  const { stdout } = await run('age', ['-d', '-i', keyPath, ageFilePath]);
  const base = path.basename(ageFilePath).replace(/\.age$/, '');
  const outPath = path.join(outDir, base);
  await import('node:fs/promises').then(({ writeFile }) => writeFile(outPath, stdout));
  return outPath;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const { key: keyPath, out: outDir, tag, asset, file } = args;

  if (!keyPath || !outDir || (!tag && !file)) {
    console.error(
      'Usage: node scripts/decrypt-military-archive.mjs --key <private-key-path> --out <dir> (--tag <release-tag> [--asset <name>] | --file <local .age path>)',
    );
    process.exit(1);
  }

  await access(keyPath, fsConstants.R_OK).catch(() => {
    throw new Error(`cannot read private key at ${keyPath}`);
  });
  await mkdir(outDir, { recursive: true });

  if (file) {
    await access(file, fsConstants.R_OK).catch(() => {
      throw new Error(`cannot read .age file at ${file}`);
    });
    const outPath = await decryptOne(file, keyPath, outDir);
    console.log(`[decrypt-military-archive] wrote ${outPath}`);
    return;
  }

  const tmpDir = await mkdtemp(path.join(os.tmpdir(), 'gev-military-archive-'));
  try {
    const downloadArgs = ['release', 'download', tag, '-D', tmpDir];
    if (asset) downloadArgs.push('-p', asset);
    else downloadArgs.push('-p', '*.age');
    await run('gh', downloadArgs);

    const files = (await readdir(tmpDir)).filter((f) => f.endsWith('.age'));
    if (files.length === 0) throw new Error(`no .age assets found on release ${tag}`);

    for (const f of files) {
      const outPath = await decryptOne(path.join(tmpDir, f), keyPath, outDir);
      console.log(`[decrypt-military-archive] wrote ${outPath}`);
    }
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error('[decrypt-military-archive] failed:', e.message);
    process.exit(1);
  });
}
