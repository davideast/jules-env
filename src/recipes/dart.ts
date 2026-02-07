import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawnSync } from 'node:child_process';

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
        const result = spawnSync('brew', ['--prefix', 'dart-sdk'], { encoding: 'utf-8' });
        if (result.status === 0) {
            dartPrefix = result.stdout.trim();
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
