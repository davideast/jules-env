import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-laravel-installer',
      label: 'Install Laravel installer',
      cmd: '. $HOME/.jules/shellenv 2>/dev/null; composer global require laravel/installer',
      checkCmd: '. $HOME/.jules/shellenv 2>/dev/null; laravel --version',
    },
  ];

  return ExecutionPlanSchema.parse({ installSteps, env: {}, paths: [] });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-laravel-installer',
      label: 'Install Laravel installer',
      cmd: '. $HOME/.jules/shellenv 2>/dev/null; composer global require laravel/installer',
      checkCmd: '. $HOME/.jules/shellenv 2>/dev/null; laravel --version',
    },
  ];

  return ExecutionPlanSchema.parse({ installSteps, env: {}, paths: [] });
}

export const LaravelRecipe: Recipe = {
  name: 'laravel',
  description: 'Laravel PHP framework installer',
  resolve: async (ctx: UseContext): Promise<ExecutionPlan> => {
    switch (process.platform) {
      case 'darwin':
        return resolveDarwin();
      case 'linux':
        return resolveLinux();
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
  },
};
