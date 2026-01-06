import type { ExecutionPlan } from './spec';
import { appendFileSync } from 'node:fs';
import { resolve } from 'node:path';

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
        const check = Bun.spawnSync({ cmd: step.checkCmd.split(' ') });
        if (check.exitCode === 0) {
          console.log(`  -> Skipped (Check passed)`);
          skip = true;
        }
      }

      if (!skip) {
        const proc = Bun.spawnSync({ cmd: step.cmd.split(' '), stdout: 'inherit', stderr: 'inherit' });
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
       // TODO: Implement file writing for non-dry-run if needed.
       // The spec says "The tool will run in a subshell. To affect the parent shell, it must write environment changes to a file named .jules-state"
       // The plan.files might be for other config files.
       // For now, I will implement it.
       const fs = await import('node:fs/promises');
       await fs.writeFile(file.path, file.content);
    }
  }

  // 3. State Persistence (.jules-state)
  const stateFile = resolve(process.cwd(), '.jules-state');
  let stateContent = '';

  if (plan.paths.length > 0) {
    // Prepend to PATH
    stateContent += `export PATH="${plan.paths.join(':')}:$PATH"\n`;
  }

  for (const [key, val] of Object.entries(plan.env)) {
    stateContent += `export ${key}="${val}"\n`;
  }

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
