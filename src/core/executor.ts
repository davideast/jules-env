import type { ExecutionPlan } from './spec';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile, appendFile, readFile } from 'node:fs/promises';
import { resolve, dirname, join } from 'node:path';
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

/**
 * Expands a leading `~` to the home directory. Plan file paths are written
 * directly by this process, so no shell is involved to expand it for us.
 */
function expandHome(filePath: string): string {
  if (filePath === '~') return homedir();
  if (filePath.startsWith('~/')) return join(homedir(), filePath.slice(2));
  return filePath;
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
    // Resolve ~ once per file, so the directories created below and the files
    // written are the same paths.
    const targets = plan.files.map((file) => ({
      path: expandHome(file.path),
      content: file.content,
    }));

    // Collect unique directories to avoid redundant and conflicting mkdir calls
    const dirs = new Set<string>();
    for (const target of targets) {
      dirs.add(dirname(target.path));
    }
    await Promise.all(
      Array.from(dirs).map((dir) => mkdir(dir, { recursive: true }))
    );

    await Promise.all(
      targets.map(async (target) => {
        if (typeof Bun !== 'undefined') {
          await Bun.write(target.path, target.content);
        } else {
          await writeFile(target.path, target.content);
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

    // Always create the file so it exists for sourcing, even with nothing to add.
    const existing = existsSync(stateFile) ? await readFile(stateFile, 'utf-8') : '';
    if (!existsSync(stateFile)) {
      await writeFile(stateFile, '');
    }

    // Recipes are re-runnable and compose by appending, so skip lines already
    // present rather than stacking another copy on every run.
    const alreadyPresent = new Set(existing.split('\n').filter(Boolean));
    const additions = stateContent
      .split('\n')
      .filter(Boolean)
      .filter((line) => !alreadyPresent.has(line));

    if (additions.length > 0) {
      await appendFile(stateFile, `${additions.join('\n')}\n`);
      console.log(`Updated ${stateFile}`);
    }
  }
}
