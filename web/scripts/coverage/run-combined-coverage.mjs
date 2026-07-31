import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '../../');

function runCommand(command, args) {
  return new Promise((resolve, reject) => {
    console.log(`\n▶️ Executing: ${command} ${args.join(' ')}`);
    const child = spawn(command, args, {
      cwd: rootDir,
      stdio: 'inherit',
      shell: true,
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
    });
  });
}

async function runPipeline() {
  console.log('🏁 Starting Full Combined Coverage Pipeline...');
  try {
    console.log('\n[1/3] Running Unit Test Coverage...');
    await runCommand('npm', ['run', 'test:coverage']);

    console.log('\n[2/3] Running Integration Test Coverage...');
    await runCommand('node', ['scripts/coverage/run-integration-with-coverage.mjs']);

    console.log('\n[3/3] Merging Coverage & Checking Threshold Gate...');
    await runCommand('node', ['scripts/coverage/merge-coverage.mjs']);

    console.log('\n🎉 FULL COMBINED COVERAGE PIPELINE COMPLETED SUCCESSFULLY!');
  } catch (err) {
    console.error('\n❌ PIPELINE FAILED:', err.message);
    process.exit(1);
  }
}

runPipeline();
