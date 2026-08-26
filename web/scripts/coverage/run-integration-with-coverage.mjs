import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');
const v8CoverageDir = path.resolve(rootDir, '.v8-coverage');
const integrationCoverageDir = path.resolve(rootDir, 'coverage-integration');

// Ensure directories exist
if (fs.existsSync(v8CoverageDir)) {
  fs.rmSync(v8CoverageDir, { recursive: true, force: true });
}
fs.mkdirSync(v8CoverageDir, { recursive: true });

if (!fs.existsSync(integrationCoverageDir)) {
  fs.mkdirSync(integrationCoverageDir, { recursive: true });
}

console.log('🚀 Starting Dev Server with NODE_V8_COVERAGE...');

const serverEnv = {
  ...process.env,
  NODE_V8_COVERAGE: v8CoverageDir,
  PORT: '8081',
};

const serverProcess = spawn('npm', ['run', 'dev'], {
  cwd: rootDir,
  env: serverEnv,
  stdio: 'inherit',
  shell: true,
});

function runCommand(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
      ...options,
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });
}

async function main() {
  try {
    console.log('⏳ Waiting for server on http://localhost:8081...');
    await runCommand('npx', ['wait-on', 'http://localhost:8081', '-t', '60000']);
    console.log('✅ Server is up! Running integration and API route tests...');

    await runCommand('npx', [
      'vitest',
      'run',
      'tests/integration',
      'tests/api-routes.test.ts',
    ]);

    console.log('✅ Tests completed successfully.');
  } catch (err) {
    console.error('❌ Test execution failed:', err.message);
    process.exitCode = 1;
  } finally {
    console.log('🛑 Stopping Dev Server to flush V8 coverage...');
    serverProcess.kill('SIGTERM');
    // On Windows, tree kill might be necessary
    if (process.platform === 'win32') {
      spawn('taskkill', ['/pid', serverProcess.pid.toString(), '/f', '/t']);
    }

    await new Promise((r) => setTimeout(r, 3000));

    console.log('📊 Generating c8 integration coverage report...');
    try {
      await runCommand('npx', ['c8', 'report']);
      console.log('✅ Integration coverage report generated in ./coverage-integration/! ');
    } catch (c8Err) {
      console.error('⚠️ c8 report generation failed:', c8Err.message);
    }
  }
}

main();
