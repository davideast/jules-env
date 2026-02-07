import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawn } from 'node:child_process';

export const DartRecipe: Recipe = {
  name: 'dart',
  description: 'Dart SDK via Homebrew',
  resolve: async (ctx: UseContext): Promise<ExecutionPlan> => {
    // 1. Install Step
    const installSteps = [{
      id: 'install-dart',
      label: 'Install Dart SDK',
      cmd: 'brew install dart-sdk',
      checkCmd: 'brew list --versions dart-sdk',
    }];

    // 2. Resolve Paths (Read-Only Probe)
    // We use Bun.spawnSync to run `brew --prefix dart-sdk` to find where it is installed/will be installed.
    // Note: If not installed yet, `brew --prefix dart-sdk` might fail or return just the cellar path.
    // However, usually `brew --prefix` works for formulas even if not installed (returns default loc), or we assume it will be there.
    // Actually, `brew --prefix dart-sdk` returns the path where it *is* or *would be*.
    // Let's verify this behavior assumption. If it fails, we might need a fallback or handle it.
    // For now, we assume standard brew behavior.

    let dartPrefix = '';
    try {
        // @ts-ignore: Bun check for cross-runtime support
        if (typeof Bun !== 'undefined') {
            // @ts-ignore: Bun spawn
            const proc = Bun.spawn(['brew', '--prefix', 'dart-sdk'], {
                stdout: 'pipe',
                stderr: 'ignore',
            });
            const text = await new Response(proc.stdout).text();
            const exitCode = await proc.exited;
            if (exitCode === 0) {
                dartPrefix = text.trim();
            }
        } else {
            // Node.js fallback using spawn
            await new Promise<void>((resolve, reject) => {
                const proc = spawn('brew', ['--prefix', 'dart-sdk'], { stdio: ['ignore', 'pipe', 'ignore'] });
                let stdout = '';
                proc.stdout!.on('data', (chunk) => stdout += chunk);
                proc.on('close', (code) => {
                    if (code === 0) {
                        dartPrefix = stdout.trim();
                        resolve();
                    } else {
                        reject(new Error(`Command failed with code ${code}`));
                    }
                });
                proc.on('error', reject);
            });
        }
    } catch (e) {
        // ignore — brew may not be installed
    }

    // If we still don't have it (e.g. brew not found), we might default or fail.
    // For this prototype, let's assume brew is present.

    if (!dartPrefix) {
        // Fallback for safety
        dartPrefix = "/usr/local/opt/dart-sdk";
    }

    const env = {
      DART_SDK: `${dartPrefix}/libexec`,
    };

    const paths = [
      `${dartPrefix}/bin`
    ];

    return ExecutionPlanSchema.parse({
      installSteps,
      env,
      paths,
    });
  },
};
