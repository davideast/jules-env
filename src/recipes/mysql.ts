import type { Recipe, UseContext, ExecutionPlan } from '../core/spec';
import { ExecutionPlanSchema } from '../core/spec';

async function resolveDarwin(ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-mariadb',
      label: 'Install MariaDB',
      cmd: 'brew install mariadb',
      checkCmd: 'brew list --versions mariadb',
    },
    {
      id: 'start-mariadb',
      label: 'Start MariaDB service',
      cmd: 'brew services start mariadb',
      checkCmd: 'mysqladmin ping -u root 2>/dev/null',
    },
    {
      id: 'wait-for-mariadb',
      label: 'Wait for MariaDB to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do mysqladmin ping -u root 2>/dev/null && exit 0; sleep 1; done; echo "MariaDB did not start"; exit 1',
    },
  ];

  if (ctx.preset) {
    installSteps.push({
      id: 'create-database',
      label: `Create database '${ctx.preset}'`,
      cmd: `mariadb -u root -e "CREATE DATABASE IF NOT EXISTS \`${ctx.preset}\`"`,
      checkCmd: `mariadb -u root -e "SHOW DATABASES" | grep -q "^${ctx.preset}$"`,
    });
  }

  const env = {
    MYSQL_HOST: '127.0.0.1',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

async function resolveLinux(ctx: UseContext): Promise<ExecutionPlan> {
  const installSteps = [
    {
      id: 'install-mariadb',
      label: 'Install MariaDB',
      cmd: '(sudo apt-get update || true) && sudo apt-get install -y mariadb-server mariadb-client',
      checkCmd: 'dpkg -s mariadb-server',
    },
    {
      id: 'start-mariadb',
      label: 'Start MariaDB service',
      cmd: `sudo mkdir -p /run/mysqld && sudo chown mysql:mysql /run/mysqld && \
if command -v systemctl >/dev/null 2>&1 && \
   systemctl is-system-running 2>/dev/null | grep -qE "running|degraded"; then \
  sudo systemctl enable --now mariadb; \
else \
  sudo mysqld_safe --skip-syslog & \
fi`,
      checkCmd: 'mysqladmin ping 2>/dev/null',
    },
    {
      id: 'wait-for-mariadb',
      label: 'Wait for MariaDB to be ready',
      cmd: 'for i in 1 2 3 4 5 6 7 8 9 10; do mysqladmin ping 2>/dev/null && exit 0; sleep 1; done; echo "MariaDB did not start"; exit 1',
    },
    {
      id: 'setup-user',
      label: 'Create MariaDB user for current user',
      cmd: `sudo mariadb -e "CREATE USER IF NOT EXISTS '$(whoami)'@'localhost' IDENTIFIED VIA unix_socket; GRANT ALL PRIVILEGES ON *.* TO '$(whoami)'@'localhost' WITH GRANT OPTION; FLUSH PRIVILEGES;"`,
      checkCmd: 'mariadb -e "SELECT 1" 2>/dev/null',
    },
  ];

  if (ctx.preset) {
    installSteps.push({
      id: 'create-database',
      label: `Create database '${ctx.preset}'`,
      cmd: `mariadb -e "CREATE DATABASE IF NOT EXISTS \`${ctx.preset}\`"`,
      checkCmd: `mariadb -e "SHOW DATABASES" | grep -q "^${ctx.preset}$"`,
    });
  }

  const env = {
    // localhost implies socket connection on Linux clients
    MYSQL_HOST: 'localhost',
  };

  return ExecutionPlanSchema.parse({ installSteps, env, paths: [] });
}

export const MysqlRecipe: Recipe = {
  name: 'mysql',
  description: 'MySQL compatible relational database (MariaDB)',
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
