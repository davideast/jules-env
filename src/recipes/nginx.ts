import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';
import { spawnSync } from 'node:child_process';

async function resolveDarwin(_ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-nginx',
      label: 'Install Nginx',
      cmd: 'brew install nginx',
      checkCmd: 'brew list --versions nginx',
    },
    {
      id: 'start-nginx',
      label: 'Start Nginx service',
      cmd: 'brew services start nginx',
      checkCmd: 'curl -sf http://localhost:8080/ >/dev/null 2>&1',
    },
    {
      id: 'wait-for-nginx',
      label: 'Wait for Nginx to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do curl -sf http://localhost:8080/ >/dev/null 2>&1 && exit 0; sleep 1; done; echo "Nginx did not start"; exit 1',
    },
  ];

  // Use general brew --prefix (not brew --prefix nginx) because nginx config
  // lives at $(brew --prefix)/etc/nginx/, not in the nginx cellar
  let brewPrefix = '';
  try {
    const result = spawnSync('brew', ['--prefix'], { encoding: 'utf-8' });
    if (result.status === 0) {
      brewPrefix = result.stdout.trim();
    }
  } catch (e) {
    // ignore — brew may not be installed
  }
  if (!brewPrefix) {
    brewPrefix = '/usr/local';
  }

  const env = {
    NGINX_CONF_DIR: `${brewPrefix}/etc/nginx`,
    NGINX_DOC_ROOT: `${brewPrefix}/var/www`,
    NGINX_PORT: '8080',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

async function resolveLinux(_ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-nginx',
      label: 'Install Nginx',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y nginx',
      checkCmd: 'dpkg -s nginx',
    },
    {
      id: 'start-nginx',
      label: 'Start Nginx service',
      cmd: `if command -v systemctl >/dev/null 2>&1 && \\
   systemctl is-system-running 2>/dev/null | grep -qE "running|degraded"; then \\
  sudo systemctl enable --now nginx; \\
else \\
  sudo nginx; \\
fi`,
      checkCmd: 'curl -sf http://localhost:80/ >/dev/null 2>&1',
    },
    {
      id: 'wait-for-nginx',
      label: 'Wait for Nginx to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do curl -sf http://localhost:80/ >/dev/null 2>&1 && exit 0; sleep 1; done; echo "Nginx did not start"; exit 1',
    },
  ];

  const env = {
    NGINX_CONF_DIR: '/etc/nginx',
    NGINX_DOC_ROOT: '/var/www/html',
    NGINX_PORT: '80',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

export { NginxRecipe as recipe };
export const NginxRecipe: Recipe = {
  name: 'nginx',
  description: 'Nginx web server',
  verify: 'curl -sf http://localhost:80/ >/dev/null 2>&1',
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
