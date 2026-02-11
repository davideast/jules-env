import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawnSync } from 'node:child_process';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [{
    id: 'install-r',
    label: 'Install R',
    cmd: 'brew install r',
    checkCmd: 'brew list --versions r',
  }];

  let rPrefix = '';
  try {
    const result = spawnSync('brew', ['--prefix', 'r'], { encoding: 'utf-8' });
    if (result.status === 0) {
      rPrefix = result.stdout.trim();
    }
  } catch (e) {
    // ignore — brew may not be installed
  }

  if (!rPrefix) {
    rPrefix = '/usr/local/opt/r';
  }

  const env = {
    R_LIBS_USER: '$HOME/.local/lib/R',
  };

  const paths = [
    `${rPrefix}/bin`,
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-r-base',
      label: 'Install R base',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y r-base',
      checkCmd: 'dpkg -s r-base',
    },
  ];

  const env = {
    R_LIBS_USER: '$HOME/.local/lib/R',
  };

  const paths: string[] = [];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

export { RRecipe as recipe };
export const RRecipe: Recipe = {
  name: 'r-lang',
  description: 'R programming language',
  verify: 'Rscript --version',
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
