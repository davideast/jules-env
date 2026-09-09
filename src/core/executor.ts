import type { ExecutionPlan } from './spec';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';

/**
 * Directory holding persisted shell state. Defaults to ~/.jules, but
 * JULES_HOME overrides it so callers (and the test suite) can point somewhere
 * else instead of writing to the user's real home directory.
 */
export function julesStateDir(): string {
  const override = process.env['JULES_HOME'];
  return override ? resolve(override) : resolve(homedir(), '.jules');
}

export function shellenvPath(): string {
  return resolve(julesStateDir(), 'shellenv');
}

function shellenvSource(): string {
  const file = shellenvPath();
  return `test -f "${file}" && . "${file}"; `;
}

export async function executePlan(plan: ExecutionPlan, dryRun: boolean, label?: string) {
  if (dryRun) {
    console.log(`--- DRY RUN: ${label ?? 'Execution Plan'} ---`);
  }

  // 1. Install Steps
  for (const step of plan.installSteps) {
    if (dryRun) {
      console.log(`[Step: ${step.id}] ${step.label}`);
      if (step.checkCmd) {
        console.log(`  CHECK: ${step.checkCmd}`);
      }
      console.log(`  CMD:   ${step.cmd}`);
    } else {
      console.log(`[${step.id}] ${step.label}...`);

      let skip = false;
      if (step.checkCmd) {
        // Auto-source shellenv for checkCmd
        const fullCheckCmd = `${shellenvSource()}${step.checkCmd}`;
        const check = spawn('sh', ['-c', fullCheckCmd], {
          stdio: 'ignore',
        });
        const exitCode = await new Promise<number>((res) => check.on('close', (code) => res(code ?? 1)));
        if (exitCode === 0) {
          console.log(`  -> Skipped (Check passed)`);
          skip = true;
        }
      }

      if (!skip) {
        // Auto-source shellenv for cmd
        const fullCmd = `${shellenvSource()}${step.cmd}`;
        const proc = spawn('sh', ['-c', fullCmd], {
          stdio: 'inherit',
        });
        const exitCode = await new Promise<number>((res) => proc.on('close', (code) => res(code ?? 1)));
        if (exitCode !== 0) {
          throw new Error(`Command failed: ${step.cmd}`);
        }
        console.log(`  -> Done`);
      }
    }
  }

  // 2. Files
  if (dryRun) {
    for (const file of plan.files) {
      console.log(`[File] Write to ${file.path}:`);
      console.log(file.content);
    }
  } else {
    // Collect unique directories to avoid redundant and conflicting mkdir calls
    const dirs = new Set<string>();
    for (const file of plan.files) {
      dirs.add(dirname(file.path));
    }
    await Promise.all(
      Array.from(dirs).map((dir) => mkdir(dir, { recursive: true }))
    );

    await Promise.all(
      plan.files.map(async (file) => {
        if (typeof Bun !== 'undefined') {
          await Bun.write(file.path, file.content);
        } else {
          await writeFile(file.path, file.content);
        }
      }),
    );
  }

  // 3. State Persistence (.jules/shellenv)
  const julesDir = julesStateDir();
  const stateFile = shellenvPath();
  let stateContent = '';

  if (plan.paths.length > 0) {
    // Prepend to PATH
    stateContent += `export PATH="${plan.paths.join(':')}:$PATH"\n`;
  }

  for (const [key, val] of Object.entries(plan.env)) {
    stateContent += `export ${key}="${val}"\n`;
  }

  if (dryRun) {
    console.log(`[State] Append to ${stateFile}:`);
    console.log(stateContent);
  } else {
    await mkdir(julesDir, { recursive: true });
    // Always create or append to ensure file exists for sourcing
    await appendFile(stateFile, stateContent);
    if (stateContent) {
      console.log(`Updated ${stateFile}`);
    }
  }
}
