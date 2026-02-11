import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';

async function resolveDarwin(ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-redis',
      label: 'Install Redis',
      cmd: 'brew install redis',
      checkCmd: 'brew list --versions redis',
    },
    {
      id: 'start-redis',
      label: 'Start Redis service',
      cmd: 'brew services start redis',
      checkCmd: 'redis-cli ping 2>/dev/null | grep -q PONG',
    },
    {
      id: 'wait-for-redis',
      label: 'Wait for Redis to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do redis-cli ping 2>/dev/null | grep -q PONG && exit 0; sleep 1; done; echo "Redis did not start"; exit 1',
    },
  ];

  const env = {
    REDIS_URL: 'redis://localhost:6379',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

async function resolveLinux(ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-redis',
      label: 'Install Redis',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y redis-server redis-tools',
      checkCmd: 'dpkg -s redis-server',
    },
    {
      id: 'start-redis',
      label: 'Start Redis service',
      cmd: `if command -v systemctl >/dev/null 2>&1 && \
   systemctl is-system-running 2>/dev/null | grep -qE "running|degraded"; then \
  sudo systemctl enable --now redis-server; \
else \
  sudo redis-server --daemonize yes; \
fi`,
      checkCmd: 'redis-cli ping 2>/dev/null | grep -q PONG',
    },
    {
      id: 'wait-for-redis',
      label: 'Wait for Redis to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do redis-cli ping 2>/dev/null | grep -q PONG && exit 0; sleep 1; done; echo "Redis did not start"; exit 1',
    },
  ];

  const env = {
    REDIS_URL: 'redis://localhost:6379',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

export { RedisRecipe as recipe };
export const RedisRecipe: Recipe = {
  name: 'redis',
  description: 'Redis in-memory data structure store',
  verify: 'redis-cli ping',
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
