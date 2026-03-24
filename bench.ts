import { spawnSync } from 'node:child_process';
import { performance } from 'node:perf_hooks';

// Simulate what Dart recipe does
function testSpawnSync() {
  const result = spawnSync('brew', ['--prefix', 'dart-sdk'], { encoding: 'utf-8' });
  return result.stdout ? result.stdout.trim() : '';
}

async function testSpawnAsync() {
    let dartPrefix = '';
    if (typeof Bun !== 'undefined') {
      try {
        const proc = Bun.spawn(['brew', '--prefix', 'dart-sdk'], { stdout: 'pipe' });
        const output = await new Response(proc.stdout).text();
        if (output.trim()) {
          dartPrefix = output.trim();
        }
      } catch (e) {
          // ignore
      }
    } else {
      const { spawn } = await import('node:child_process');
      dartPrefix = await new Promise<string>((resolve) => {
        const child = spawn('brew', ['--prefix', 'dart-sdk']);
        let stdout = '';
        child.stdout?.on('data', (data) => { stdout += data; });
        child.on('close', () => resolve(stdout.trim()));
        child.on('error', () => resolve(''));
      });
    }
    return dartPrefix;
}

async function run() {
  console.log('Testing spawnSync...');
  const startSync = performance.now();
  for (let i = 0; i < 50; i++) {
    testSpawnSync();
  }
  const endSync = performance.now();
  console.log(`spawnSync took ${endSync - startSync}ms`);

  console.log('Testing spawnAsync...');
  const startAsync = performance.now();
  const promises = [];
  for (let i = 0; i < 50; i++) {
    promises.push(testSpawnAsync());
  }
  await Promise.all(promises);
  const endAsync = performance.now();
  console.log(`spawnAsync took ${endAsync - startAsync}ms`);
}

run();
