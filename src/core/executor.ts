import type { ExecutionPlan } from './spec';
import { appendFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';

export async function executePlan(plan: ExecutionPlan, dryRun: boolean) {
  if (dryRun) {
    console.log("--- DRY RUN: Execution Plan ---");
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
        const check = Bun.spawn({
          cmd: step.checkCmd.split(' '),
          stdout: 'ignore',
          stderr: 'ignore',
        });
        await check.exited;
        if (check.exitCode === 0) {
          console.log(`  -> Skipped (Check passed)`);
          skip = true;
        }
      }

      if (!skip) {
        const proc = Bun.spawn({
          cmd: step.cmd.split(' '),
          stdout: 'inherit',
          stderr: 'inherit',
        });
        await proc.exited;
        if (proc.exitCode !== 0) {
          throw new Error(`Command failed: ${step.cmd}`);
        }
        console.log(`  -> Done`);
      }
    }
  }

  // 2. Files
  for (const file of plan.files) {
    if (dryRun) {
       console.log(`[File] Write to ${file.path}:`);
       console.log(file.content);
    } else {
       const fs = await import('node:fs/promises');
       await fs.mkdir(dirname(file.path), { recursive: true });
       await fs.writeFile(file.path, file.content);
    }
  }

  // 3. State Persistence (.jules-state)
  const stateFile = resolve(process.cwd(), '.jules-state');
  const lines: string[] = [];

  if (plan.paths.length > 0) {
    // Prepend to PATH
    lines.push(`export PATH="${plan.paths.join(':')}:$PATH"\n`);
  }

  for (const [key, val] of Object.entries(plan.env)) {
    lines.push(`export ${key}="${val}"\n`);
  }

  const stateContent = lines.join('');

  if (dryRun) {
    console.log(`[State] Append to .jules-state:`);
    console.log(stateContent);
  } else {
    if (stateContent) {
      appendFileSync(stateFile, stateContent);
      console.log(`Updated .jules-state`);
    }
  }
}
