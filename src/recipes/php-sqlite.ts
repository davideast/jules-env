import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';

async function resolveDarwin(): Promise<ExecutionPlan> {
  // Homebrew PHP includes SQLite by default — nothing to install
  return ExecutionPlanSchema.parse({ installSteps: [], env: {}, paths: [] });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-php-sqlite',
      label: 'Install PHP SQLite extension',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y php-sqlite3',
      checkCmd: 'dpkg -s php-sqlite3',
    },
  ];

  return ExecutionPlanSchema.parse({ installSteps, env: {}, paths: [] });
}

export const PhpSqliteRecipe: Recipe = {
  name: 'php-sqlite',
  description: 'PHP SQLite extension',
  depends: ['php'],
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
