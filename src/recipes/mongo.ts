import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';

async function resolveDarwin(ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-mongo',
      label: 'Install MongoDB Community Edition',
      cmd: 'brew tap mongodb/brew && brew install mongodb-community',
      checkCmd: 'brew list --versions mongodb-community',
    },
    {
      id: 'start-mongo',
      label: 'Start MongoDB service',
      cmd: 'brew services start mongodb-community',
      checkCmd: 'mongosh --quiet --eval "db.runCommand({ping:1})" 2>/dev/null',
    },
    {
      id: 'wait-for-mongo',
      label: 'Wait for MongoDB to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do mongosh --quiet --eval "db.runCommand({ping:1})" 2>/dev/null && exit 0; sleep 1; done; echo "MongoDB did not start"; exit 1',
    },
  ];

  if (ctx.preset) {
    installSteps.push({
      id: 'create-database',
      label: `Create database '${ctx.preset}'`,
      cmd: `mongosh --quiet --eval "use ${ctx.preset}; db.createCollection('_init')"`,
      checkCmd: `mongosh --quiet --eval "db.getMongo().getDBNames().includes('${ctx.preset}')" | grep -q true`,
    });
  }

  const env = {
    MONGO_URL: 'mongodb://localhost:27017',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

async function resolveLinux(ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-prereqs',
      label: 'Install prerequisites',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y gnupg curl',
      checkCmd: 'dpkg -s gnupg && dpkg -s curl',
    },
    {
      id: 'add-key',
      label: 'Add MongoDB GPG key',
      cmd: 'curl -fsSL https://www.mongodb.org/static/pgp/server-8.0.asc | sudo gpg --dearmor -o /usr/share/keyrings/mongodb-server-8.0.gpg',
      checkCmd: 'test -f /usr/share/keyrings/mongodb-server-8.0.gpg',
    },
    {
      id: 'add-repo',
      label: 'Add MongoDB repository',
      cmd: 'echo "deb [signed-by=/usr/share/keyrings/mongodb-server-8.0.gpg arch=amd64] https://repo.mongodb.org/apt/ubuntu noble/mongodb-org/8.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-8.0.list > /dev/null',
      checkCmd: 'test -f /etc/apt/sources.list.d/mongodb-org-8.0.list',
    },
    {
      id: 'install-mongo',
      label: 'Install MongoDB',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y mongodb-org',
      checkCmd: 'dpkg -s mongodb-org',
    },
    {
      id: 'start-mongo',
      label: 'Start MongoDB service',
      cmd: `sudo mkdir -p /var/lib/mongodb /var/log/mongodb && \
sudo chown -R mongodb:mongodb /var/lib/mongodb /var/log/mongodb && \
if command -v systemctl >/dev/null 2>&1 && \
   systemctl is-system-running 2>/dev/null | grep -qE "running|degraded"; then \
  sudo systemctl enable --now mongod; \
else \
  sudo mongod --dbpath /var/lib/mongodb --logpath /var/log/mongodb/mongod.log --fork; \
fi`,
      checkCmd: 'mongosh --quiet --eval "db.runCommand({ping:1})" 2>/dev/null',
    },
    {
      id: 'wait-for-mongo',
      label: 'Wait for MongoDB to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do mongosh --quiet --eval "db.runCommand({ping:1})" 2>/dev/null && exit 0; sleep 1; done; echo "MongoDB did not start"; exit 1',
    },
  ];

  if (ctx.preset) {
    installSteps.push({
      id: 'create-database',
      label: `Create database '${ctx.preset}'`,
      cmd: `mongosh --quiet --eval "use ${ctx.preset}; db.createCollection('_init')"`,
      checkCmd: `mongosh --quiet --eval "db.getMongo().getDBNames().includes('${ctx.preset}')" | grep -q true`,
    });
  }

  const env = {
    MONGO_URL: 'mongodb://localhost:27017',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

export { MongoRecipe as recipe };
export const MongoRecipe: Recipe = {
  name: 'mongo',
  description: 'MongoDB Community Edition',
  verify: 'mongosh --quiet --eval "db.runCommand({ping:1})"',
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
