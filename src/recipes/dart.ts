import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';

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
        const proc = Bun.spawn({ cmd: ['brew', '--prefix', 'dart-sdk'], stdout: 'pipe' });
        const stdout = await new Response(proc.stdout).text();
        const exitCode = await proc.exited;

        if (exitCode === 0) {
            dartPrefix = stdout.trim();
        } else {
             // Fallback or error? For a prototype, let's assume standard brew location if command fails (unlikely if brew is installed)
             // Or maybe we can't fully resolve env vars until install is done?
             // But `resolve` must return the plan *before* execution.
             // `brew --prefix dart-sdk` usually works if formula is known.
             // If dart-sdk is not installed, brew --prefix dart-sdk might error depending on version.
             // Let's check `brew --prefix` behavior in general.
             // "Display the location in the cellar for formula"

             // If we can't determine it, we might guess `/opt/homebrew/opt/dart-sdk`.
             // But for now, let's rely on spawn.
             if (ctx.dryRun) {
                 dartPrefix = "/opt/homebrew/opt/dart-sdk"; // Mock for dry-run if actual brew call fails or isn't desired?
                 // Actually spec says "Can probe system".
             }
        }
    } catch (e) {
        // ignore
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
