import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawnSync } from 'node:child_process';

async function resolveDarwin(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-php',
      label: 'Install PHP',
      cmd: 'brew install php',
      checkCmd: 'brew list --versions php',
    },
    {
      id: 'install-composer',
      label: 'Install Composer',
      cmd: 'brew install composer',
      checkCmd: 'brew list --versions composer',
    },
  ];

  let phpPrefix = '';
  try {
    const result = spawnSync('brew', ['--prefix', 'php'], { encoding: 'utf-8' });
    if (result.status === 0) {
      phpPrefix = result.stdout.trim();
    }
  } catch (e) {
    // ignore — brew may not be installed
  }

  if (!phpPrefix) {
    phpPrefix = '/usr/local/opt/php';
  }

  const env = {
    COMPOSER_HOME: '$HOME/.config/composer',
  };

  const paths = [
    `${phpPrefix}/bin`,
    '$HOME/.config/composer/vendor/bin',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

async function resolveLinux(): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-php',
      label: 'Install PHP',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y php-cli php-common php-mbstring php-xml php-curl php-zip unzip',
      checkCmd: 'dpkg -s php-cli',
    },
    {
      id: 'install-composer',
      label: 'Install Composer',
      cmd: 'curl -sS https://getcomposer.org/installer | sudo php -- --install-dir=/usr/local/bin --filename=composer',
      checkCmd: 'which composer',
    },
  ];

  const env = {
    COMPOSER_HOME: '$HOME/.config/composer',
  };

  const paths = [
    '$HOME/.config/composer/vendor/bin',
  ];

  return ExecutionPlanSchema.parse({ installSteps, env, paths });
}

export { PhpRecipe as recipe };
export const PhpRecipe: Recipe = {
  name: 'php',
  description: 'PHP programming language with Composer',
  verify: 'php --version && composer --version',
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
