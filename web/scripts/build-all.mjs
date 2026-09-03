#!/usr/bin/env node
/**
 * Parallel Build Runner for Voltium
 *
 * Runs `npm run build` and `npm run worker:build` concurrently.
 * Unlike `& ... & wait` in bash, this correctly captures and propagates
 * exit codes from both child processes, failing fast if either fails.
 */

import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const webDir = path.resolve(__dirname, '..');

const isWin = process.platform === 'win32';
const npmCmd = isWin ? 'npm.cmd' : 'npm';

console.log('[build:all] Starting parallel builds: web + worker...');

function runBuild(name, script) {
  return new Promise((resolve, reject) => {
    const proc = spawn(npmCmd, ['run', script], {
      cwd: webDir,
      stdio: 'inherit',
      shell: isWin,
    });

    proc.on('error', (err) => {
      console.error(`[build:all] Failed to spawn ${name}:`, err);
      reject(err);
    });

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`[build:all] ${name} succeeded.`);
        resolve();
      } else {
        console.error(`[build:all] ${name} failed with exit code ${code}.`);
        reject(new Error(`${name} failed with code ${code}`));
      }
    });
  });
}

try {
  await Promise.all([
    runBuild('Next.js Web', 'build'),
    runBuild('Worker Bundle', 'worker:build'),
  ]);
  console.log('[build:all] Both builds completed successfully.');
  process.exit(0);
} catch (err) {
  console.error('[build:all] Build failed:', err.message);
  process.exit(1);
}
