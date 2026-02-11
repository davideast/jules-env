import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawnSync } from 'node:child_process';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [{
    id: 'install-ruby',
    label: 'Install Ruby',
    cmd: 'brew install ruby',
    checkCmd: 'brew list --versions ruby',
  }];

  let rubyPrefix = '';
  try {
    const result = spawnSync('brew', ['--prefix', 'ruby'], { encoding: 'utf-8' });
    if (result.status === 0) {
      rubyPrefix = result.stdout.trim();
    }
  } catch (e) {
    // ignore — brew may not be installed
  }

  if (!rubyPrefix) {
    rubyPrefix = '/usr/local/opt/ruby';
  }

  const env = {
    GEM_HOME: '$HOME/.gem/ruby',
  };

  const paths = [
    `${rubyPrefix}/bin`,
    '$HOME/.gem/ruby/bin',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-ruby-prereqs',
      label: 'Install build prerequisites',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y build-essential',
      checkCmd: 'dpkg -s build-essential',
    },
    {
      id: 'install-ruby',
      label: 'Install Ruby',
      cmd: 'sudo apt-get install -y ruby-full',
      checkCmd: 'dpkg -s ruby-full',
    },
  ];

  const env = {
    GEM_HOME: '$HOME/.gem/ruby',
  };

  const paths = [
    '$HOME/.gem/ruby/bin',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

export { RubyRecipe as recipe };
export const RubyRecipe: Recipe = {
  name: 'ruby',
  description: 'Ruby programming language',
  verify: 'ruby --version && gem --version',
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
