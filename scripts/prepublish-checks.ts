import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname!, '..');
const pkg = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf-8'));

interface CheckResult {
  name: string;
  pass: boolean;
  ms: number;
  detail?: string;
}

const results: CheckResult[] = [];

function run(name: string, fn: () => { pass: boolean; detail?: string }) {
  const start = performance.now();
  let outcome: { pass: boolean; detail?: string };
  try {
    outcome = fn();
  } catch (e) {
    outcome = { pass: false, detail: String(e) };
  }
  const ms = Math.round(performance.now() - start);
  const icon = outcome.pass ? '\x1b[32mPASS\x1b[0m' : '\x1b[31mFAIL\x1b[0m';
  console.log(`  ${icon}  ${name} (${ms}ms)${outcome.detail ? ' — ' + outcome.detail : ''}`);
  results.push({ name, pass: outcome.pass, ms, detail: outcome.detail });
}

function exec(cmd: string, args: string[], opts?: { silent?: boolean }) {
  const result = spawnSync(cmd, args, {
    cwd: ROOT,
    encoding: 'utf-8',
    stdio: opts?.silent ? 'pipe' : ['pipe', 'pipe', 'pipe'],
  });
  return {
    ok: result.status === 0,
    stdout: result.stdout?.trim() ?? '',
    stderr: result.stderr?.trim() ?? '',
    status: result.status,
  };
}

console.log('\n🔍 Prepublish Checks\n');

// 1. Version validation
run('Version validation', () => {
  const version = pkg.version as string;
  if (version === '0.0.0') {
    return { pass: false, detail: `version "${version}" looks like a placeholder` };
  }
  if (/dev|local|placeholder/i.test(version)) {
    return { pass: false, detail: `version "${version}" contains dev/local/placeholder` };
  }
  return { pass: true, detail: version };
});

// 2. Type check
run('Type check (tsc --noEmit)', () => {
  const r = exec('bun', ['run', 'typecheck'], { silent: true });
  if (!r.ok) return { pass: false, detail: r.stderr || r.stdout };
  return { pass: true };
});

// 3. Tests
run('Tests (bun test)', () => {
  const r = exec('bun', ['test'], { silent: true });
  if (!r.ok) return { pass: false, detail: r.stderr || r.stdout };
  return { pass: true };
});

// 4. Build: Node.js bundle
run('Build: Node.js bundle', () => {
  const r = exec('bun', ['run', 'build:node'], { silent: true });
  if (!r.ok) return { pass: false, detail: r.stderr || r.stdout };
  return { pass: true };
});

// 5. Build: Bun binary
run('Build: Bun binary', () => {
  const r = exec('bun', ['run', 'build:binary'], { silent: true });
  if (!r.ok) return { pass: false, detail: r.stderr || r.stdout };
  return { pass: true };
});

// 6. Node.js smoke test
run('Node.js smoke test (--help)', () => {
  const r = exec('node', ['dist/cli.mjs', '--help'], { silent: true });
  if (!r.ok) return { pass: false, detail: r.stderr || r.stdout };
  return { pass: true };
});

// 7. Node.js version check
run('Node.js version check', () => {
  const r = exec('node', ['dist/cli.mjs', '--version'], { silent: true });
  if (!r.ok) return { pass: false, detail: r.stderr || r.stdout };
  if (r.stdout !== pkg.version) {
    return { pass: false, detail: `expected "${pkg.version}", got "${r.stdout}"` };
  }
  return { pass: true, detail: r.stdout };
});

// 8. Binary smoke test
run('Binary smoke test (--help)', () => {
  const r = exec('./jules-env', ['--help'], { silent: true });
  if (!r.ok) return { pass: false, detail: r.stderr || r.stdout };
  return { pass: true };
});

// 9. Binary version check
run('Binary version check', () => {
  const r = exec('./jules-env', ['--version'], { silent: true });
  if (!r.ok) return { pass: false, detail: r.stderr || r.stdout };
  if (r.stdout !== pkg.version) {
    return { pass: false, detail: `expected "${pkg.version}", got "${r.stdout}"` };
  }
  return { pass: true, detail: r.stdout };
});

// 10. Tarball validation
run('Tarball validation (npm pack --dry-run)', () => {
  const r = exec('npm', ['pack', '--dry-run', '--json', '--ignore-scripts'], { silent: true });
  if (!r.ok) return { pass: false, detail: r.stderr || r.stdout };

  let packInfo: Array<{ files: Array<{ path: string }>; size: number }>;
  try {
    packInfo = JSON.parse(r.stdout);
  } catch {
    return { pass: false, detail: 'Failed to parse npm pack JSON output' };
  }

  const files = packInfo[0]?.files.map((f) => f.path) ?? [];
  const totalSize = packInfo[0]?.size ?? 0;

  const required = ['package.json', 'bin/jules-env', 'dist/cli.mjs', 'README.md'];
  const missing = required.filter((f) => !files.includes(f));
  if (missing.length > 0) {
    return { pass: false, detail: `Missing required files: ${missing.join(', ')}` };
  }

  const forbidden = [
    (f: string) => f.endsWith('.test.ts'),
    (f: string) => f === 'tsconfig.json',
    (f: string) => f === 'bunfig.toml',
    (f: string) => f === 'bun.lock',
    (f: string) => f.startsWith('.github/'),
    (f: string) => f === 'jules-env',
  ];
  const unexpected = files.filter((f) => forbidden.some((check) => check(f)));
  if (unexpected.length > 0) {
    return { pass: false, detail: `Unexpected files in tarball: ${unexpected.join(', ')}` };
  }

  const MAX_SIZE = 5 * 1024 * 1024; // 5MB
  if (totalSize > MAX_SIZE) {
    return { pass: false, detail: `Tarball too large: ${(totalSize / 1024 / 1024).toFixed(2)}MB (limit: 5MB)` };
  }

  return { pass: true, detail: `${files.length} files, ${(totalSize / 1024).toFixed(1)}KB` };
});

// Summary
console.log('\n─────────────────────────────');
const passed = results.filter((r) => r.pass).length;
const failed = results.filter((r) => !r.pass).length;
const totalMs = results.reduce((sum, r) => sum + r.ms, 0);

if (failed > 0) {
  console.log(`\x1b[31m✗ ${failed} check(s) failed\x1b[0m, ${passed} passed (${totalMs}ms total)\n`);
  process.exit(1);
} else {
  console.log(`\x1b[32m✓ All ${passed} checks passed\x1b[0m (${totalMs}ms total)\n`);
}
