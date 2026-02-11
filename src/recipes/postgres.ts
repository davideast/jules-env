import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';

async function resolveDarwin(ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-postgres',
      label: 'Install PostgreSQL',
      cmd: 'brew install postgresql@16',
      checkCmd: 'brew list --versions postgresql@16',
    },
    {
      id: 'start-postgres',
      label: 'Start PostgreSQL service',
      cmd: 'brew services start postgresql@16',
      checkCmd: 'pg_isready',
    },
    {
      id: 'wait-for-postgres',
      label: 'Wait for PostgreSQL to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do pg_isready && exit 0; sleep 1; done; echo "PostgreSQL did not start"; exit 1',
    },
  ];

  if (ctx.preset) {
    installSteps.push({
      id: 'create-database',
      label: `Create database '${ctx.preset}'`,
      cmd: `createdb ${ctx.preset}`,
      checkCmd: `psql -lqt | cut -d'|' -f1 | grep -qw ${ctx.preset}`,
    });
  }

  // Probe for brew prefix
  let brewPrefix = '/usr/local/opt/postgresql@16';
  try {
    if (typeof Bun !== 'undefined') {
      const proc = Bun.spawn(['brew', '--prefix', 'postgresql@16'], { stdout: 'pipe' });
      const output = await new Response(proc.stdout).text();
      if (output.trim()) {
        brewPrefix = output.trim();
      }
    } else {
      const { spawnSync } = await import('node:child_process');
      const proc = spawnSync('brew', ['--prefix', 'postgresql@16'], { encoding: 'utf-8' });
      if (proc.stdout && proc.stdout.trim()) {
        brewPrefix = proc.stdout.trim();
      }
    }
  } catch (e) {
    // Ignore error, fallback to default
  }

  const env = {
    PGHOST: 'localhost',
  };

  return ExecutionPlanSchema.parse({
    installSteps,
    env,
    paths: [`${brewPrefix}/bin`],
  });
}

async function resolveLinux(ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-postgres',
      label: 'Install PostgreSQL',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y postgresql postgresql-client',
      checkCmd: 'dpkg -s postgresql',
    },
    {
      id: 'start-postgres',
      label: 'Start PostgreSQL service',
      cmd: `if command -v systemctl >/dev/null 2>&1 && systemctl is-system-running 2>/dev/null | grep -qE "running|degraded"; then sudo systemctl enable --now postgresql; else sudo pg_ctlcluster $(pg_lsclusters -h | head -1 | awk '{print $1, $2}') start; fi`,
      checkCmd: 'pg_isready',
    },
    {
      id: 'wait-for-postgres',
      label: 'Wait for PostgreSQL to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do pg_isready && exit 0; sleep 1; done; echo "PostgreSQL did not start"; exit 1',
    },
    {
      id: 'setup-user',
      label: 'Create PostgreSQL user for current user',
      cmd: `sudo -u postgres createuser -s $(whoami); sudo -u postgres createdb -O $(whoami) $(whoami)`,
      checkCmd: `psql -c 'SELECT 1' 2>/dev/null`,
    },
  ];

  if (ctx.preset) {
    installSteps.push({
      id: 'create-database',
      label: `Create database '${ctx.preset}'`,
      cmd: `createdb ${ctx.preset}`,
      checkCmd: `psql -lqt | cut -d'|' -f1 | grep -qw ${ctx.preset}`,
    });
  }

  const env = {
    PGHOST: '/var/run/postgresql',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

export { PostgresRecipe as recipe };
export const PostgresRecipe: Recipe = {
  name: 'postgres',
  description: 'PostgreSQL relational database',
  verify: "psql -c 'SELECT 1'",
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
