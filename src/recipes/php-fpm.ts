import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';

async function resolveDarwin(_ctx: UseContext): Promise<ExecutionPlan> {
  // On macOS, brew install php (from php dependency) already includes FPM.
  // Just need to start the service.
  const installSteps = [
    {
      id: 'start-php-fpm',
      label: 'Start PHP-FPM service',
      cmd: 'brew services start php',
      checkCmd: 'nc -z localhost 9000 2>/dev/null',
    },
    {
      id: 'wait-for-php-fpm',
      label: 'Wait for PHP-FPM to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do nc -z localhost 9000 2>/dev/null && exit 0; sleep 1; done; echo "PHP-FPM did not start"; exit 1',
    },
  ];

  const env = {
    PHP_FPM_LISTEN: '127.0.0.1:9000',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

async function resolveLinux(_ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-php-fpm',
      label: 'Install PHP-FPM',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y php-fpm',
      checkCmd: 'ls /etc/php/*/fpm/php-fpm.conf >/dev/null 2>&1',
    },
    {
      id: 'start-php-fpm',
      label: 'Start PHP-FPM service',
      cmd: `sudo mkdir -p /run/php && \\
if command -v systemctl >/dev/null 2>&1 && \\
   systemctl is-system-running 2>/dev/null | grep -qE "running|degraded"; then \\
  SVC=$(systemctl list-unit-files 'php*-fpm*' --no-legend | awk '{print $1}' | head -1); \\
  sudo systemctl enable --now "$SVC"; \\
else \\
  FPM=$(find /usr/sbin -name 'php-fpm[0-9]*' -type f | head -1); \\
  sudo "$FPM" --daemonize; \\
fi`,
      checkCmd: 'ls /run/php/php*-fpm.sock >/dev/null 2>&1',
    },
    {
      id: 'wait-for-php-fpm',
      label: 'Wait for PHP-FPM to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do ls /run/php/php*-fpm.sock >/dev/null 2>&1 && exit 0; sleep 1; done; echo "PHP-FPM did not start"; exit 1',
    },
    {
      id: 'setup-fpm-socket',
      label: 'Create versionless PHP-FPM socket symlink',
      cmd: 'sudo ln -sf /run/php/php*-fpm.sock /run/php/php-fpm.sock',
      checkCmd: 'test -S /run/php/php-fpm.sock',
    },
  ];

  const env = {
    PHP_FPM_LISTEN: 'unix:/run/php/php-fpm.sock',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

export const PhpFpmRecipe: Recipe = {
  name: 'php-fpm',
  description: 'PHP FastCGI Process Manager',
  depends: ['php'],
  resolve: async (ctx: UseContext): Promise<ExecutionPlan> => {
    switch (process.platform) {
      case 'darwin':
        return resolveDarwin(ctx);
      case 'linux':
        return resolveLinux(ctx);
      default:
        throw new Error(`Unsupported platform: ${process.platform}`);
    }
  },
};
