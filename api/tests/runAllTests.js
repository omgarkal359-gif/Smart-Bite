import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function runTestFile(filename) {
  return new Promise((resolve, reject) => {
    const child = spawn('node', [join(__dirname, filename)], {
      stdio: 'inherit',
      env: { ...process.env, NODE_ENV: 'test', NO_LISTEN: 'true' }
    });
    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Test script ${filename} failed with exit code ${code}`));
    });
  });
}

async function runAll() {
  console.log('==================================================');
  console.log(' STARTING MASTER BACKEND TEST SUITE EXECUTION');
  console.log('==================================================\n');

  try {
    await runTestFile('emailService.test.js');
    await runTestFile('controllers.test.js');

    console.log('==================================================');
    console.log(' ALL BACKEND SUITES COMPLETED WITH 100% PASS RATE');
    console.log('==================================================\n');
  } catch (err) {
    console.error('\nTest Suite Execution Failed:', err.message);
    process.exit(1);
  }
}

runAll();
