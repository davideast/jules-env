import type { ExecutionPlan } from './spec';
import { spawn } from 'node:child_process';
import { mkdir, writeFile, appendFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { homedir } from 'node:os';

const SHELLENV_SOURCE = 'test -f $HOME/.jules/shellenv && . $HOME/.jules/shellenv; ';

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
        const fullCheckCmd = `${SHELLENV_SOURCE}${step.checkCmd}`;
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
        const fullCmd = `${SHELLENV_SOURCE}${step.cmd}`;
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
    await Promise.all(
      plan.files.map(async (file) => {
        await mkdir(dirname(file.path), { recursive: true });
        await writeFile(file.path, file.content);
      }),
    );
  }

  // 3. State Persistence (.jules/shellenv)
  const julesDir = resolve(homedir(), '.jules');
  const stateFile = resolve(julesDir, 'shellenv');
  let stateContent = '';

  if (plan.paths.length > 0) {
    // Prepend to PATH
    stateContent += `export PATH="${plan.paths.join(':')}:$PATH"\n`;
  }

  for (const [key, val] of Object.entries(plan.env)) {
    stateContent += `export ${key}="${val}"\n`;
  }

  if (dryRun) {
    console.log(`[State] Append to ~/.jules/shellenv:`);
    console.log(stateContent);
  } else {
    if (stateContent) {
      await mkdir(julesDir, { recursive: true });
      await appendFile(stateFile, stateContent);
      console.log(`Updated ~/.jules/shellenv`);
    }
  }
}
