import { describe, test, expect } from "bun:test";
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';
import pkg from '../../package.json';

const CLI = join(import.meta.dir, '..', 'cli.ts');

function runCli(args: string[]) {
  const result = spawnSync(process.execPath, [CLI, ...args], { encoding: 'utf-8' });
  return {
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
    status: result.status,
  };
}

describe("CLI", () => {
  test("--version reports the package version", () => {
    const { stdout } = runCli(['--version']);
    expect(stdout.trim()).toBe(pkg.version);
  });

  test("use --runtime-version resolves a plan instead of printing the CLI version", () => {
    const { stdout } = runCli(['use', 'dart', '--runtime-version', '3.0.0', '--dry-run']);

    expect(stdout).toContain('DRY RUN');
    expect(stdout.trim()).not.toBe(pkg.version);
  });

  test("use --dry-run without a runtime version still resolves a plan", () => {
    const { stdout } = runCli(['use', 'dart', '--dry-run']);
    expect(stdout).toContain('DRY RUN');
  });

  test("list names a known recipe", () => {
    const { stdout } = runCli(['list']);
    expect(stdout).toContain('dart');
  });
});
