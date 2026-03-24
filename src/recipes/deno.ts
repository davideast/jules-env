import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawn } from 'node:child_process';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [{
    id: 'install-deno',
    label: 'Install Deno',
    cmd: 'brew install deno',
    checkCmd: 'brew list --versions deno',
  }];

  let denoPrefix = '';
  try {
    const result = await new Promise<string>((resolve, reject) => {
      const proc = spawn('brew', ['--prefix', 'deno']);
      let stdout = '';
      proc.stdout.on('data', chunk => stdout += chunk);
      proc.on('close', code => {
        if (code === 0) {
          resolve(stdout.trim());
        } else {
          reject(new Error('command failed'));
        }
      });
      proc.on('error', reject);
    });
    if (result) {
      denoPrefix = result;
    }
  } catch (e) {
    // ignore — brew may not be installed
  }

  if (!denoPrefix) {
    denoPrefix = '/usr/local/opt/deno';
  }

  const env = {
    DENO_DIR: '$HOME/.deno',
  };

  const paths = [
    `${denoPrefix}/bin`,
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-deno-prereqs',
      label: 'Install prerequisites',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y unzip',
      checkCmd: 'dpkg -s unzip',
    },
    {
      id: 'install-deno',
      label: 'Install Deno',
      cmd: 'curl -fsSL https://deno.land/install.sh | sh',
      checkCmd: 'test -f $HOME/.deno/bin/deno',
    }
  ];

  const env = {
    DENO_DIR: '$HOME/.deno',
  };

  const paths = [
    '$HOME/.deno/bin',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

export { DenoRecipe as recipe };
export const DenoRecipe: Recipe = {
  name: 'deno',
  description: 'Deno runtime',
  verify: 'deno --version',
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
